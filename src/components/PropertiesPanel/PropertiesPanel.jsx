import React, { useState } from 'react'
import styles from './PropertiesPanel.module.css'
import { useEditorStore } from '../../store/editorStore'
import CurvesEditor from '../CurvesEditor/CurvesEditor'
import { isIdentityCurve } from '../../utils/curves'

const PROP_TABS = ['Video', 'Audio', 'Text', 'Element']

const DEFAULTS = {
  scale: 100, posX: 0, posY: 0, rotate: 0, opacity: 100,
  cropT: 0, cropB: 0, cropL: 0, cropR: 0,
  speed: 1, reversed: false,
  brightness: 0, contrast: 0, saturation: 0, hue: 0,
  blur: 0, grayscale: 0,
  warmth: 0, fade: 0, fadeIn: 0, fadeOut: 0,
  blendMode: 'normal',
}

const BLEND_MODES = [
  'normal','multiply','screen','overlay','darken','lighten',
  'color-dodge','color-burn','soft-light','hard-light',
  'difference','exclusion','hue','saturation','color','luminosity',
]

const pct = (val, min, max) => `${Math.round(((val - min) / (max - min)) * 100)}%`

function Accordion({ label, open, onToggle, dirty, children }) {
  return (
    <>
      <button
        className={`${styles.accordion} ${dirty ? styles.accordionDirty : ''}`}
        onClick={onToggle}
      >
        <span className={styles.accordionLabel}>{label}</span>
        <span className={`${styles.accordionArrow} ${open ? styles.accordionArrowOpen : ''}`}>▾</span>
      </button>
      {open && <div className={styles.accordionContent}>{children}</div>}
    </>
  )
}

function KfBtn({ propKey, clip, clipTime, setKeyframe, removeKeyframe, currentVal }) {
  if (!clip) return <div className={styles.kfSpacer} />
  const kfs         = clip.keyframes?.[propKey] ?? []
  const hasAnyKf    = kfs.length > 0
  const hasKfAtTime = kfs.some(kf => Math.abs(kf.t - clipTime) < 0.05)
  const toggle = () => {
    if (hasKfAtTime) removeKeyframe(clip.id, propKey, clipTime)
    else             setKeyframe(clip.id, propKey, clipTime, currentVal)
  }
  return (
    <button
      className={`${styles.kfBtn} ${hasAnyKf ? styles.kfEnabled : ''} ${hasKfAtTime ? styles.kfActive : ''}`}
      onClick={toggle}
      title={hasKfAtTime ? 'Remove keyframe' : 'Add keyframe at current time'}
    >◆</button>
  )
}

function Slider({ label, propKey, min, max, step = 1, value, fmt, onChange, onCommit, kfBtnProps }) {
  return (
    <div className={styles.row}>
      {kfBtnProps
        ? <KfBtn {...kfBtnProps} propKey={propKey} currentVal={value} />
        : <div className={styles.kfSpacer} />
      }
      <span className={styles.label}>{label}</span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        className={styles.slider}
        style={{ '--val': pct(value, min, max) }}
        onChange={e => onChange(propKey, Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
      />
      <span className={styles.value}>{fmt ? fmt(value) : value}</span>
    </div>
  )
}

function KfStrip({ clip }) {
  if (!clip?.keyframes) return null
  const props = Object.keys(clip.keyframes).filter(p => (clip.keyframes[p] ?? []).length > 0)
  if (props.length === 0) return null
  return (
    <div className={styles.kfStrip}>
      <span className={styles.kfStripLabel}>Keyframes</span>
      <div className={styles.kfStripTrack}>
        {props.map(prop =>
          (clip.keyframes[prop] ?? []).map(kf => (
            <div
              key={`${prop}-${kf.t}`}
              className={styles.kfDot}
              style={{ left: `${Math.min(99, (kf.t / clip.durSec) * 100)}%` }}
              title={`${prop} @ ${kf.t.toFixed(2)}s`}
            />
          ))
        )}
      </div>
    </div>
  )
}

const ALIGN_OPTS = ['left', 'center', 'right']

function CaptionProps({ clip, set, commit, saveHistory }) {
  if (!clip) return null
  const g = k => clip[k] ?? {
    text: '', fontSize: 5, posY: 88, color: '#ffffff', bgColor: 'rgba(0,0,0,0.65)', align: 'center', bold: false, italic: false,
  }[k]
  return (
    <div className={styles.captionProps}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Caption</span>
      </div>
      <div className={`${styles.row} ${styles.captionTextRow}`}>
        <textarea
          className={styles.captionTextarea}
          value={g('text')}
          placeholder="Caption text…"
          rows={3}
          onChange={e => set('text', e.target.value)}
          onBlur={commit}
        />
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Size</span>
        <input type="range" min={2} max={15} step={0.5} value={g('fontSize')}
          className={styles.slider} style={{ '--val': `${((g('fontSize') - 2) / 13) * 100}%` }}
          onChange={e => set('fontSize', Number(e.target.value))}
          onMouseUp={commit} onTouchEnd={commit}
        />
        <span className={styles.value}>{g('fontSize')}%</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Position</span>
        <input type="range" min={0} max={100} step={1} value={g('posY')}
          className={styles.slider} style={{ '--val': `${g('posY')}%` }}
          onChange={e => set('posY', Number(e.target.value))}
          onMouseUp={commit} onTouchEnd={commit}
        />
        <span className={styles.value}>{g('posY')}%</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Color</span>
        <input type="color" value={g('color')} className={styles.colorInput}
          onChange={e => { set('color', e.target.value); commit() }}
        />
        <span className={styles.label} style={{ marginLeft: 8 }}>BG</span>
        <input type="color"
          value={g('bgColor').match(/#[0-9a-f]{6}/i)?.[0] ?? '#000000'}
          className={styles.colorInput}
          onChange={e => { set('bgColor', `${e.target.value}a6`); commit() }}
        />
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Align</span>
        <div className={styles.alignBtns}>
          {ALIGN_OPTS.map(a => (
            <button key={a}
              className={`${styles.alignBtn} ${g('align') === a ? styles.alignBtnActive : ''}`}
              onClick={() => { set('align', a); commit() }}
            >{a[0].toUpperCase()}</button>
          ))}
        </div>
        <button
          className={`${styles.alignBtn} ${g('bold') ? styles.alignBtnActive : ''}`}
          onClick={() => { set('bold', !g('bold')); commit() }}
          style={{ fontWeight: 700, marginLeft: 8 }}
        >B</button>
        <button
          className={`${styles.alignBtn} ${g('italic') ? styles.alignBtnActive : ''}`}
          onClick={() => { set('italic', !g('italic')); commit() }}
          style={{ fontStyle: 'italic' }}
        >I</button>
      </div>
    </div>
  )
}

export default function PropertiesPanel() {
  const [tab, setTab]       = useState('Video')
  const [open, setOpen]     = useState({
    Crop: false, Speed: false, Color: false, Filters: false, Adjust: false, Curves: false, Transition: false,
  })
  const [confirmOpen, setConfirmOpen] = useState(false)

  const clips          = useEditorStore(s => s.clips)
  const selectedId     = useEditorStore(s => s.selectedClipId)
  const updateClip     = useEditorStore(s => s.updateClip)
  const saveHistory    = useEditorStore(s => s.saveHistory)
  const currentTime    = useEditorStore(s => s.currentTime)
  const setKeyframe    = useEditorStore(s => s.setKeyframe)
  const removeKeyframe = useEditorStore(s => s.removeKeyframe)
  const setCurve       = useEditorStore(s => s.setCurve)
  const setClips       = useEditorStore(s => s.setClips)

  const clip     = clips.find(c => c.id === selectedId) ?? null
  const clipTime = clip ? Math.max(0, Math.min(clip.durSec, currentTime - clip.startSec)) : 0

  const get    = key => clip?.[key] ?? DEFAULTS[key]
  const set    = (key, val) => { if (clip) updateClip(clip.id, { [key]: val }) }
  const commit = () => { if (clip) saveHistory() }

  const confirmClear = () => { if (clip) setConfirmOpen(true) }
  const doClear = () => {
    setConfirmOpen(false)
    if (!clip) return
    saveHistory()
    updateClip(clip.id, { ...DEFAULTS, keyframes: {}, curves: {}, transitionIn: null })
  }

  const toggle = name => setOpen(p => ({ ...p, [name]: !p[name] }))

  const cropDirty   = ['cropT','cropB','cropL','cropR'].some(k => get(k) !== DEFAULTS[k])
  const speedDirty  = get('speed') !== DEFAULTS.speed || get('reversed') !== DEFAULTS.reversed
  const colorDirty  = ['brightness','contrast','saturation','hue'].some(k => get(k) !== DEFAULTS[k])
  const filterDirty = ['blur','grayscale'].some(k => get(k) !== DEFAULTS[k])
  const adjustDirty = ['warmth','fade','fadeIn','fadeOut'].some(k => get(k) !== DEFAULTS[k])
  const curvesDirty = clip?.curves
    ? Object.values(clip.curves).some(pts => !isIdentityCurve(pts))
    : false
  const transitionDirty = !!(clip?.transitionIn)

  const kfBase = { clip, clipTime, setKeyframe, removeKeyframe }
  const isOverlayTrack = clip && !['v1','a1','a2','a3','text'].includes(clip.track)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Properties</span>
        <div className={styles.clearWrap}>
          <button
            className={`${styles.clear} ${!clip ? styles.clearDisabled : ''}`}
            onClick={confirmClear}
            disabled={!clip}
            title="Reset all properties to defaults"
          >
            Clear
          </button>
          {confirmOpen && (
            <div className={styles.confirmPopup}>
              <p className={styles.confirmMsg}>Reset all properties to defaults?</p>
              <div className={styles.confirmBtns}>
                <button className={styles.confirmYes} onClick={doClear}>Reset</button>
                <button className={styles.confirmNo}  onClick={() => setConfirmOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        {PROP_TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.activeTab : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {tab === 'Video' && clip?.type !== 'caption' && (
          <>
            {!clip && (
              <div className={styles.placeholder}>Select a video clip in the timeline to edit properties.</div>
            )}
            {clip?.type === 'adjustment' && (
              <div className={styles.adjBadge}>⚙ Adjustment Layer</div>
            )}

            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Transform</span>
              <span className={styles.sectionArrow}>▾</span>
            </div>

            <Slider
              label="Scale" propKey="scale" min={0} max={200}
              value={get('scale')} fmt={v => `${v}%`}
              onChange={set} onCommit={commit}
              kfBtnProps={kfBase}
            />

            <div className={styles.row}>
              <div className={styles.kfSpacer} />
              <span className={styles.label}>Position</span>
              <div className={styles.xyWrap}>
                <div className={styles.xyInput}>
                  <span className={styles.xyLabel}>X</span>
                  <input
                    type="number"
                    className={styles.xyNum}
                    value={get('posX')}
                    onChange={e => { set('posX', Number(e.target.value)); commit() }}
                  />
                </div>
                <div className={styles.xyInput}>
                  <span className={styles.xyLabel}>Y</span>
                  <input
                    type="number"
                    className={styles.xyNum}
                    value={get('posY')}
                    onChange={e => { set('posY', Number(e.target.value)); commit() }}
                  />
                </div>
              </div>
            </div>

            <Slider
              label="Rotate" propKey="rotate" min={-180} max={180}
              value={get('rotate')} fmt={v => `${v}°`}
              onChange={set} onCommit={commit}
              kfBtnProps={kfBase}
            />
            <Slider
              label="Opacity" propKey="opacity" min={0} max={100}
              value={get('opacity')} fmt={v => `${v}%`}
              onChange={set} onCommit={commit}
              kfBtnProps={kfBase}
            />

            <KfStrip clip={clip} />

            {isOverlayTrack && (
              <div className={styles.row}>
                <div className={styles.kfSpacer} />
                <span className={styles.label}>Blend</span>
                <select
                  className={styles.blendSelect}
                  value={get('blendMode')}
                  onChange={e => { set('blendMode', e.target.value); commit() }}
                >
                  {BLEND_MODES.map(m => (
                    <option key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1).replace(/-/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Accordion label="Crop" open={open.Crop} onToggle={() => toggle('Crop')} dirty={cropDirty}>
              <Slider label="Top"    propKey="cropT" min={0} max={50} value={get('cropT')} fmt={v => `${v}%`} onChange={set} onCommit={commit} />
              <Slider label="Bottom" propKey="cropB" min={0} max={50} value={get('cropB')} fmt={v => `${v}%`} onChange={set} onCommit={commit} />
              <Slider label="Left"   propKey="cropL" min={0} max={50} value={get('cropL')} fmt={v => `${v}%`} onChange={set} onCommit={commit} />
              <Slider label="Right"  propKey="cropR" min={0} max={50} value={get('cropR')} fmt={v => `${v}%`} onChange={set} onCommit={commit} />
            </Accordion>

            <Accordion label="Speed" open={open.Speed} onToggle={() => toggle('Speed')} dirty={speedDirty}>
              <Slider
                label="Speed" propKey="speed" min={0.25} max={4} step={0.05}
                value={get('speed')} fmt={v => `${Number(v).toFixed(2)}×`}
                onChange={(key, val) => {
                  if (!clip) return
                  const oldSpeed = clip.speed ?? 1
                  const sourceContent = clip.durSec * oldSpeed
                  const newDurSec = Math.max(0.2, sourceContent / val)
                  setClips(prev => prev.map(c => c.id === clip.id ? { ...c, speed: val, durSec: newDurSec } : c))
                }}
                onCommit={commit}
              />
              <div className={styles.row}>
                <div className={styles.kfSpacer}/>
                <span className={styles.label}>Reverse</span>
                <button
                  className={styles.blendSelect}
                  onClick={() => { if (!clip) return; saveHistory(); updateClip(clip.id, { reversed: !get('reversed') }) }}
                  style={get('reversed') ? { color: 'var(--accent)', borderColor: 'rgba(108,99,255,0.5)', background: 'rgba(108,99,255,0.1)', cursor: 'pointer' } : { cursor: 'pointer' }}
                >
                  {get('reversed') ? '↩ On' : 'Off'}
                </button>
              </div>
            </Accordion>

            <Accordion label="Color" open={open.Color} onToggle={() => toggle('Color')} dirty={colorDirty}>
              <Slider label="Brightness" propKey="brightness" min={-100} max={100} value={get('brightness')} onChange={set} onCommit={commit} />
              <Slider label="Contrast"   propKey="contrast"   min={-100} max={100} value={get('contrast')}   onChange={set} onCommit={commit} />
              <Slider label="Saturation" propKey="saturation" min={-100} max={100} value={get('saturation')} onChange={set} onCommit={commit} />
              <Slider label="Hue"        propKey="hue"        min={-180} max={180} value={get('hue')} fmt={v => `${v}°`} onChange={set} onCommit={commit} />
            </Accordion>

            <Accordion label="Filters" open={open.Filters} onToggle={() => toggle('Filters')} dirty={filterDirty}>
              <Slider label="Blur"      propKey="blur"      min={0} max={20}  value={get('blur')}      fmt={v => `${v}px`} onChange={set} onCommit={commit} />
              <Slider label="Grayscale" propKey="grayscale" min={0} max={100} value={get('grayscale')} fmt={v => `${v}%`}  onChange={set} onCommit={commit} />
            </Accordion>

            <Accordion label="Adjust" open={open.Adjust} onToggle={() => toggle('Adjust')} dirty={adjustDirty}>
              <Slider label="Warmth" propKey="warmth" min={-100} max={100} value={get('warmth')} onChange={set} onCommit={commit} />
              <Slider label="Fade"   propKey="fade"   min={0}    max={100} value={get('fade')}   fmt={v => `${v}%`} onChange={set} onCommit={commit} />
              <Slider label="Fade In"  propKey="fadeIn"  min={0} max={5} step={0.1} value={get('fadeIn')}  fmt={v => `${v.toFixed(1)}s`} onChange={set} onCommit={commit} />
              <Slider label="Fade Out" propKey="fadeOut" min={0} max={5} step={0.1} value={get('fadeOut')} fmt={v => `${v.toFixed(1)}s`} onChange={set} onCommit={commit} />
            </Accordion>

            <Accordion label="Curves" open={open.Curves} onToggle={() => toggle('Curves')} dirty={curvesDirty}>
              {clip && (
                <CurvesEditor
                  curves={clip.curves ?? {}}
                  onChange={(channel, pts) => {
                    setCurve(clip.id, channel, pts)
                  }}
                />
              )}
            </Accordion>

            <Accordion label="Transition" open={open.Transition} onToggle={() => toggle('Transition')} dirty={transitionDirty}>
              <div className={styles.row}>
                <div className={styles.kfSpacer}/>
                <span className={styles.label}>Type</span>
                <select
                  className={styles.blendSelect}
                  value={clip?.transitionIn?.type ?? 'none'}
                  onChange={e => {
                    if (!clip) return
                    const type = e.target.value
                    saveHistory()
                    updateClip(clip.id, { transitionIn: type === 'none' ? null : { type, dur: clip.transitionIn?.dur ?? 0.5 } })
                  }}
                >
                  <option value="none">None</option>
                  <option value="dissolve">Dissolve</option>
                </select>
              </div>
              {clip?.transitionIn && (
                <div className={styles.row}>
                  <div className={styles.kfSpacer}/>
                  <span className={styles.label}>Duration</span>
                  <input
                    type="range" min={0.1} max={3} step={0.1}
                    value={clip.transitionIn.dur ?? 0.5}
                    className={styles.slider}
                    style={{ '--val': `${Math.round(((clip.transitionIn.dur ?? 0.5) - 0.1) / 2.9 * 100)}%` }}
                    onChange={e => updateClip(clip.id, { transitionIn: { ...clip.transitionIn, dur: Number(e.target.value) } })}
                    onMouseUp={commit}
                  />
                  <span className={styles.value}>{(clip.transitionIn.dur ?? 0.5).toFixed(1)}s</span>
                </div>
              )}
            </Accordion>
          </>
        )}

        {tab === 'Video' && clip?.type === 'caption' && (
          <CaptionProps clip={clip} set={set} commit={commit} saveHistory={saveHistory} />
        )}

        {tab === 'Audio' && (
          <>
            {(!clip || clip.type !== 'audio') && (
              <div className={styles.placeholder}>Select an audio clip in the timeline to adjust audio properties.</div>
            )}
            {clip?.type === 'audio' && (
              <>
                <div className={styles.sectionHeader}><span className={styles.sectionTitle}>Audio</span></div>
                <Slider label="Fade In"  propKey="fadeIn"  min={0} max={5} step={0.1} value={get('fadeIn')}  fmt={v => `${v.toFixed(1)}s`} onChange={set} onCommit={commit} />
                <Slider label="Fade Out" propKey="fadeOut" min={0} max={5} step={0.1} value={get('fadeOut')} fmt={v => `${v.toFixed(1)}s`} onChange={set} onCommit={commit} />
              </>
            )}
          </>
        )}
        {tab === 'Text' && (
          <div className={styles.placeholder}>Select a text clip in the timeline to edit text properties.</div>
        )}
        {tab === 'Element' && (
          <div className={styles.placeholder}>Element properties coming soon.</div>
        )}
      </div>
    </div>
  )
}
