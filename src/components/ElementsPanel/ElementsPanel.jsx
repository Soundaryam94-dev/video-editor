import React, { useState, useMemo } from 'react'
import styles from './ElementsPanel.module.css'
import { useEditorStore } from '../../store/editorStore'

let _eid = 0
const newElemId = () => `elem-${++_eid}-${Date.now()}`

// ── Default shape properties ───────────────────────────────────────────────
const OUTLINE_STROKE = '#6c63ff'
const OUTLINE_W      = 4

const OUTLINE_DEFAULTS = {
  rectangle:    { fillColor: 'transparent', fillOpacity: 0, strokeColor: OUTLINE_STROKE, strokeWidth: OUTLINE_W, width: 40, height: 25 },
  roundedRect:  { fillColor: 'transparent', fillOpacity: 0, strokeColor: OUTLINE_STROKE, strokeWidth: OUTLINE_W, width: 40, height: 25 },
  circle:       { fillColor: 'transparent', fillOpacity: 0, strokeColor: OUTLINE_STROKE, strokeWidth: OUTLINE_W, width: 28, height: 28 },
  triangle:     { fillColor: 'transparent', fillOpacity: 0, strokeColor: OUTLINE_STROKE, strokeWidth: OUTLINE_W, width: 30, height: 26 },
  star:         { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#f59e0b',      strokeWidth: OUTLINE_W, width: 28, height: 28 },
  heart:        { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#ef4444',      strokeWidth: OUTLINE_W, width: 28, height: 26 },
  pentagon:     { fillColor: 'transparent', fillOpacity: 0, strokeColor: OUTLINE_STROKE, strokeWidth: OUTLINE_W, width: 28, height: 28 },
  hexagon:      { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#14b8a6',      strokeWidth: OUTLINE_W, width: 28, height: 28 },
  diamond:      { fillColor: 'transparent', fillOpacity: 0, strokeColor: OUTLINE_STROKE, strokeWidth: OUTLINE_W, width: 22, height: 32 },
  cross:        { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#a855f7',      strokeWidth: OUTLINE_W, width: 28, height: 28 },
  arrowShape:   { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#3b82f6',      strokeWidth: OUTLINE_W, width: 42, height: 22 },
  parallelogram:{ fillColor: 'transparent', fillOpacity: 0, strokeColor: OUTLINE_STROKE, strokeWidth: OUTLINE_W, width: 38, height: 22 },
}

const DEFAULTS = {
  rectangle:    { fillColor: '#6c63ff', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 40, height: 25 },
  roundedRect:  { fillColor: '#6c63ff', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 40, height: 25 },
  circle:       { fillColor: '#6c63ff', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 28, height: 28 },
  triangle:     { fillColor: '#6c63ff', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 30, height: 26 },
  star:         { fillColor: '#f59e0b', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 28, height: 28 },
  pentagon:     { fillColor: '#6c63ff', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 28, height: 28 },
  diamond:      { fillColor: '#6c63ff', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 22, height: 32 },
  heart:        { fillColor: '#ef4444', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 28, height: 26 },
  hexagon:      { fillColor: '#14b8a6', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 28, height: 28 },
  cross:        { fillColor: '#a855f7', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 28, height: 28 },
  arrowShape:   { fillColor: '#3b82f6', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 42, height: 22 },
  parallelogram:{ fillColor: '#6c63ff', fillOpacity: 0.9, strokeColor: 'transparent', strokeWidth: 0,  width: 38, height: 22 },
  line:         { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#ffffff', strokeWidth: 4,    width: 50, height: 4  },
  dashedLine:   { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#9ca3c2', strokeWidth: 4,    width: 50, height: 4  },
  arrow:        { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#ffffff', strokeWidth: 4,    width: 50, height: 4  },
  doubleArrow:  { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#ffffff', strokeWidth: 4,    width: 50, height: 4  },
  frameRect:    { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#6c63ff', strokeWidth: 5,    width: 40, height: 25 },
  frameRounded: { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#6c63ff', strokeWidth: 5,    width: 40, height: 25 },
  frameCircle:  { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#6c63ff', strokeWidth: 5,    width: 28, height: 28 },
  frameHeart:   { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#ef4444', strokeWidth: 5,    width: 28, height: 26 },
  frameArch:    { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#6c63ff', strokeWidth: 5,    width: 28, height: 34 },
}

// ── Catalog ────────────────────────────────────────────────────────────────
const CATALOG = {
  shapes: [
    { id: 'rectangle',    label: 'Rect',       shapeType: 'rectangle',     tags: ['square'] },
    { id: 'circle',       label: 'Circle',     shapeType: 'circle',        tags: ['circle'] },
    { id: 'triangle',     label: 'Triangle',   shapeType: 'triangle',      tags: [] },
    { id: 'roundedRect',  label: 'Rounded',    shapeType: 'roundedRect',   tags: ['square'] },
    { id: 'star',         label: 'Star',       shapeType: 'star',          tags: ['star'] },
    { id: 'heart',        label: 'Heart',      shapeType: 'heart',         tags: ['heart'] },
    { id: 'pentagon',     label: 'Pentagon',   shapeType: 'pentagon',      tags: [] },
    { id: 'hexagon',      label: 'Hexagon',    shapeType: 'hexagon',       tags: [] },
    { id: 'diamond',      label: 'Diamond',    shapeType: 'diamond',       tags: [] },
    { id: 'cross',        label: 'Cross',      shapeType: 'cross',         tags: [] },
    { id: 'arrowShape',   label: 'Arrow',      shapeType: 'arrowShape',    tags: ['arrow'] },
    { id: 'parallelogram',label: 'Slant',      shapeType: 'parallelogram', tags: [] },
  ],
  lines: [
    { id: 'line',         label: 'Line',       shapeType: 'line',          tags: ['line'] },
    { id: 'dashedLine',   label: 'Dashed',     shapeType: 'dashedLine',    tags: ['line'] },
    { id: 'arrow',        label: 'Arrow →',    shapeType: 'arrow',         tags: ['arrow', 'line'] },
    { id: 'doubleArrow',  label: 'Arrow ↔',    shapeType: 'doubleArrow',   tags: ['arrow', 'line'] },
  ],
  frames: [
    { id: 'frameRect',    label: 'Rect',       shapeType: 'frameRect',     tags: ['frame', 'square'] },
    { id: 'frameRounded', label: 'Rounded',    shapeType: 'frameRounded',  tags: ['frame'] },
    { id: 'frameCircle',  label: 'Circle',     shapeType: 'frameCircle',   tags: ['frame', 'circle'] },
    { id: 'frameHeart',   label: 'Heart',      shapeType: 'frameHeart',    tags: ['frame', 'heart'] },
    { id: 'frameArch',    label: 'Arch',       shapeType: 'frameArch',     tags: ['frame'] },
  ],
  outlines: [
    { id: 'ol-rectangle',    label: 'Rect',       shapeType: 'rectangle',     outlined: true, tags: ['square'] },
    { id: 'ol-circle',       label: 'Circle',     shapeType: 'circle',        outlined: true, tags: ['circle'] },
    { id: 'ol-triangle',     label: 'Triangle',   shapeType: 'triangle',      outlined: true, tags: [] },
    { id: 'ol-roundedRect',  label: 'Rounded',    shapeType: 'roundedRect',   outlined: true, tags: ['square'] },
    { id: 'ol-star',         label: 'Star',       shapeType: 'star',          outlined: true, tags: ['star'] },
    { id: 'ol-heart',        label: 'Heart',      shapeType: 'heart',         outlined: true, tags: ['heart'] },
    { id: 'ol-pentagon',     label: 'Pentagon',   shapeType: 'pentagon',      outlined: true, tags: [] },
    { id: 'ol-hexagon',      label: 'Hexagon',    shapeType: 'hexagon',       outlined: true, tags: [] },
    { id: 'ol-diamond',      label: 'Diamond',    shapeType: 'diamond',       outlined: true, tags: [] },
    { id: 'ol-cross',        label: 'Cross',      shapeType: 'cross',         outlined: true, tags: [] },
    { id: 'ol-arrowShape',   label: 'Arrow',      shapeType: 'arrowShape',    outlined: true, tags: ['arrow'] },
    { id: 'ol-parallelogram',label: 'Slant',      shapeType: 'parallelogram', outlined: true, tags: [] },
  ],
}

const CHIPS = [
  { id: 'all',    label: 'All' },
  { id: 'arrow',  label: 'Arrow' },
  { id: 'line',   label: 'Line' },
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
  { id: 'frame',  label: 'Frame' },
  { id: 'heart',  label: 'Heart' },
  { id: 'star',   label: 'Star' },
]

// ── SVG thumbnails ─────────────────────────────────────────────────────────
function ShapeThumb({ shapeType, outlined = false }) {
  const v   = '0 0 64 46'
  const acc = '#6c63ff'
  const red = '#ef4444'
  const amb = '#f59e0b'
  const tel = '#14b8a6'
  const blu = '#3b82f6'
  const pur = '#a855f7'
  const wht = 'rgba(255,255,255,0.85)'
  const opa = '0.88'
  const sw  = '3.5'  // outline stroke-width for thumbnails

  // Outline (no-fill) variants
  if (outlined) {
    const strokeColor = OUTLINE_DEFAULTS[shapeType]?.strokeColor ?? acc
    const s = { fill: 'none', stroke: strokeColor, strokeWidth: sw, opacity: opa }
    switch (shapeType) {
      case 'rectangle':
        return <svg viewBox={v}><rect x="8" y="11" width="48" height="24" rx="2" {...s}/></svg>
      case 'roundedRect':
        return <svg viewBox={v}><rect x="8" y="11" width="48" height="24" rx="10" {...s}/></svg>
      case 'circle':
        return <svg viewBox={v}><ellipse cx="32" cy="23" rx="18" ry="18" {...s}/></svg>
      case 'triangle':
        return <svg viewBox={v}><polygon points="32,6 58,40 6,40" {...s}/></svg>
      case 'star':
        return <svg viewBox={v}><polygon {...s} points="32,5 37,18 51,18 40,27 44,40 32,32 20,40 24,27 13,18 27,18"/></svg>
      case 'heart':
        return <svg viewBox={v}><path {...s} d="M32 40 C10 28 6 12 14 8 C19 6 26 12 32 18 C38 12 45 6 50 8 C58 12 54 28 32 40 Z"/></svg>
      case 'pentagon':
        return <svg viewBox={v}><polygon {...s} points="32,5 58,22 48,42 16,42 6,22"/></svg>
      case 'hexagon':
        return <svg viewBox={v}><polygon {...s} points="32,5 54,16.5 54,29.5 32,41 10,29.5 10,16.5"/></svg>
      case 'diamond':
        return <svg viewBox={v}><polygon {...s} points="32,4 56,23 32,42 8,23"/></svg>
      case 'cross': {
        const cx = 32, cy = 23, aw = 10, bw = 6
        return (
          <svg viewBox={v}>
            <polygon {...s} points={
              `${cx-bw},${cy-aw} ${cx+bw},${cy-aw} ${cx+bw},${cy-bw} ${cx+aw},${cy-bw} ` +
              `${cx+aw},${cy+bw} ${cx+bw},${cy+bw} ${cx+bw},${cy+aw} ${cx-bw},${cy+aw} ` +
              `${cx-bw},${cy+bw} ${cx-aw},${cy+bw} ${cx-aw},${cy-bw} ${cx-bw},${cy-bw}`
            }/>
          </svg>
        )
      }
      case 'arrowShape':
        return <svg viewBox={v}><polygon {...s} points="6,17 44,17 44,10 58,23 44,36 44,29 6,29"/></svg>
      case 'parallelogram':
        return <svg viewBox={v}><polygon {...s} points="18,11 56,11 46,35 8,35"/></svg>
      default:
        return <svg viewBox={v}><rect x="8" y="9" width="48" height="28" rx="4" {...s}/></svg>
    }
  }

  // Filled variants (original)
  switch (shapeType) {
    case 'rectangle':
      return <svg viewBox={v}><rect x="8" y="11" width="48" height="24" rx="2" fill={acc} opacity={opa}/></svg>

    case 'roundedRect':
      return <svg viewBox={v}><rect x="8" y="11" width="48" height="24" rx="10" fill={acc} opacity={opa}/></svg>

    case 'circle':
      return <svg viewBox={v}><ellipse cx="32" cy="23" rx="18" ry="18" fill={acc} opacity={opa}/></svg>

    case 'triangle':
      return <svg viewBox={v}><polygon points="32,6 58,40 6,40" fill={acc} opacity={opa}/></svg>

    case 'star':
      return <svg viewBox={v}><polygon fill={amb} opacity={opa} points="32,5 37,18 51,18 40,27 44,40 32,32 20,40 24,27 13,18 27,18"/></svg>

    case 'heart':
      return <svg viewBox={v}><path fill={red} opacity={opa} d="M32 40 C10 28 6 12 14 8 C19 6 26 12 32 18 C38 12 45 6 50 8 C58 12 54 28 32 40 Z"/></svg>

    case 'pentagon':
      return <svg viewBox={v}><polygon fill={acc} opacity={opa} points="32,5 58,22 48,42 16,42 6,22"/></svg>

    case 'hexagon':
      return <svg viewBox={v}><polygon fill={tel} opacity={opa} points="32,5 54,16.5 54,29.5 32,41 10,29.5 10,16.5"/></svg>

    case 'diamond':
      return <svg viewBox={v}><polygon fill={acc} opacity={opa} points="32,4 56,23 32,42 8,23"/></svg>

    case 'cross': {
      const cx = 32, cy = 23, aw = 10, bw = 6
      return (
        <svg viewBox={v}>
          <polygon fill={pur} opacity={opa} points={
            `${cx-bw},${cy-aw} ${cx+bw},${cy-aw} ${cx+bw},${cy-bw} ${cx+aw},${cy-bw} ` +
            `${cx+aw},${cy+bw} ${cx+bw},${cy+bw} ${cx+bw},${cy+aw} ${cx-bw},${cy+aw} ` +
            `${cx-bw},${cy+bw} ${cx-aw},${cy+bw} ${cx-aw},${cy-bw} ${cx-bw},${cy-bw}`
          }/>
        </svg>
      )
    }

    case 'arrowShape':
      return <svg viewBox={v}><polygon fill={blu} opacity={opa} points="6,17 44,17 44,10 58,23 44,36 44,29 6,29"/></svg>

    case 'parallelogram':
      return <svg viewBox={v}><polygon fill={acc} opacity={opa} points="18,11 56,11 46,35 8,35"/></svg>

    /* ── Lines ── */
    case 'line':
      return <svg viewBox={v}><line x1="8" y1="23" x2="56" y2="23" stroke={wht} strokeWidth="4" strokeLinecap="round"/></svg>

    case 'dashedLine':
      return <svg viewBox={v}><line x1="8" y1="23" x2="56" y2="23" stroke="rgba(200,200,220,0.7)" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 5"/></svg>

    case 'arrow':
      return (
        <svg viewBox={v} fill={wht} stroke={wht}>
          <line x1="8" y1="23" x2="46" y2="23" strokeWidth="4" strokeLinecap="round"/>
          <polygon points="58,23 44,16 44,30"/>
        </svg>
      )

    case 'doubleArrow':
      return (
        <svg viewBox={v} fill={wht} stroke={wht}>
          <line x1="16" y1="23" x2="48" y2="23" strokeWidth="4" strokeLinecap="round"/>
          <polygon points="6,23 20,16 20,30"/>
          <polygon points="58,23 44,16 44,30"/>
        </svg>
      )

    /* ── Frames ── */
    case 'frameRect':
      return <svg viewBox={v}><rect x="8" y="9" width="48" height="28" rx="2" fill="none" stroke={acc} strokeWidth="3.5"/><line x1="8" y1="9" x2="56" y2="37" stroke={acc} strokeWidth="1" strokeOpacity="0.2"/><line x1="56" y1="9" x2="8" y2="37" stroke={acc} strokeWidth="1" strokeOpacity="0.2"/></svg>

    case 'frameRounded':
      return <svg viewBox={v}><rect x="8" y="9" width="48" height="28" rx="10" fill="none" stroke={acc} strokeWidth="3.5"/><line x1="15" y1="9" x2="49" y2="37" stroke={acc} strokeWidth="1" strokeOpacity="0.2"/><line x1="49" y1="9" x2="15" y2="37" stroke={acc} strokeWidth="1" strokeOpacity="0.2"/></svg>

    case 'frameCircle':
      return <svg viewBox={v}><ellipse cx="32" cy="23" rx="20" ry="20" fill="none" stroke={acc} strokeWidth="3.5"/><line x1="17.9" y1="8.9" x2="46.1" y2="37.1" stroke={acc} strokeWidth="1" strokeOpacity="0.2"/><line x1="46.1" y1="8.9" x2="17.9" y2="37.1" stroke={acc} strokeWidth="1" strokeOpacity="0.2"/></svg>

    case 'frameHeart':
      return <svg viewBox={v}><path fill="none" stroke={red} strokeWidth="3.5" d="M32 40 C10 28 6 12 14 8 C19 6 26 12 32 18 C38 12 45 6 50 8 C58 12 54 28 32 40 Z"/></svg>

    case 'frameArch':
      return <svg viewBox={v}><path fill="none" stroke={acc} strokeWidth="3.5" strokeLinecap="round" d="M10 42 L10 26 Q10 6 32 6 Q54 6 54 26 L54 42"/></svg>

    default:
      return <svg viewBox={v}><rect x="8" y="9" width="48" height="28" rx="4" fill={acc} opacity="0.5"/></svg>
  }
}

// ── Section component ──────────────────────────────────────────────────────
function Section({ title, items, onAdd, initialCount = 9 }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, initialCount)
  const hasMore = items.length > initialCount

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>{title}</span>
        {hasMore && (
          <button className={styles.seeAll} onClick={() => setExpanded(p => !p)}>
            {expanded ? 'Less' : 'See all'}
          </button>
        )}
      </div>
      <div className={styles.grid}>
        {visible.map(item => (
          <button
            key={item.id}
            className={styles.tile}
            title={`Add ${item.label}`}
            onClick={() => onAdd(item)}
          >
            <div className={styles.tileThumb}>
              <ShapeThumb shapeType={item.shapeType} outlined={!!item.outlined} />
              <div className={styles.tileHover}>
                <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" width="20" height="20">
                  <line x1="10" y1="3" x2="10" y2="17"/><line x1="3" y1="10" x2="17" y2="10"/>
                </svg>
              </div>
            </div>
            <span className={styles.tileLabel}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────
export default function ElementsPanel() {
  const [query,      setQuery]      = useState('')
  const [activeChip, setActiveChip] = useState('all')

  const setClips        = useEditorStore(s => s.setClips)
  const currentTime     = useEditorStore(s => s.currentTime)
  const saveHistory     = useEditorStore(s => s.saveHistory)
  const setSelectedClip = useEditorStore(s => s.setSelectedClip)

  const addShape = (item) => {
    const d  = (item.outlined ? OUTLINE_DEFAULTS : DEFAULTS)[item.shapeType] ?? {}
    const id = newElemId()
    saveHistory()
    setClips(prev => [
      ...prev,
      {
        id,
        type:         'shape',
        track:        'text',
        label:        item.label,
        shapeType:    item.shapeType,
        startSec:     currentTime,
        durSec:       5,
        posX:         50,
        posY:         50,
        width:        d.width        ?? 40,
        height:       d.height       ?? 25,
        fillColor:    d.fillColor    ?? '#6c63ff',
        fillOpacity:  d.fillOpacity  ?? 0.9,
        strokeColor:  d.strokeColor  ?? 'transparent',
        strokeWidth:  d.strokeWidth  ?? 0,
        rotation:     0,
        opacity:      1,
      },
    ])
    setSelectedClip(id)
  }

  const filtered = useMemo(() => {
    const q    = query.toLowerCase()
    const chip = activeChip
    const fn   = (items) => items.filter(item => {
      const matchChip = chip === 'all' || item.tags.includes(chip)
      const matchQ    = !q || item.label.toLowerCase().includes(q) || item.shapeType.toLowerCase().includes(q)
      return matchChip && matchQ
    })
    return {
      shapes:   fn(CATALOG.shapes),
      outlines: fn(CATALOG.outlines),
      lines:    fn(CATALOG.lines),
      frames:   fn(CATALOG.frames),
    }
  }, [query, activeChip])

  const hasAny = filtered.shapes.length + filtered.outlines.length + filtered.lines.length + filtered.frames.length > 0

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Elements</span>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10" y1="10" x2="14" y2="14"/>
        </svg>
        <input
          className={styles.searchInput}
          placeholder="Search elements…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && <button className={styles.searchClear} onClick={() => setQuery('')}>✕</button>}
      </div>

      {/* Chips */}
      <div className={styles.chips}>
        {CHIPS.map(c => (
          <button
            key={c.id}
            className={`${styles.chip} ${activeChip === c.id ? styles.chipActive : ''}`}
            onClick={() => setActiveChip(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.scroll}>
        {!hasAny && <div className={styles.empty}>No results for "{query}"</div>}
        {filtered.shapes.length   > 0 && <Section title="Shapes"         items={filtered.shapes}   onAdd={addShape} />}
        {filtered.outlines.length > 0 && <Section title="Outlines"        items={filtered.outlines} onAdd={addShape} />}
        {filtered.lines.length    > 0 && <Section title="Lines & Arrows"  items={filtered.lines}    onAdd={addShape} initialCount={4} />}
        {filtered.frames.length   > 0 && <Section title="Frames"          items={filtered.frames}   onAdd={addShape} />}
      </div>
    </div>
  )
}
