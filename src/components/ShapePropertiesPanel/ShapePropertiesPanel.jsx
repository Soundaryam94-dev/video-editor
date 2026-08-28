import React, { useRef, useEffect } from 'react'
import styles from './ShapePropertiesPanel.module.css'
import { useEditorStore } from '../../store/editorStore'

const PRESET_COLORS = [
  '#6c63ff', '#a855f7', '#3b82f6', '#14b8a6', '#22c55e',
  '#f59e0b', '#f97316', '#ef4444', '#ffffff', '#000000',
]

const pct = (v, min, max) => `${Math.round(((v - min) / (max - min)) * 100)}%`

function ColorPicker({ value, onChange }) {
  const ref = useRef()
  const safeVal = (value === 'transparent' || !value) ? '#6c63ff' : value
  return (
    <div className={styles.colorPicker}>
      <div className={styles.presets}>
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            className={`${styles.preset} ${safeVal === c ? styles.presetSel : ''}`}
            style={{ background: c, border: c === '#ffffff' ? '1px solid rgba(255,255,255,0.2)' : undefined }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
      <div className={styles.customWrap}>
        <div
          className={styles.customSwatch}
          style={{ background: safeVal }}
          onClick={() => ref.current?.click()}
        />
        <input
          ref={ref}
          type="color"
          value={safeVal}
          onChange={e => onChange(e.target.value)}
          className={styles.hiddenColor}
        />
        <span className={styles.hexVal}>{safeVal.toUpperCase()}</span>
      </div>
    </div>
  )
}

function SliderRow({ label, min, max, step = 1, value, fmt, onChange, onCommit }) {
  return (
    <div className={styles.sliderRow}>
      <span className={styles.rowLabel}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        className={styles.slider}
        style={{ '--val': pct(value, min, max) }}
        onChange={e => onChange(Number(e.target.value))}
        onMouseUp={onCommit} onTouchEnd={onCommit}
      />
      <span className={styles.sliderVal}>{fmt ? fmt(value) : value}</span>
    </div>
  )
}

function NumField({ label, value, min, max, step = 1, unit, onChange }) {
  return (
    <div className={styles.numField}>
      <span className={styles.numLabel}>{label}</span>
      <div className={styles.numWrap}>
        <input
          type="number"
          className={styles.numInput}
          value={value}
          min={min} max={max} step={step}
          onChange={e => onChange(Number(e.target.value))}
        />
        {unit && <span className={styles.numUnit}>{unit}</span>}
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className={styles.toggleTrack}>
        <span className={styles.toggleThumb} />
      </span>
    </label>
  )
}

export default function ShapePropertiesPanel() {
  const clips           = useEditorStore(s => s.clips)
  const selectedId      = useEditorStore(s => s.selectedClipId)
  const updateClip      = useEditorStore(s => s.updateClip)
  const saveHistory     = useEditorStore(s => s.saveHistory)
  const setClips        = useEditorStore(s => s.setClips)
  const setSelectedClip = useEditorStore(s => s.setSelectedClip)

  const clip = clips.find(c => c.id === selectedId && c.type === 'shape') ?? null

  // Delete key removes the selected shape
  useEffect(() => {
    const onKey = e => {
      if (!clip) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        saveHistory()
        setClips(prev => prev.filter(c => c.id !== clip.id))
        setSelectedClip(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clip, saveHistory, setClips, setSelectedClip])

  if (!clip) return null

  const get    = (key, def) => clip[key] ?? def
  const set    = (key, val) => updateClip(clip.id, { [key]: val })
  const commit = () => saveHistory()

  const hasFill       = get('fillColor', '#6c63ff') !== 'transparent'
  const strokeEnabled = (get('strokeWidth', 0) > 0) && (get('strokeColor', 'transparent') !== 'transparent')

  const handleDelete = () => {
    saveHistory()
    setClips(prev => prev.filter(c => c.id !== clip.id))
    setSelectedClip(null)
  }

  const handleDuplicate = () => {
    saveHistory()
    const dup = { ...clip, id: `elem-${Date.now()}`, posX: Math.min(95, clip.posX + 4), posY: Math.min(95, clip.posY + 4) }
    setClips(prev => [...prev, dup])
    setSelectedClip(dup.id)
  }

  const TYPE_LABEL = {
    rectangle: 'Rectangle', roundedRect: 'Rounded Rect', circle: 'Circle',
    triangle: 'Triangle', star: 'Star', pentagon: 'Pentagon', diamond: 'Diamond',
    heart: 'Heart', hexagon: 'Hexagon', cross: 'Cross', arrowShape: 'Arrow',
    line: 'Line', dashedLine: 'Dashed Line', arrow: 'Arrow →', doubleArrow: 'Arrow ↔',
    frameRect: 'Rect Frame', frameRounded: 'Rounded Frame', frameCircle: 'Circle Frame',
    frameHeart: 'Heart Frame', frameArch: 'Arch Frame',
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Shape</span>
        <span className={styles.typeTag}>{TYPE_LABEL[clip.shapeType] ?? clip.shapeType}</span>
      </div>

      <div className={styles.body}>
        {/* ── Fill ── */}
        <div className={styles.section}>
          <div className={styles.sectionRow}>
            <span className={styles.sectionTitle}>Fill</span>
            <Toggle
              checked={hasFill}
              onChange={v => {
                set('fillColor', v ? '#6c63ff' : 'transparent')
                commit()
              }}
            />
          </div>
          {hasFill && (
            <>
              <ColorPicker
                value={get('fillColor', '#6c63ff')}
                onChange={v => { set('fillColor', v); commit() }}
              />
              <SliderRow
                label="Opacity"
                min={0} max={1} step={0.01}
                value={get('fillOpacity', 0.9)}
                fmt={v => `${Math.round(v * 100)}%`}
                onChange={v => set('fillOpacity', v)}
                onCommit={commit}
              />
            </>
          )}
        </div>

        {/* ── Text ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Text</div>
          <textarea
            className={styles.textArea}
            placeholder="Add text inside shape…"
            value={get('text', '')}
            rows={2}
            onChange={e => set('text', e.target.value)}
            onBlur={commit}
          />
          <div className={styles.textStyleRow}>
            {/* Bold */}
            <button
              className={`${styles.styleBtn} ${get('textBold', false) ? styles.styleBtnOn : ''}`}
              onClick={() => { set('textBold', !get('textBold', false)); commit() }}
              title="Bold"
            ><b>B</b></button>
            {/* Italic */}
            <button
              className={`${styles.styleBtn} ${get('textItalic', false) ? styles.styleBtnOn : ''}`}
              onClick={() => { set('textItalic', !get('textItalic', false)); commit() }}
              title="Italic"
            ><i>I</i></button>
            {/* Alignment */}
            {['left','center','right'].map(a => (
              <button
                key={a}
                className={`${styles.styleBtn} ${(get('textAlign','center') === a) ? styles.styleBtnOn : ''}`}
                onClick={() => { set('textAlign', a); commit() }}
                title={`Align ${a}`}
              >
                <svg viewBox="0 0 14 12" width="13" height="11" fill="currentColor">
                  {a === 'left'   && <><rect x="0" y="0" width="14" height="2" rx="1"/><rect x="0" y="4" width="9"  height="2" rx="1"/><rect x="0" y="8" width="11" height="2" rx="1"/></>}
                  {a === 'center' && <><rect x="0" y="0" width="14" height="2" rx="1"/><rect x="2.5" y="4" width="9"  height="2" rx="1"/><rect x="1.5" y="8" width="11" height="2" rx="1"/></>}
                  {a === 'right'  && <><rect x="0" y="0" width="14" height="2" rx="1"/><rect x="5" y="4" width="9"  height="2" rx="1"/><rect x="3" y="8" width="11" height="2" rx="1"/></>}
                </svg>
              </button>
            ))}
          </div>
          {/* Text color */}
          <ColorPicker
            value={get('textColor', '#ffffff')}
            onChange={v => { set('textColor', v); commit() }}
          />
          {/* Text size */}
          <SliderRow
            label="Size"
            min={5} max={60} step={1}
            value={get('textSize', 20)}
            fmt={v => `${v}%`}
            onChange={v => set('textSize', v)}
            onCommit={commit}
          />
        </div>

        {/* ── Stroke ── */}
        <div className={styles.section}>
          <div className={styles.sectionRow}>
            <span className={styles.sectionTitle}>Stroke</span>
            <Toggle
              checked={strokeEnabled}
              onChange={v => {
                if (v) { set('strokeColor', '#ffffff'); set('strokeWidth', 3) }
                else    { set('strokeWidth', 0) }
                commit()
              }}
            />
          </div>
          {strokeEnabled && (
            <>
              <ColorPicker
                value={get('strokeColor', '#ffffff')}
                onChange={v => { set('strokeColor', v); commit() }}
              />
              <SliderRow
                label="Width"
                min={1} max={24} step={1}
                value={get('strokeWidth', 3)}
                fmt={v => `${v}px`}
                onChange={v => set('strokeWidth', v)}
                onCommit={commit}
              />
            </>
          )}
        </div>

        {/* ── Size ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Size</div>
          <div className={styles.twoCol}>
            <NumField label="W" value={get('width', 40)} min={1} max={100} unit="%" onChange={v => { set('width', v); commit() }} />
            <NumField label="H" value={get('height', 25)} min={1} max={100} unit="%" onChange={v => { set('height', v); commit() }} />
          </div>
        </div>

        {/* ── Position ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Position</div>
          <div className={styles.twoCol}>
            <NumField label="X" value={Math.round(get('posX', 50))} min={0} max={100} unit="%" onChange={v => { set('posX', v); commit() }} />
            <NumField label="Y" value={Math.round(get('posY', 50))} min={0} max={100} unit="%" onChange={v => { set('posY', v); commit() }} />
          </div>
        </div>

        {/* ── Rotation & Opacity ── */}
        <div className={styles.section}>
          <SliderRow
            label="Rotation"
            min={-180} max={180} step={1}
            value={get('rotation', 0)}
            fmt={v => `${v}°`}
            onChange={v => set('rotation', v)}
            onCommit={commit}
          />
          <SliderRow
            label="Visibility"
            min={0} max={1} step={0.01}
            value={get('opacity', 1)}
            fmt={v => `${Math.round(v * 100)}%`}
            onChange={v => set('opacity', v)}
            onCommit={commit}
          />
        </div>

        {/* ── Timing ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Timing</div>
          <div className={styles.twoCol}>
            <NumField
              label="Start" value={Number(get('startSec', 0).toFixed(1))}
              min={0} max={300} step={0.1} unit="s"
              onChange={v => { set('startSec', v); commit() }}
            />
            <NumField
              label="Dur" value={Number(get('durSec', 5).toFixed(1))}
              min={0.1} max={300} step={0.1} unit="s"
              onChange={v => { set('durSec', v); commit() }}
            />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <button className={styles.dupBtn} onClick={handleDuplicate}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>
              <path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2"/>
            </svg>
            Duplicate
          </button>
          <button className={styles.delBtn} onClick={handleDelete}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <path d="M2.5 4.5h11M6 4.5V3h4v1.5M3.5 4.5l1 9a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1l1-9"/>
              <line x1="6.5" y1="7" x2="6.5" y2="11"/>
              <line x1="9.5" y1="7" x2="9.5" y2="11"/>
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
