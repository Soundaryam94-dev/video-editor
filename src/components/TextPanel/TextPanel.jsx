import React, { useState, useRef } from 'react'
import styles from './TextPanel.module.css'
import { useEditorStore } from '../../store/editorStore'
import { formatMSS } from '../../utils/formatTime'

// ── Motion preset icons ────────────────────────────────────────────────────
const IcoNone      = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><line x1="3" y1="8" x2="13" y2="8"/></svg>
const IcoFadeIn    = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2"  y1="4" x2="2"  y2="12" strokeOpacity="0.15"/><line x1="6"  y1="4" x2="6"  y2="12" strokeOpacity="0.4"/><line x1="10" y1="4" x2="10" y2="12" strokeOpacity="0.7"/><line x1="14" y1="4" x2="14" y2="12"/></svg>
const IcoFadeOut   = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2"  y1="4" x2="2"  y2="12"/><line x1="6"  y1="4" x2="6"  y2="12" strokeOpacity="0.7"/><line x1="10" y1="4" x2="10" y2="12" strokeOpacity="0.4"/><line x1="14" y1="4" x2="14" y2="12" strokeOpacity="0.15"/></svg>
const IcoFromLeft  = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="8" x2="11" y2="8"/><polyline points="8,5 11,8 8,11"/><line x1="13" y1="3" x2="13" y2="13" strokeDasharray="1.5 1.5" strokeOpacity="0.4"/></svg>
const IcoFromRight = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="3" x2="3" y2="13" strokeDasharray="1.5 1.5" strokeOpacity="0.4"/><line x1="5" y1="8" x2="15" y2="8"/><polyline points="8,5 5,8 8,11"/></svg>
const IcoRise      = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="14" x2="13" y2="14" strokeDasharray="1.5 1.5" strokeOpacity="0.4"/><line x1="8" y1="14" x2="8" y2="4"/><polyline points="5,7 8,4 11,7"/></svg>
const IcoDrop      = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="2" x2="13" y2="2" strokeDasharray="1.5 1.5" strokeOpacity="0.4"/><line x1="8" y1="2" x2="8" y2="12"/><polyline points="5,9 8,12 11,9"/></svg>
const IcoZoomIn    = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><polyline points="1,5 1,1 5,1"/><polyline points="11,1 15,1 15,5"/><polyline points="1,11 1,15 5,15"/><polyline points="15,11 15,15 11,15"/></svg>
const IcoBounce    = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 13 Q4 2 7 8 Q10 14 13 7 Q14 4 15 5"/><circle cx="15" cy="5" r="1.3" fill="currentColor" stroke="none"/></svg>
const IcoExitLeft  = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="3" x2="3" y2="13" strokeDasharray="1.5 1.5" strokeOpacity="0.4"/><line x1="15" y1="8" x2="5" y2="8"/><polyline points="8,5 5,8 8,11"/></svg>
const IcoExitRight = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="8" x2="11" y2="8"/><polyline points="8,5 11,8 8,11"/><line x1="13" y1="3" x2="13" y2="13" strokeDasharray="1.5 1.5" strokeOpacity="0.4"/></svg>
const IcoExitUp    = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="2" x2="13" y2="2" strokeDasharray="1.5 1.5" strokeOpacity="0.4"/><line x1="8" y1="14" x2="8" y2="4"/><polyline points="5,7 8,4 11,7"/></svg>
const IcoExitDown  = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="2" x2="8" y2="12"/><polyline points="5,9 8,12 11,9"/><line x1="3" y1="14" x2="13" y2="14" strokeDasharray="1.5 1.5" strokeOpacity="0.4"/></svg>
const IcoZoomOut   = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><polyline points="1,5 1,1 5,1"/><polyline points="11,1 15,1 15,5"/><polyline points="1,11 1,15 5,15"/><polyline points="15,11 15,15 11,15"/><line x1="1" y1="1" x2="5" y2="5"/><line x1="15" y1="1" x2="11" y2="5"/><line x1="1" y1="15" x2="5" y2="11"/><line x1="15" y1="15" x2="11" y2="11"/></svg>

const MOTION_IN_PRESETS = [
  { id: 'none',       label: 'None',    Icon: IcoNone      },
  { id: 'fade',       label: 'Fade',    Icon: IcoFadeIn    },
  { id: 'slideLeft',  label: 'Left',    Icon: IcoFromLeft  },
  { id: 'slideRight', label: 'Right',   Icon: IcoFromRight },
  { id: 'slideUp',    label: 'Rise',    Icon: IcoRise      },
  { id: 'slideDown',  label: 'Drop',    Icon: IcoDrop      },
  { id: 'zoomIn',     label: 'Zoom In', Icon: IcoZoomIn    },
  { id: 'bounceIn',   label: 'Bounce',  Icon: IcoBounce    },
]
const MOTION_OUT_PRESETS = [
  { id: 'none',       label: 'None',     Icon: IcoNone      },
  { id: 'fade',       label: 'Fade',     Icon: IcoFadeOut   },
  { id: 'slideLeft',  label: 'Left',     Icon: IcoExitLeft  },
  { id: 'slideRight', label: 'Right',    Icon: IcoExitRight },
  { id: 'slideUp',    label: 'Up',       Icon: IcoExitUp    },
  { id: 'slideDown',  label: 'Down',     Icon: IcoExitDown  },
  { id: 'zoomOut',    label: 'Zoom Out', Icon: IcoZoomOut   },
]

// ── Font list ──────────────────────────────────────────────────────────────
const FONTS = [
  'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
  'Courier New', 'Georgia', 'Impact', 'Segoe UI', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana',
]

// ── Icons ──────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
  </svg>
)
const ChevronIcon = ({ open }) => (
  <svg viewBox="0 0 10 6" fill="currentColor" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
    <path d="M0 0l5 6 5-6z"/>
  </svg>
)
const AlignLeftIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="7" x2="9" y2="7"/><line x1="1" y1="11" x2="11" y2="11"/>
  </svg>
)
const AlignCenterIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="7" x2="11" y2="7"/><line x1="2" y1="11" x2="12" y2="11"/>
  </svg>
)
const AlignRightIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="7" x2="13" y2="7"/><line x1="3" y1="11" x2="13" y2="11"/>
  </svg>
)
const TextIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
    <line x1="8" y1="10" x2="32" y2="10"/><line x1="20" y1="10" x2="20" y2="32"/>
    <line x1="12" y1="32" x2="28" y2="32"/>
  </svg>
)

// ── Helpers ────────────────────────────────────────────────────────────────
let _tid = 0
const newTextId = () => `txt-${++_tid}-${Date.now()}`

// Convert seconds to M:SS.s display format
function secToMMSS(s) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}

// Parse "M:SS" or "SS.s" string to seconds (returns null on bad input)
function parseTimeStr(str) {
  const t = str.trim()
  if (t.includes(':')) {
    const [m, s] = t.split(':')
    const v = (parseInt(m, 10) || 0) * 60 + (parseFloat(s) || 0)
    return isNaN(v) ? null : Math.max(0, v)
  }
  const v = parseFloat(t)
  return isNaN(v) ? null : Math.max(0, v)
}


// ── Sub-components ─────────────────────────────────────────────────────────

function ColorSwatch({ value, onChange, label }) {
  const inputRef = useRef(null)
  return (
    <div className={styles.colorRow}>
      {label && <span className={styles.colorLabel}>{label}</span>}
      <button
        className={styles.colorSwatch}
        style={{ background: value }}
        onClick={() => inputRef.current?.click()}
        title={value}
      />
      <input
        ref={inputRef}
        type="color"
        value={value.startsWith('rgba') ? '#000000' : value}
        onChange={e => onChange(e.target.value)}
        className={styles.colorInput}
      />
    </div>
  )
}

function NumericInput({ label, value, onChange, min = 0, max = 9999, step = 1, unit = '' }) {
  return (
    <div className={styles.numRow}>
      {label && <span className={styles.numLabel}>{label}</span>}
      <div className={styles.numWrap}>
        <input
          type="number"
          className={styles.numInput}
          value={value}
          min={min} max={max} step={step}
          onChange={e => {
            const v = Number(e.target.value)
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
          }}
        />
        {unit && <span className={styles.numUnit}>{unit}</span>}
      </div>
    </div>
  )
}

function SliderRow({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }) {
  return (
    <div className={styles.sliderRow}>
      <span className={styles.sliderLabel}>{label}</span>
      <input
        type="range"
        className={styles.slider}
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ '--val': `${((value - min) / (max - min)) * 100}%` }}
      />
      <span className={styles.sliderVal}>{value}{unit}</span>
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

function TimingRow({ label, value, onChange, readOnly = false }) {
  const [editing, setEditing] = React.useState(false)
  const [raw, setRaw] = React.useState('')
  if (readOnly) {
    return (
      <div className={styles.timingRow}>
        <span className={styles.sliderLabel}>{label}</span>
        <span className={styles.timingReadonly}>{secToMMSS(value)}</span>
      </div>
    )
  }
  return (
    <div className={styles.timingRow}>
      <span className={styles.sliderLabel}>{label}</span>
      {editing ? (
        <input
          type="text"
          className={styles.timingEdit}
          value={raw}
          autoFocus
          placeholder="M:SS or S"
          onChange={e => setRaw(e.target.value)}
          onBlur={() => {
            const v = parseTimeStr(raw)
            if (v !== null) onChange(v)
            setEditing(false)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <button
          className={styles.timingDisplay}
          onClick={() => { setRaw(secToMMSS(value)); setEditing(true) }}
          title="Click to edit (M:SS or seconds)"
        >
          {secToMMSS(value)}
        </button>
      )}
    </div>
  )
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={() => setOpen(p => !p)}>
        <span className={styles.sectionTitle}>{title}</span>
        <ChevronIcon open={open} />
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function TextPanel() {
  const clips           = useEditorStore(s => s.clips)
  const setClips        = useEditorStore(s => s.setClips)
  const selectedClipId  = useEditorStore(s => s.selectedClipId)
  const setSelectedClip = useEditorStore(s => s.setSelectedClip)
  const saveHistory     = useEditorStore(s => s.saveHistory)
  const updateTextClip  = useEditorStore(s => s.updateTextClip)
  const currentTime     = useEditorStore(s => s.currentTime)
  const setCurrentTime  = useEditorStore(s => s.setCurrentTime)

  const [editorTab, setEditorTab] = useState('style')

  const textClips = clips.filter(c => c.type === 'text')
  const selected  = textClips.find(c => c.id === selectedClipId) ?? null

  // ── Add Title ──────────────────────────────────────────────────────────
  const handleAddTitle = () => {
    saveHistory()
    const id = newTextId()
    const clip = {
      id,
      track:          'text',
      startSec:       currentTime,
      durSec:         5,
      type:           'text',
      name:           'Title',
      label:          'Title',
      textContent:    'Title Text',
      fontFamily:     'Arial',
      fontSize:       72,
      fontWeight:     '700',
      fontStyle:      'normal',
      textDecoration: 'none',
      textAlign:      'center',
      color:          '#ffffff',
      strokeEnabled:  false,
      strokeWidth:    3,
      strokeColor:    '#000000',
      shadowEnabled:  false,
      shadowColor:    '#000000',
      shadowOpacity:  0.75,
      shadowX:        2,
      shadowY:        4,
      shadowBlur:     8,
      bgEnabled:      false,
      bgColor:        '#000000',
      bgOpacity:      0.6,
      bgPadding:      8,
      posX:           50,
      posY:           85,
      scale:          100,
      rotation:       0,
      opacity:        1,
      motionIn:       'none',
      motionOut:      'none',
      motionInDur:    0.5,
      motionOutDur:   0.5,
    }
    setClips(prev => [...prev, clip])
    setSelectedClip(id)
  }

  // ── Update helpers ─────────────────────────────────────────────────────
  // Live update — no history (used while typing or dragging sliders)
  const upd = (key, val) => {
    if (!selected) return
    updateTextClip(selected.id, { [key]: val })
  }
  // Discrete update — saves a history snapshot before changing
  const updH = (key, val) => {
    if (!selected) return
    saveHistory()
    updateTextClip(selected.id, { [key]: val })
  }

  // ── Style editor ───────────────────────────────────────────────────────
  const renderStyleTab = () => (
    <div className={styles.tabContent}>

      {/* Text content */}
      <Section title="Content">
        <textarea
          className={styles.textArea}
          value={selected.textContent}
          onChange={e => upd('textContent', e.target.value)}
          onBlur={() => saveHistory()}
          rows={3}
          placeholder="Enter text…"
          spellCheck={false}
        />
      </Section>

      {/* Typography */}
      <Section title="Typography">
        {/* Font family */}
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={selected.fontFamily}
            onChange={e => updH('fontFamily', e.target.value)}
            style={{ fontFamily: selected.fontFamily }}
          >
            {FONTS.map(f => (
              <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
            ))}
          </select>
          <svg className={styles.selectCaret} viewBox="0 0 10 6" fill="currentColor"><path d="M0 0l5 6 5-6z"/></svg>
        </div>

        {/* Size + style buttons */}
        <div className={styles.fontRow}>
          <div className={styles.sizeWrap}>
            <span className={styles.numLabel}>Size</span>
            <input
              type="number"
              className={styles.sizeInput}
              value={selected.fontSize}
              min={8} max={400} step={1}
              onChange={e => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v)) updH('fontSize', Math.max(8, Math.min(400, v)))
              }}
            />
          </div>
          <div className={styles.styleButtons}>
            <button
              className={`${styles.styleBtn} ${selected.fontWeight === '700' ? styles.styleBtnActive : ''}`}
              title="Bold"
              onClick={() => updH('fontWeight', selected.fontWeight === '700' ? '400' : '700')}
            ><b>B</b></button>
            <button
              className={`${styles.styleBtn} ${selected.fontStyle === 'italic' ? styles.styleBtnActive : ''}`}
              title="Italic"
              onClick={() => updH('fontStyle', selected.fontStyle === 'italic' ? 'normal' : 'italic')}
            ><i>I</i></button>
            <button
              className={`${styles.styleBtn} ${selected.textDecoration === 'underline' ? styles.styleBtnActive : ''}`}
              title="Underline"
              onClick={() => updH('textDecoration', selected.textDecoration === 'underline' ? 'none' : 'underline')}
            ><u>U</u></button>
          </div>
        </div>

        {/* Alignment */}
        <div className={styles.alignRow}>
          {[
            { val: 'left',   Icon: AlignLeftIcon,   title: 'Align Left' },
            { val: 'center', Icon: AlignCenterIcon,  title: 'Align Center' },
            { val: 'right',  Icon: AlignRightIcon,   title: 'Align Right' },
          ].map(({ val, Icon, title }) => (
            <button
              key={val}
              className={`${styles.alignBtn} ${selected.textAlign === val ? styles.alignBtnActive : ''}`}
              title={title}
              onClick={() => updH('textAlign', val)}
            >
              <Icon />
            </button>
          ))}
        </div>

        {/* Color + opacity */}
        <div className={styles.colorOpacityRow}>
          <div className={styles.colorField}>
            <span className={styles.fieldLabel}>Color</span>
            <div className={styles.colorSwatchWrap}>
              <button
                className={styles.colorSwatch}
                style={{ background: selected.color }}
                onClick={() => document.getElementById(`clr-fill-${selected.id}`)?.click()}
              />
              <input id={`clr-fill-${selected.id}`} type="color" value={selected.color} onChange={e => updH('color', e.target.value)} className={styles.colorInput} />
            </div>
          </div>
          <div className={styles.opacityField}>
            <span className={styles.fieldLabel}>Opacity</span>
            <div className={styles.numWrap}>
              <input
                type="number"
                className={styles.numInput}
                value={Math.round(selected.opacity * 100)}
                min={0} max={100} step={1}
                onChange={e => upd('opacity', Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
              />
              <span className={styles.numUnit}>%</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Stroke */}
      <Section title="Stroke" defaultOpen={false}>
        <div className={styles.toggleRow}>
          <span className={styles.fieldLabel}>Enable</span>
          <Toggle checked={selected.strokeEnabled} onChange={v => updH('strokeEnabled', v)} />
        </div>
        {selected.strokeEnabled && (
          <>
            <div className={styles.colorField} style={{ marginTop: 8 }}>
              <span className={styles.fieldLabel}>Color</span>
              <div className={styles.colorSwatchWrap}>
                <button
                  className={styles.colorSwatch}
                  style={{ background: selected.strokeColor }}
                  onClick={() => document.getElementById(`clr-stk-${selected.id}`)?.click()}
                />
                <input id={`clr-stk-${selected.id}`} type="color" value={selected.strokeColor} onChange={e => updH('strokeColor', e.target.value)} className={styles.colorInput} />
              </div>
            </div>
            <SliderRow label="Width" value={selected.strokeWidth} onChange={v => upd('strokeWidth', v)} min={1} max={20} unit="px" />
          </>
        )}
      </Section>

      {/* Shadow */}
      <Section title="Shadow" defaultOpen={false}>
        <div className={styles.toggleRow}>
          <span className={styles.fieldLabel}>Enable</span>
          <Toggle checked={selected.shadowEnabled} onChange={v => updH('shadowEnabled', v)} />
        </div>
        {selected.shadowEnabled && (
          <>
            <div className={styles.colorField} style={{ marginTop: 8 }}>
              <span className={styles.fieldLabel}>Color</span>
              <div className={styles.colorSwatchWrap}>
                <button
                  className={styles.colorSwatch}
                  style={{ background: selected.shadowColor }}
                  onClick={() => document.getElementById(`clr-shd-${selected.id}`)?.click()}
                />
                <input id={`clr-shd-${selected.id}`} type="color" value={selected.shadowColor} onChange={e => updH('shadowColor', e.target.value)} className={styles.colorInput} />
              </div>
            </div>
            <SliderRow label="Opacity" value={Math.round(selected.shadowOpacity * 100)} onChange={v => upd('shadowOpacity', v / 100)} min={0} max={100} unit="%" />
            <div className={styles.twoCol}>
              <NumericInput label="X" value={selected.shadowX} onChange={v => upd('shadowX', v)} min={-50} max={50} unit="px" />
              <NumericInput label="Y" value={selected.shadowY} onChange={v => upd('shadowY', v)} min={-50} max={50} unit="px" />
            </div>
            <SliderRow label="Blur" value={selected.shadowBlur} onChange={v => upd('shadowBlur', v)} min={0} max={40} unit="px" />
          </>
        )}
      </Section>

      {/* Background */}
      <Section title="Background" defaultOpen={false}>
        <div className={styles.toggleRow}>
          <span className={styles.fieldLabel}>Enable</span>
          <Toggle checked={selected.bgEnabled} onChange={v => updH('bgEnabled', v)} />
        </div>
        {selected.bgEnabled && (
          <>
            <div className={styles.colorField} style={{ marginTop: 8 }}>
              <span className={styles.fieldLabel}>Color</span>
              <div className={styles.colorSwatchWrap}>
                <button
                  className={styles.colorSwatch}
                  style={{ background: selected.bgColor }}
                  onClick={() => document.getElementById(`clr-bg-${selected.id}`)?.click()}
                />
                <input id={`clr-bg-${selected.id}`} type="color" value={selected.bgColor} onChange={e => updH('bgColor', e.target.value)} className={styles.colorInput} />
              </div>
            </div>
            <SliderRow label="Opacity" value={Math.round(selected.bgOpacity * 100)} onChange={v => upd('bgOpacity', v / 100)} min={0} max={100} unit="%" />
            <SliderRow label="Padding" value={selected.bgPadding} onChange={v => upd('bgPadding', v)} min={0} max={40} unit="px" />
          </>
        )}
      </Section>
    </div>
  )

  // ── Transform tab ──────────────────────────────────────────────────────
  const renderTransformTab = () => (
    <div className={styles.tabContent}>
      <Section title="Timing">
        <TimingRow
          label="Start"
          value={selected.startSec ?? 0}
          onChange={v => { saveHistory(); updateTextClip(selected.id, { startSec: v }) }}
        />
        <TimingRow
          label="Duration"
          value={selected.durSec ?? 5}
          onChange={v => { saveHistory(); updateTextClip(selected.id, { durSec: Math.max(0.1, v) }) }}
        />
        <TimingRow
          label="End"
          value={(selected.startSec ?? 0) + (selected.durSec ?? 5)}
          readOnly
        />
      </Section>
      <Section title="Position">
        <SliderRow label="X" value={selected.posX} onChange={v => upd('posX', v)} min={0} max={100} unit="%" />
        <SliderRow label="Y" value={selected.posY} onChange={v => upd('posY', v)} min={0} max={100} unit="%" />
      </Section>
      <Section title="Transform">
        <SliderRow label="Scale" value={selected.scale} onChange={v => upd('scale', v)} min={10} max={300} unit="%" />
        <SliderRow label="Rotation" value={selected.rotation} onChange={v => upd('rotation', v)} min={-180} max={180} unit="°" />
        <SliderRow label="Opacity" value={Math.round(selected.opacity * 100)} onChange={v => upd('opacity', v / 100)} min={0} max={100} unit="%" />
      </Section>
    </div>
  )

  // ── Motion tab ─────────────────────────────────────────────────────────
  const renderMotionTab = () => (
    <div className={styles.tabContent}>
      <Section title="Entrance">
        <div className={styles.motionGrid}>
          {MOTION_IN_PRESETS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`${styles.motionPreset} ${(selected.motionIn ?? 'none') === id ? styles.motionPresetActive : ''}`}
              onClick={() => updH('motionIn', id)}
              title={label}
            >
              <Icon />
              <span className={styles.motionLabel}>{label}</span>
            </button>
          ))}
        </div>
        {(selected.motionIn ?? 'none') !== 'none' && (
          <SliderRow
            label="Duration"
            value={selected.motionInDur ?? 0.5}
            onChange={v => upd('motionInDur', v)}
            min={0.1} max={2} step={0.05}
            unit="s"
          />
        )}
      </Section>
      <Section title="Exit">
        <div className={styles.motionGrid}>
          {MOTION_OUT_PRESETS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`${styles.motionPreset} ${(selected.motionOut ?? 'none') === id ? styles.motionPresetActive : ''}`}
              onClick={() => updH('motionOut', id)}
              title={label}
            >
              <Icon />
              <span className={styles.motionLabel}>{label}</span>
            </button>
          ))}
        </div>
        {(selected.motionOut ?? 'none') !== 'none' && (
          <SliderRow
            label="Duration"
            value={selected.motionOutDur ?? 0.5}
            onChange={v => upd('motionOutDur', v)}
            min={0.1} max={2} step={0.05}
            unit="s"
          />
        )}
      </Section>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Text</span>
        <button className={styles.addBtn} onClick={handleAddTitle} title="Add new title to timeline">
          <PlusIcon />
          Add Title
        </button>
      </div>

      {/* Clip list */}
      <div className={styles.clipListWrap}>
        {textClips.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><TextIcon /></div>
            <p className={styles.emptyTitle}>No titles yet</p>
            <p className={styles.emptyHint}>Click "Add Title" to create a text overlay</p>
          </div>
        ) : (
          <div className={styles.clipList}>
            {textClips.map(clip => (
              <button
                key={clip.id}
                className={`${styles.clipItem} ${selectedClipId === clip.id ? styles.clipItemSel : ''}`}
                onClick={() => {
                  setSelectedClip(clip.id)
                  // Seek preview to clip start if outside its time range
                  if (currentTime < clip.startSec || currentTime >= clip.startSec + clip.durSec) {
                    setCurrentTime(clip.startSec)
                  }
                }}
              >
                <div
                  className={styles.clipPreviewText}
                  style={{
                    fontFamily: clip.fontFamily,
                    fontWeight: clip.fontWeight,
                    fontStyle: clip.fontStyle,
                    color: clip.color,
                  }}
                >
                  {clip.textContent || 'Empty'}
                </div>
                <div className={styles.clipMeta}>
                  <span className={styles.clipName}>{clip.textContent ? clip.textContent.split('\n')[0].slice(0, 18) : 'No text'}</span>
                  <span className={styles.clipDur} title="Start time in timeline">@ {formatMSS(clip.startSec)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor — shown when a text clip is selected */}
      {selected && (
        <div className={styles.editor}>
          <div className={styles.editorTabs}>
            {['style', 'transform', 'motion'].map(t => (
              <button
                key={t}
                className={`${styles.editorTab} ${editorTab === t ? styles.editorTabActive : ''}`}
                onClick={() => setEditorTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className={styles.editorScroll}>
            {editorTab === 'style' ? renderStyleTab()
              : editorTab === 'transform' ? renderTransformTab()
              : renderMotionTab()}
          </div>
        </div>
      )}
    </div>
  )
}
