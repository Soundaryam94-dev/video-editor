import React, { useState, useRef, useEffect, useMemo } from 'react'
import styles from './Timeline.module.css'
import { useEditorStore } from '../../store/editorStore'
import { formatMSS } from '../../utils/formatTime'
import AudioMixer from '../AudioMixer/AudioMixer'
import ShortcutsModal from '../ShortcutsModal/ShortcutsModal'

// totalDur is computed dynamically inside the component from the clips state

// ── Tool contextual hints ──────────────────────────────────────────────────
const TOOL_HINTS = {
  select:  'Drag to move  ·  Trim edges  ·  Marquee-select  ·  Shift+click multi-select  ·  Ctrl+A/D/C/V  ·  ←→ frame step (no sel) / nudge (sel)  ·  Del delete  ·  Shift+Del ripple delete  ·  I/O mark range  ·  J step back  ·  K pause  ·  L play',
  razor:   'Click on any clip to cut it at that point',
  ripple:  'Drag a clip edge — all clips to the right shift automatically',
  rolling: 'Drag the edit point between two adjacent clips',
  slip:    'Drag to slide source content within the clip — clip position stays fixed, neighbours unchanged',
  slide:   'Drag to move clip — adjacent clips automatically stretch/shrink to fill both sides',
}

// ── Tool definitions ───────────────────────────────────────────────────────
const TOOLS = [
  {
    id: 'select', key: 'V', label: 'Selection Tool (V)',
    icon: (
      // Classic arrow cursor
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M3.5 1v11.5l2.7-2.7 1.6 3.7 1.8-.8-1.6-3.7H11L3.5 1z"/>
      </svg>
    ),
  },
  {
    id: 'razor', key: 'C', label: 'Razor Tool (C)',
    icon: (
      // Scissors — universal cut symbol
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="4.5" cy="4.5" r="1.8"/>
        <circle cx="4.5" cy="11.5" r="1.8"/>
        <line x1="6.1" y1="5.3" x2="14" y2="9.5"/>
        <line x1="6.1" y1="10.7" x2="14" y2="6.5"/>
      </svg>
    ),
  },
  {
    id: 'ripple', key: 'B', label: 'Ripple Edit Tool (B)',
    icon: (
      // Trim bar with one-sided arrow — right content ripples closed
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="7" y1="2" x2="7" y2="14"/>
        <path d="M5 4H3v8h2"/>
        <line x1="9" y1="8" x2="13" y2="8"/>
        <polyline points="11,6 13,8 11,10"/>
      </svg>
    ),
  },
  {
    id: 'rolling', key: 'N', label: 'Rolling Edit Tool (N)',
    icon: (
      // Trim bar with two-sided arrows — both clips adjust simultaneously
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="8" y1="2" x2="8" y2="14"/>
        <line x1="2" y1="8" x2="6" y2="8"/>
        <polyline points="4,6 2,8 4,10"/>
        <line x1="10" y1="8" x2="14" y2="8"/>
        <polyline points="12,6 14,8 12,10"/>
      </svg>
    ),
  },
  {
    id: 'slip', key: 'Y', label: 'Slip Tool (Y)',
    icon: (
      // Fixed clip boundary, inner arrows — content slides inside
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="1.5" y="5" width="13" height="6" rx="1.5"/>
        <line x1="5" y1="8" x2="11" y2="8"/>
        <polyline points="5,6.5 3.5,8 5,9.5"/>
        <polyline points="11,6.5 12.5,8 11,9.5"/>
      </svg>
    ),
  },
  {
    id: 'slide', key: 'U', label: 'Slide Tool (U)',
    icon: (
      // Clip with outer arrows — whole clip moves, neighbours adjust
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="4" y="4.5" width="8" height="6" rx="1.5"/>
        <line x1="1" y1="7.5" x2="3.5" y2="7.5"/>
        <polyline points="2.5,6 1,7.5 2.5,9"/>
        <line x1="15" y1="7.5" x2="12.5" y2="7.5"/>
        <polyline points="13.5,6 15,7.5 13.5,9"/>
      </svg>
    ),
  },
]

// ── Track registry (all possible tracks in display order) ─────────────────
const TRACK_DEFS = {
  v4:       { id: 'v4',       label: 'V4', type: 'video',   color: '#ec4899' },
  v3:       { id: 'v3',       label: 'V3', type: 'video',   color: '#a855f7' },
  v2:       { id: 'v2',       label: 'V2', type: 'video',   color: '#3b82f6' },
  v1:       { id: 'v1',       label: 'V1', type: 'video',   color: '#64748b' },
  text:     { id: 'text',     label: 'TX', type: 'text',    color: '#f59e0b' },
  captions: { id: 'captions', label: 'CC', type: 'caption', color: '#a3e635' },
  a1:       { id: 'a1',       label: 'A1', type: 'audio',   color: '#22c55e' },
  a2:       { id: 'a2',       label: 'A2', type: 'audio',   color: '#14b8a6' },
  a3:       { id: 'a3',       label: 'A3', type: 'audio',   color: '#06b6d4' },
}
const TRACK_ORDER = ['v4', 'v3', 'v2', 'v1', 'text', 'captions', 'a1', 'a2', 'a3']

// ── Clip data (time-based model) ───────────────────────────────────────────
let _nextId = 8
const newClipId = () => `c${++_nextId}`

// ── Mark In/Out range operations ──────────────────────────────────────────
function liftRange(clips, start, end, trackMeta) {
  const out = []
  for (const clip of clips) {
    if (trackMeta?.[clip.track]?.locked) { out.push(clip); continue }
    const cs = clip.startSec, ce = cs + clip.durSec
    if (ce <= start || cs >= end) { out.push(clip); continue }       // no overlap
    if (cs >= start && ce <= end) continue                            // fully inside — drop
    if (cs < start && ce > end) {                                     // spans range — split
      out.push({ ...clip, durSec: start - cs })
      out.push({ ...clip, id: newClipId(), startSec: end, trimIn: (clip.trimIn ?? 0) + (end - cs), durSec: ce - end })
    } else if (cs < start) {                                          // overlaps left edge
      out.push({ ...clip, durSec: start - cs })
    } else {                                                          // overlaps right edge
      out.push({ ...clip, startSec: end, trimIn: (clip.trimIn ?? 0) + (end - cs), durSec: ce - end })
    }
  }
  return out
}

function extractRange(clips, start, end, trackMeta) {
  const dur = end - start
  return liftRange(clips, start, end, trackMeta).map(clip => {
    if (trackMeta?.[clip.track]?.locked) return clip
    if (clip.startSec >= end) return { ...clip, startSec: Math.max(0, clip.startSec - dur) }
    return clip
  })
}


// Insert timeline range: copy clips overlapping [rangeStart,rangeEnd], place at playhead, ripple-shift right
function insertTimelineRangeAtPlayhead(clips, rangeStart, rangeEnd, playheadSec, trackMeta) {
  const rangeDur = rangeEnd - rangeStart
  if (rangeDur <= 0) return clips

  // Collect trimmed copies of clips that overlap the marked range
  const newClips = []
  clips.forEach(clip => {
    if (trackMeta?.[clip.track]?.locked) return
    const cs = clip.startSec, ce = cs + clip.durSec
    const overlapS = Math.max(cs, rangeStart)
    const overlapE = Math.min(ce, rangeEnd)
    if (overlapE <= overlapS) return
    newClips.push({
      ...clip,
      id: newClipId(),
      startSec: playheadSec + (overlapS - rangeStart),
      durSec:   overlapE - overlapS,
      trimIn:   (clip.trimIn ?? 0) + (overlapS - cs),
      sourceDur: clip.sourceDur ?? clip.durSec,
    })
  })

  // Ripple-shift existing clips at/after playhead; split straddlers
  const shifted = []
  clips.forEach(clip => {
    if (trackMeta?.[clip.track]?.locked) { shifted.push(clip); return }
    const cs = clip.startSec, ce = cs + clip.durSec
    if (ce <= playheadSec) {
      shifted.push(clip)
    } else if (cs >= playheadSec) {
      shifted.push({ ...clip, startSec: cs + rangeDur })
    } else {
      shifted.push({ ...clip, durSec: playheadSec - cs })
      shifted.push({ ...clip, id: newClipId(), startSec: playheadSec + rangeDur, durSec: ce - playheadSec, trimIn: (clip.trimIn ?? 0) + (playheadSec - cs) })
    }
  })

  return [...shifted, ...newClips]
}

// Insert source range: place a trimmed copy of pendingSource at playhead, ripple-shift same-track clips right
function insertSourceRangeAtPlayhead(clips, pendingSource, trimIn, durSec, playheadSec, trackMeta) {
  const { src, name, type, durationSecs } = pendingSource
  const trackId = type === 'audio' ? 'a1' : 'v1'
  const newClip = {
    id: newClipId(),
    track: trackId,
    startSec: playheadSec,
    durSec,
    src,
    name,
    type,
    label: name,
    style: type === 'audio' ? 'b' : 'a',
    waveform: type === 'audio',
    waveformSrc: null,
    trimIn,
    sourceDur: durationSecs,
  }
  const result = []
  clips.forEach(clip => {
    if (clip.track !== trackId || trackMeta?.[clip.track]?.locked) { result.push(clip); return }
    const cs = clip.startSec, ce = cs + clip.durSec
    if (ce <= playheadSec) {
      result.push(clip)
    } else if (cs >= playheadSec) {
      result.push({ ...clip, startSec: cs + durSec })
    } else {
      // straddles playhead — split: left stays, right shifts
      result.push({ ...clip, durSec: playheadSec - cs })
      result.push({ ...clip, id: newClipId(), startSec: playheadSec + durSec, durSec: ce - playheadSec, trimIn: (clip.trimIn ?? 0) + (playheadSec - cs) })
    }
  })
  result.push(newClip)
  return result
}

const INIT_CLIPS = []

// Ruler marks are now computed dynamically inside the component

function formatTC(s) {
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const fr  = Math.floor((s % 1) * 30)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}:${String(fr).padStart(2,'0')}`
}

function parseTC(str) {
  const parts = str.trim().replace(/[;.]/g, ':').split(':').map(Number)
  if (parts.some(isNaN) || parts.length === 0) return null
  if (parts.length === 4) return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 30
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0]
}


function srtTimeSec(str) {
  const clean = str.trim().replace(',', '.')
  const [hms, ms = '0'] = clean.split('.')
  const [h, m, s] = hms.split(':').map(Number)
  return h * 3600 + m * 60 + s + Number(ms) / 1000
}
function parseSRT(text) {
  const blocks = text.trim().split(/\n\s*\n/)
  const out = []
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue
    const tm = lines[1].match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/)
    if (!tm) continue
    const startSec = srtTimeSec(tm[1])
    const durSec   = Math.max(0.1, srtTimeSec(tm[2]) - startSec)
    const text     = lines.slice(2).join('\n').replace(/<[^>]+>/g, '')
    out.push({ startSec, durSec, text })
  }
  return out
}

// ── Track control icons ────────────────────────────────────────────────────

// Eye — open when visible, strikethrough when hidden
const EyeIcon = ({ off }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <line x1="2" y1="2" x2="14" y2="14"/>
        <path d="M6.8 3.7A6 6 0 0 1 8 3.5c3 0 5.5 2.8 5.5 4.5a5 5 0 0 1-.9 2.2"/>
        <path d="M3.8 5.8A5.2 5.2 0 0 0 2.5 8c0 1.7 2.5 4.5 5.5 4.5 1 0 1.9-.3 2.7-.7"/>
      </>
    ) : (
      <>
        <path d="M2.5 8C2.5 8 4.5 3.5 8 3.5S13.5 8 13.5 8 11.5 12.5 8 12.5 2.5 8 2.5 8z"/>
        <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none"/>
      </>
    )}
  </svg>
)

// Padlock — closed shackle when locked, open shackle when unlocked
const LockIcon = ({ locked }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7.5" width="10" height="7" rx="1.5"/>
    {locked ? (
      <>
        <path d="M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5"/>
        <circle cx="8" cy="11.5" r="1" fill="currentColor" stroke="none"/>
      </>
    ) : (
      <path d="M5.5 7.5V5a2.5 2.5 0 0 1 5 0" strokeOpacity="0.3"/>
    )}
  </svg>
)

// Speaker — sound waves when audible, X marks when muted
const SpeakerIcon = ({ muted }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 5.5H5L9 2.5v11L5 10.5H2z" fill="currentColor" fillOpacity="0.9" stroke="none"/>
    <path d="M2 5.5H5L9 2.5v11L5 10.5H2z"/>
    {muted ? (
      <>
        <line x1="11.5" y1="6" x2="14.5" y2="9"/>
        <line x1="14.5" y1="6" x2="11.5" y2="9"/>
      </>
    ) : (
      <>
        <path d="M11 6.5a3 3 0 0 1 0 3"/>
        <path d="M12.5 4.5a5.5 5.5 0 0 1 0 7" strokeOpacity="0.4"/>
      </>
    )}
  </svg>
)

// Headphones — universal solo/monitor symbol
const SoloIcon = ({ active }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 9.5V8a4.5 4.5 0 0 1 9 0v1.5"/>
    <rect x="2" y="9.5" width="3" height="4" rx="1" fill={active ? 'currentColor' : 'none'}/>
    <rect x="11" y="9.5" width="3" height="4" rx="1" fill={active ? 'currentColor' : 'none'}/>
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,4 14,4"/><path d="M5 4V2h6v2"/><path d="M6 7v5M10 7v5"/><rect x="3" y="4" width="10" height="10" rx="1"/>
  </svg>
)
const ChevUpIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4,10 8,6 12,10"/>
  </svg>
)
const ChevDownIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4,6 8,10 12,6"/>
  </svg>
)

// ── Main component ─────────────────────────────────────────────────────────
export default function Timeline() {
  const { zoom, setZoom, setSelectedClip, setCurrentTime, clips, setClips } = useEditorStore()
  const storeTime      = useEditorStore(s => s.currentTime)
  const playing        = useEditorStore(s => s.playing)
  const saveHistory    = useEditorStore(s => s.saveHistory)
  const setTrackHidden  = useEditorStore(s => s.setTrackHidden)
  const setTrackMuted   = useEditorStore(s => s.setTrackMuted)
  const setTrackSoloed  = useEditorStore(s => s.setTrackSoloed)
  const pendingSource     = useEditorStore(s => s.pendingSource)
  const setPendingSource  = useEditorStore(s => s.setPendingSource)
  const subclips   = useEditorStore(s => s.subclips)
  const addSubclip = useEditorStore(s => s.addSubclip)
  const updateClip      = useEditorStore(s => s.updateClip)
  const markers         = useEditorStore(s => s.markers)
  const addMarker       = useEditorStore(s => s.addMarker)
  const removeMarker    = useEditorStore(s => s.removeMarker)
  const loopEnabled     = useEditorStore(s => s.loopEnabled)
  const setLoopEnabled  = useEditorStore(s => s.setLoopEnabled)
  const setLoopRegion   = useEditorStore(s => s.setLoopRegion)

  const [activeTool, setActiveTool]       = useState('select')
  const [clipPopupOpen, setClipPopupOpen] = useState(false)
  const [clipName,      setClipName]      = useState('')
  const [snapEnabled, setSnapEnabled]     = useState(true)
  const [selectedClips, setSelectedClips] = useState(new Set())
  const [isDragging, setIsDragging]       = useState(false)
  const [dragOverTrack, setDragOverTrack] = useState(null)
  const [playheadPct, setPlayheadPct]     = useState(0)
  const [markIn,  setMarkIn]              = useState(null)
  const [markOut, setMarkOut]             = useState(null)
  const [razorX, setRazorX]               = useState(null)
  const [razorSec, setRazorSec]           = useState(null)
  const [razorHoverClipId, setRazorHoverClipId] = useState(null)
  const [rollingEditPt, setRollingEditPt]       = useState(null) // { leftClipId, rightClipId, x }
  const [slipDragId,   setSlipDragId]          = useState(null) // clip id being slipped
  const [slideContext, setSlideContext]         = useState(null) // { mainId, leftId, rightId }
  const [snapLineSec,  setSnapLineSec]          = useState(null)
  const [marquee, setMarquee]             = useState(null)   // {x1,y1,x2,y2} px in trackRows space
  const marqueeDragRef                     = useRef(null)     // same shape, written/read in stable effect
  const [hintVisible, setHintVisible]     = useState(
    () => typeof window !== 'undefined' && !localStorage.getItem('ve_tl_hint')
  )

  const [hintPopover, setHintPopover]   = useState(null) // { text, x, y }
  const [tcEditing,   setTcEditing]     = useState(false)
  const [tcInput,     setTcInput]       = useState('')
  const [showMixer,        setShowMixer]       = useState(false)
  const [contextMenu,      setContextMenu]     = useState(null) // { x, y, clipId }
  const [showShortcuts,    setShowShortcuts]   = useState(false)
  const [renamingClipId,   setRenamingClipId]  = useState(null)
  const [clipRenameVal,    setClipRenameVal]   = useState('')

  const [expanded, setExpanded]         = useState(false)

  const srtInputRef = useRef(null)

  const [manualTracks, setManualTracks] = useState([])
  const [trackDisplayOrder, setTrackDisplayOrder] = useState(TRACK_ORDER)
  const [trackMeta, setTrackMeta]       = useState({})
  const [renameVal, setRenameVal]       = useState('')
  const renameRef = useRef(null)

  const clipsColRef    = useRef(null)
  const trackRowsRef   = useRef(null)
  const draggingHead   = useRef(false)
  const dragRef        = useRef(null)
  const clipboardRef     = useRef([])
  const clipsColOuterRef = useRef(null)
  const rollingDragRef   = useRef(null)   // { leftClipId, rightClipId, leftOrigDur, rightOrigStart, rightOrigDur, startX }
  const rippleDragRef  = useRef(null)   // { clipId, track, type, startX, origStart, origDur, origEnd, cascadeIds, origStarts }
  const markInDragRef  = useRef(false)
  const markOutDragRef = useRef(false)
  const slipDragRef    = useRef(null)   // { clipId, startX, origTrimIn, origDurSec, sourceDur }
  const slideDragRef   = useRef(null)   // { clipId, startX, origStart, origDur, leftClipId, leftOrigDur, rightClipId, rightOrigStart, rightOrigDur }

  const live = useRef({})

  // Dynamic timeline duration — expands to fit all clips or the active source, minimum 45s
  const totalDur = useMemo(() => {
    const maxClipEnd = clips.length > 0 ? Math.max(...clips.map(c => c.startSec + c.durSec)) : 0
    const sourceDur  = pendingSource?.durationSecs ?? 0
    return Math.max(45, Math.ceil((Math.max(maxClipEnd, sourceDur) + 10) / 5) * 5)
  }, [clips, pendingSource])
  live.current.totalDur = totalDur

  const rulerMarks = useMemo(() => {
    const step = totalDur <= 60 ? 5 : totalDur <= 300 ? 30 : 60
    const marks = []
    for (let s = 0; s <= totalDur; s += step) marks.push(s)
    return marks
  }, [totalDur])

  const minorMarks = useMemo(() => {
    const step = totalDur <= 60 ? 1 : totalDur <= 300 ? 5 : 10
    const marks = []
    for (let s = 0; s <= totalDur; s += step) marks.push(s)
    return marks
  }, [totalDur])

  const visibleTracks = useMemo(() => {
    const showIds = new Set(manualTracks)
    if (clips.some(c => c.type === 'video' || c.type === 'image')) showIds.add('v1')
    if (clips.some(c => c.type === 'audio')) showIds.add('a1')
    clips.forEach(c => showIds.add(c.track))
    return trackDisplayOrder.filter(id => showIds.has(id) && TRACK_DEFS[id]).map(id => TRACK_DEFS[id])
  }, [clips, manualTracks, trackDisplayOrder])

  useEffect(() => {
    setTrackMeta(prev => {
      const add = {}
      visibleTracks.forEach(t => {
        if (!prev[t.id]) add[t.id] = { label: t.label, visible: true, locked: false, muted: false, solo: false, renaming: false }
      })
      return Object.keys(add).length ? { ...prev, ...add } : prev
    })
  }, [visibleTracks])

  const currentSeconds = playing ? storeTime : (playheadPct / 100) * live.current.totalDur
  // During playback follow store time; while scrubbing use local playheadPct
  const displayPct     = playing ? (storeTime / live.current.totalDur) * 100 : playheadPct

  live.current.clips         = clips
  live.current.snapEnabled   = snapEnabled
  live.current.playheadPct   = playheadPct
  live.current.selectedClips = selectedClips
  live.current.activeTool    = activeTool
  live.current.trackMeta     = trackMeta
  live.current.visibleTracks = visibleTracks
  live.current.saveHistory    = saveHistory
  live.current.setSnapLineSec = setSnapLineSec
  live.current.markIn        = markIn
  live.current.markOut       = markOut
  live.current.markers       = markers

  // When playback stops, snap local playheadPct to wherever the store time stopped.
  // NOTE: do NOT also write playheadPct→store here; that would overwrite the correct
  // position with stale playheadPct=0. Store writes only happen on manual scrub below.
  useEffect(() => {
    if (!playing) {
      const ct = useEditorStore.getState().currentTime
      setPlayheadPct((ct / live.current.totalDur) * 100)
    }
  }, [playing])

  // Auto-dismiss onboarding hint after 7 s
  useEffect(() => {
    if (!hintVisible) return
    const t = setTimeout(() => {
      setHintVisible(false)
      localStorage.setItem('ve_tl_hint', '1')
    }, 7000)
    return () => clearTimeout(t)
  }, [hintVisible])

  const dismissHint = () => {
    setHintVisible(false)
    localStorage.setItem('ve_tl_hint', '1')
  }

  // Auto-scroll timeline to follow playhead during playback
  useEffect(() => {
    if (!playing) return
    const outer = clipsColOuterRef.current
    const inner = clipsColRef.current
    if (!outer || !inner) return
    const playheadPx = (storeTime / live.current.totalDur) * inner.scrollWidth
    const { scrollLeft, clientWidth } = outer
    if (playheadPx < scrollLeft + 30 || playheadPx > scrollLeft + clientWidth - 60) {
      outer.scrollLeft = Math.max(0, playheadPx - clientWidth * 0.2)
    }
  }, [playing, storeTime])

  // Dismiss context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const dismiss = () => setContextMenu(null)
    window.addEventListener('mousedown', dismiss)
    return () => window.removeEventListener('mousedown', dismiss)
  }, [contextMenu])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const toolMap = { v:'select', c:'razor', b:'ripple', n:'rolling', y:'slip', u:'slide' }
    const handler = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()

      if (e.key === ' ') { e.preventDefault(); useEditorStore.getState().setPlaying(!useEditorStore.getState().playing); return }

      // JKL transport
      if (k === 'l' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        if (!useEditorStore.getState().playing) useEditorStore.getState().setPlaying(true)
        return
      }
      if (k === 'k' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        useEditorStore.getState().setPlaying(false)
        return
      }
      if (k === 'j' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const st = useEditorStore.getState()
        if (st.playing) {
          st.setPlaying(false)
        } else {
          const newT = Math.max(0, st.currentTime - 1 / 30)
          st.setCurrentTime(newT)
          setPlayheadPct((newT / live.current.totalDur) * 100)
        }
        return
      }

      // Ctrl/Cmd combos first (before single-key fallthrough)
      if (e.ctrlKey || e.metaKey) {
        if (!e.shiftKey && k === 'z') {
          e.preventDefault()
          useEditorStore.getState().undo()
          return
        }
        if (k === 'y' || (e.shiftKey && k === 'z')) {
          e.preventDefault()
          useEditorStore.getState().redo()
          return
        }
        if (k === 'a') {
          e.preventDefault()
          setSelectedClips(new Set(live.current.clips.map(c => c.id)))
          return
        }
        if (k === 'c' && !e.shiftKey) {
          e.preventDefault()
          const sel = live.current.selectedClips
          if (sel.size === 0) return
          clipboardRef.current = live.current.clips.filter(c => sel.has(c.id))
          return
        }
        if (k === 'x' && !e.shiftKey) {
          e.preventDefault()
          const sel = live.current.selectedClips
          if (sel.size === 0) return
          clipboardRef.current = live.current.clips.filter(c => sel.has(c.id))
          useEditorStore.getState().saveHistory()
          const tm = live.current.trackMeta
          setClips(prev => prev.filter(c => !sel.has(c.id) || tm[c.track]?.locked))
          setSelectedClips(new Set())
          return
        }
        if (k === 'v' && !e.shiftKey) {
          e.preventDefault()
          if (clipboardRef.current.length === 0) return
          const cb = clipboardRef.current
          const minStart = Math.min(...cb.map(c => c.startSec))
          const playhead = (live.current.playheadPct / 100) * live.current.totalDur
          useEditorStore.getState().saveHistory()
          const pasted = cb.map(c => ({ ...c, id: newClipId(), startSec: playhead + (c.startSec - minStart) }))
          setClips(prev => [...prev, ...pasted])
          setSelectedClips(new Set(pasted.map(c => c.id)))
          return
        }
        if (k === 'd') {
          e.preventDefault()
          const sel = live.current.selectedClips
          if (sel.size === 0) return
          useEditorStore.getState().saveHistory()
          setClips(prev => {
            const toAdd = []
            sel.forEach(id => {
              const c = prev.find(x => x.id === id)
              if (!c || live.current.trackMeta[c.track]?.locked) return
              const allOnTrack = [...prev.filter(x => x.track === c.track), ...toAdd.filter(x => x.track === c.track)]
              const lastEnd = allOnTrack.reduce((m, x) => Math.max(m, x.startSec + x.durSec), 0)
              if (c.durSec > 0.1) toAdd.push({ ...c, id: newClipId(), startSec: lastEnd, durSec: c.durSec })
            })
            return [...prev, ...toAdd]
          })
          return
        }
      }

      // Escape — deselect all
      if (e.key === 'Escape') { setSelectedClips(new Set()); setSelectedClip(null); return }

      // Arrow keys — frame step when nothing selected, nudge clips when selected
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const dir = e.key === 'ArrowLeft' ? -1 : 1
        if (live.current.selectedClips.size === 0) {
          // Frame step / 1s jump
          const step = e.shiftKey ? 1 : 1 / 30
          const st   = useEditorStore.getState()
          const newT = Math.max(0, Math.min(live.current.totalDur, st.currentTime + dir * step))
          st.setCurrentTime(newT)
          setPlayheadPct((newT / live.current.totalDur) * 100)
          return
        }
        const step = e.shiftKey ? 1 : 0.05
        setClips(prev => prev.map(c => {
          if (!live.current.selectedClips.has(c.id)) return c
          if (live.current.trackMeta[c.track]?.locked) return c
          const ns = Math.max(0, Math.min(live.current.totalDur - c.durSec, c.startSec + dir * step))
          return { ...c, startSec: ns }
        }))
        return
      }

      // ? — show keyboard shortcuts
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(p => !p); return }

      // Zoom shortcuts: = zoom in, - zoom out, \ zoom-to-fit
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        const st = useEditorStore.getState()
        st.setZoom(Math.min(100, (st.zoom ?? 0) + 5))
        return
      }
      if (e.key === '-') {
        e.preventDefault()
        const st = useEditorStore.getState()
        st.setZoom(Math.max(0, (st.zoom ?? 0) - 5))
        return
      }
      if (e.key === '\\') {
        e.preventDefault()
        useEditorStore.getState().setZoom(0)
        return
      }
      // M — add timeline marker
      if (k === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const st = useEditorStore.getState()
        const t = st.playing ? st.currentTime : (live.current.playheadPct / 100) * live.current.totalDur
        st.addMarker({ id: 'm' + Math.random().toString(36).slice(2, 9), timeSec: t, label: '' })
        return
      }

      const t = toolMap[k]
      if (t) setActiveTool(t)
      if (k === 's') setSnapEnabled(p => !p)
      if (k === 'i') {
        const st = useEditorStore.getState()
        setMarkIn(st.playing ? st.currentTime : (live.current.playheadPct / 100) * live.current.totalDur)
      }
      if (k === 'o') {
        const st = useEditorStore.getState()
        setMarkOut(st.playing ? st.currentTime : (live.current.playheadPct / 100) * live.current.totalDur)
      }
      if (k === 'g') { setMarkIn(null); setMarkOut(null) }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (live.current.selectedClips.size > 0) {
          useEditorStore.getState().saveHistory()
          const sel = live.current.selectedClips
          const tm  = live.current.trackMeta
          // Collect linked IDs so linked clips are also removed
          const linkedIds = new Set()
          live.current.clips.forEach(c => { if (sel.has(c.id) && c.linkedId) linkedIds.add(c.linkedId) })
          const shouldDel = c => sel.has(c.id) || (c.linkedId && linkedIds.has(c.linkedId))
          if (e.shiftKey) {
            // Ripple delete — remove selected clips and close the gap on each track
            const deleted   = live.current.clips.filter(c => shouldDel(c) && !tm[c.track]?.locked)
            const survivors = live.current.clips.filter(c => !shouldDel(c) || tm[c.track]?.locked)
            const result = survivors.map(c => {
              const shift = deleted
                .filter(d => d.track === c.track && (d.startSec + d.durSec) <= c.startSec)
                .reduce((sum, d) => sum + d.durSec, 0)
              return shift > 0 ? { ...c, startSec: Math.max(0, c.startSec - shift) } : c
            })
            setClips(result)
          } else {
            setClips(prev => prev.filter(c => !shouldDel(c) || tm[c.track]?.locked))
          }
          setSelectedClips(new Set())
          setSelectedClip(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSelectedClip])

  // ── Global mouse move / up (stable — reads via live ref) ────────────────
  useEffect(() => {
    const getColWidth = () =>
      clipsColRef.current ? clipsColRef.current.getBoundingClientRect().width : 900

    const getSnapPoints = excludeId => {
      const pts = [(live.current.playheadPct / 100) * live.current.totalDur]
      live.current.clips.forEach(c => {
        if (c.id !== excludeId) { pts.push(c.startSec, c.startSec + c.durSec) }
      })
      live.current.markers.forEach(m => pts.push(m.timeSec))
      return pts
    }

    let pendingSnapPt = null

    const snapSec = (sec, pts, threshPx) => {
      if (!live.current.snapEnabled) return sec
      const thresh = (threshPx / getColWidth()) * live.current.totalDur
      let best = null, bestDist = thresh
      pts.forEach(pt => {
        const d = Math.abs(sec - pt)
        if (d < bestDist) { bestDist = d; best = pt }
      })
      if (best !== null) { pendingSnapPt = best; return best }
      return sec
    }

    const getTrackAtY = clientY => {
      if (!trackRowsRef.current) return null
      const tracks = live.current.visibleTracks
      const { top } = trackRowsRef.current.getBoundingClientRect()
      const idx = Math.max(0, Math.min(tracks.length - 1, Math.floor((clientY - top) / 36)))
      return tracks[idx]?.id ?? null
    }

    const onMove = e => {
      // ── marquee drag ──
      if (marqueeDragRef.current) {
        if (!trackRowsRef.current) return
        const rect = trackRowsRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const next = { ...marqueeDragRef.current, x2: x, y2: y }
        marqueeDragRef.current = next
        setMarquee({ ...next })
        return
      }

      // ── playhead drag ──
      if (draggingHead.current) {
        if (!clipsColRef.current) return
        const { left, width } = clipsColRef.current.getBoundingClientRect()
        const pct = Math.max(0, Math.min(100, ((e.clientX - left) / width) * 100))
        setPlayheadPct(pct)
        setCurrentTime((pct / 100) * live.current.totalDur)
        return
      }

      // ── ripple edit drag ──
      if (rippleDragRef.current) {
        const rd  = rippleDragRef.current
        const colW = getColWidth()
        const raw  = ((e.clientX - rd.startX) / colW) * live.current.totalDur

        if (rd.type === 'trimR') {
          const d = Math.max(0.5 - rd.origDur, Math.min(live.current.totalDur - rd.origEnd, raw))
          setClips(prev => prev.map(c => {
            if (c.id === rd.clipId) return { ...c, durSec: rd.origDur + d }
            if (rd.cascadeIds.has(c.id)) return { ...c, startSec: rd.origStarts[c.id] + d }
            return c
          }))
        } else {
          // trimL — in-point moves; cascade clips to the LEFT follow it
          const d = Math.max(-rd.origStart, Math.min(rd.origDur - 0.5, raw))
          setClips(prev => prev.map(c => {
            if (c.id === rd.clipId) return { ...c, startSec: rd.origStart + d, durSec: rd.origDur - d }
            if (rd.cascadeIds.has(c.id)) return { ...c, startSec: Math.max(0, rd.origStarts[c.id] + d) }
            return c
          }))
        }
        return
      }

      // ── rolling edit drag ──
      if (rollingDragRef.current) {
        const rd  = rollingDragRef.current
        const colW = getColWidth()
        const raw  = ((e.clientX - rd.startX) / colW) * live.current.totalDur
        // clamp so neither clip shrinks below 0.5s
        const d = Math.max(0.5 - rd.leftOrigDur, Math.min(rd.rightOrigDur - 0.5, raw))
        setClips(prev => prev.map(c => {
          if (c.id === rd.leftClipId)  return { ...c, durSec: rd.leftOrigDur + d }
          if (c.id === rd.rightClipId) return { ...c, startSec: rd.rightOrigStart + d, durSec: rd.rightOrigDur - d }
          return c
        }))
        return
      }

      // ── mark in drag ──
      if (markInDragRef.current) {
        if (!clipsColRef.current) return
        const { left, width } = clipsColRef.current.getBoundingClientRect()
        const sec = Math.max(0, Math.min(live.current.totalDur, ((e.clientX - left) / width) * live.current.totalDur))
        setMarkIn(sec)
        return
      }
      // ── mark out drag ──
      if (markOutDragRef.current) {
        if (!clipsColRef.current) return
        const { left, width } = clipsColRef.current.getBoundingClientRect()
        const sec = Math.max(0, Math.min(live.current.totalDur, ((e.clientX - left) / width) * live.current.totalDur))
        setMarkOut(sec)
        return
      }

      // ── slip drag ──
      if (slipDragRef.current) {
        const rd  = slipDragRef.current
        const colW = getColWidth()
        const raw  = ((e.clientX - rd.startX) / colW) * live.current.totalDur
        const maxTrimIn = Math.max(0, rd.sourceDur - rd.origDurSec)
        const newTrimIn = Math.max(0, Math.min(maxTrimIn, rd.origTrimIn + raw))
        setClips(prev => prev.map(c =>
          c.id === rd.clipId ? { ...c, trimIn: newTrimIn } : c
        ))
        return
      }

      // ── slide drag ──
      if (slideDragRef.current) {
        const rd  = slideDragRef.current
        const colW = getColWidth()
        const raw  = ((e.clientX - rd.startX) / colW) * live.current.totalDur
        // Clamp: neither neighbour can shrink below 0.5 s; clip can't leave timeline
        let minD = -rd.origStart
        let maxD = live.current.totalDur - (rd.origStart + rd.origDur)
        if (rd.leftClipId  !== null) minD = Math.max(minD, -(rd.leftOrigDur  - 0.5))
        if (rd.rightClipId !== null) maxD = Math.min(maxD,   rd.rightOrigDur - 0.5)
        const d = Math.max(minD, Math.min(maxD, raw))
        setClips(prev => prev.map(c => {
          if (c.id === rd.clipId)                        return { ...c, startSec: rd.origStart + d }
          if (rd.leftClipId  && c.id === rd.leftClipId)  return { ...c, durSec: rd.leftOrigDur + d }
          if (rd.rightClipId && c.id === rd.rightClipId) return { ...c, startSec: rd.rightOrigStart + d, durSec: rd.rightOrigDur - d }
          return c
        }))
        return
      }

      // ── clip drag ──
      const drag = dragRef.current
      if (!drag) return
      e.preventDefault()

      const colW     = getColWidth()
      const deltaSec = ((e.clientX - drag.startX) / colW) * live.current.totalDur
      const snapPts  = getSnapPoints(drag.clipId)
      const SNAP_PX  = 8
      pendingSnapPt  = null

      let snappedMainStart = null  // captured inside map when isMain fires
      setClips(prev => prev.map(c => {
        // Which clips are affected
        const isMain   = c.id === drag.clipId
        const isFollow = drag.isMulti && live.current.selectedClips.has(c.id)
        const isLinked = !drag.isMulti && drag.linkedId != null
          && c.linkedId === drag.linkedId && c.id !== drag.clipId
        if (!isMain && !isFollow && !isLinked) return c

        if (drag.type === 'move') {
          const origStart = drag.isMulti
            ? (drag.multiOrigStarts[c.id] ?? c.startSec)
            : drag.origStart
          let newStart = origStart + deltaSec

          // Snap only on the "handle" clip; followers move by same clamped delta
          if (isMain) {
            newStart = Math.max(0, Math.min(live.current.totalDur - c.durSec, newStart))
            const sStart = snapSec(newStart, snapPts, SNAP_PX)
            const sEnd   = snapSec(newStart + c.durSec, snapPts, SNAP_PX)
            const dStart = Math.abs(sStart - newStart)
            const dEnd   = Math.abs(sEnd - (newStart + c.durSec))
            newStart = dStart <= dEnd ? sStart : sEnd - c.durSec
            newStart = Math.max(0, newStart)
            snappedMainStart = newStart
          } else if (isLinked && drag.linkedOrigStart != null) {
            const sDelta = snappedMainStart !== null ? snappedMainStart - drag.origStart : deltaSec
            newStart = Math.max(0, Math.min(live.current.totalDur - c.durSec, drag.linkedOrigStart + sDelta))
          } else {
            newStart = Math.max(0, Math.min(live.current.totalDur - c.durSec, newStart))
          }

          const newTrack = isMain ? (getTrackAtY(e.clientY) || drag.origTrack) : c.track
          return { ...c, startSec: newStart, track: newTrack }
        }

        if (drag.type === 'trimL') {
          let newStart = drag.origStart + deltaSec
          newStart = Math.max(0, Math.min(drag.origStart + drag.origDur - 0.5, newStart))
          newStart = snapSec(newStart, snapPts, SNAP_PX)
          const leftDelta = newStart - drag.origStart
          const newTrimIn = Math.max(0, drag.origTrimIn + leftDelta)
          return { ...c, startSec: newStart, durSec: Math.max(0.5, drag.origStart + drag.origDur - newStart), trimIn: newTrimIn }
        }

        if (drag.type === 'trimR') {
          let newEnd = drag.origStart + drag.origDur + deltaSec
          newEnd = Math.max(drag.origStart + 0.5, Math.min(live.current.totalDur, newEnd))
          newEnd = snapSec(newEnd, snapPts, SNAP_PX)
          return { ...c, durSec: Math.max(0.5, newEnd - c.startSec) }
        }

        return c
      }))
      live.current.setSnapLineSec(pendingSnapPt)
    }

    const onUp = () => {
      live.current.setSnapLineSec(null)
      draggingHead.current = false
      if (slipDragRef.current)  { slipDragRef.current  = null; setSlipDragId(null);   setIsDragging(false) }
      if (slideDragRef.current) { slideDragRef.current = null; setSlideContext(null); setIsDragging(false) }
      if (markInDragRef.current) { markInDragRef.current = false; setIsDragging(false) }
      if (markOutDragRef.current) { markOutDragRef.current = false; setIsDragging(false) }
      if (rippleDragRef.current) {
        rippleDragRef.current = null
        setIsDragging(false)
      }
      if (rollingDragRef.current) {
        rollingDragRef.current = null
        setIsDragging(false)
      }
      if (dragRef.current) {
        dragRef.current = null
        setIsDragging(false)
      }
      if (marqueeDragRef.current) {
        const m = marqueeDragRef.current
        marqueeDragRef.current = null
        setMarquee(null)
        if (!trackRowsRef.current) return
        const minX = Math.min(m.x1, m.x2), maxX = Math.max(m.x1, m.x2)
        const minY = Math.min(m.y1, m.y2), maxY = Math.max(m.y1, m.y2)
        if (maxX - minX < 4 && maxY - minY < 4) return   // click, not drag
        const colW = trackRowsRef.current.getBoundingClientRect().width
        const TRACK_H = 36
        const hit = new Set()
        live.current.clips.forEach(clip => {
          const ti = live.current.visibleTracks.findIndex(t => t.id === clip.track)
          if (ti < 0) return
          if (live.current.trackMeta[clip.track]?.locked) return
          const cL = (clip.startSec / live.current.totalDur) * colW
          const cR = cL + (clip.durSec / live.current.totalDur) * colW
          const cT = ti * TRACK_H, cB = cT + TRACK_H
          if (cR > minX && cL < maxX && cB > minY && cT < maxY) hit.add(clip.id)
        })
        setSelectedClips(hit)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, []) // stable — everything via live.current

  // ── Track helpers ─────────────────────────────────────────────────────────
  const getTS = id => trackMeta[id] ?? { label: TRACK_DEFS[id]?.label ?? id, visible: true, locked: false, muted: false, solo: false, renaming: false }

  const toggleTrack = (id, key) => {
    const nextVal = !(trackMeta[id]?.[key] ?? false)
    setTrackMeta(p => ({ ...p, [id]: { ...getTS(id), ...p[id], [key]: nextVal } }))
    if (key === 'visible') setTrackHidden(id, !nextVal)
    if (key === 'muted')   setTrackMuted(id, nextVal)
    if (key === 'solo')    setTrackSoloed(id, nextVal)
  }

  const anySolo = visibleTracks.some(t => trackMeta[t.id]?.solo)

  const startRename = id => {
    setRenameVal(getTS(id).label)
    setTrackMeta(p => ({ ...p, [id]: { ...getTS(id), ...p[id], renaming: true } }))
    setTimeout(() => renameRef.current?.focus(), 30)
  }
  const commitRename = id =>
    setTrackMeta(p => ({ ...p, [id]: { ...getTS(id), ...p[id], label: renameVal || getTS(id).label, renaming: false } }))

  // ── Add next available track ───────────────────────────────────────────────
  const addNextTrack = () => {
    const existingIds = new Set(visibleTracks.map(t => t.id))
    const next = TRACK_ORDER.find(id => !existingIds.has(id))
    if (next) setManualTracks(prev => [...prev, next])
  }

  const deleteTrack = (trackId) => {
    useEditorStore.getState().saveHistory()
    setClips(prev => prev.filter(c => c.track !== trackId))
    setManualTracks(prev => prev.filter(id => id !== trackId))
  }

  const moveTrack = (trackId, dir) => {
    setTrackDisplayOrder(prev => {
      const visIds = visibleTracks.map(t => t.id)
      const visIdx = visIds.indexOf(trackId)
      const swapVisIdx = dir === 'up' ? visIdx - 1 : visIdx + 1
      if (swapVisIdx < 0 || swapVisIdx >= visIds.length) return prev
      const swapId = visIds[swapVisIdx]
      const arr = [...prev]
      const a = arr.indexOf(trackId)
      const b = arr.indexOf(swapId)
      if (a < 0 || b < 0) return prev
      ;[arr[a], arr[b]] = [arr[b], arr[a]]
      return arr
    })
  }

  // ── SRT caption import ───────────────────────────────────────────────────
  const handleSRTImport = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const captions = parseSRT(ev.target.result)
      if (captions.length === 0) return
      saveHistory()
      setManualTracks(prev => prev.includes('captions') ? prev : [...prev, 'captions'])
      setClips(prev => [...prev, ...captions.map(c => ({
        id:       newClipId(),
        track:    'captions',
        type:     'caption',
        style:    'caption',
        startSec: c.startSec,
        durSec:   c.durSec,
        text:     c.text,
        label:    c.text.slice(0, 30),
        fontSize: 5,
        posY:     88,
        color:    '#ffffff',
        bgColor:  'rgba(0,0,0,0.65)',
        align:    'center',
        bold:     false,
        italic:   false,
      }))])
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Add adjustment layer ─────────────────────────────────────────────────
  const addAdjustmentLayer = () => {
    const playhead = (live.current.playheadPct / 100) * live.current.totalDur
    const adjTracks = ['v4', 'v3', 'v2']
    const track = adjTracks.find(id => !clips.some(c =>
      c.track === id && c.startSec < playhead + 5 && c.startSec + c.durSec > playhead
    )) ?? 'v2'
    saveHistory()
    setManualTracks(prev => prev.includes(track) ? prev : [...prev, track])
    setClips(prev => [...prev, {
      id:       newClipId(),
      track,
      type:     'adjustment',
      style:    'adj',
      startSec: playhead,
      durSec:   5,
      label:    'Adjustment',
    }])
  }

  // ── Drop media from MediaPanel onto a track ───────────────────────────────
  const handleMediaDrop = (e, trackId) => {
    e.preventDefault()
    setDragOverTrack(null)
    if (live.current.trackMeta[trackId]?.locked) return
    let data
    try { data = JSON.parse(e.dataTransfer.getData('application/x-media-item')) } catch { return }
    if (!data?.src || !clipsColRef.current) return
    const { left, width } = clipsColRef.current.getBoundingClientRect()
    const startSec = Math.max(0, ((e.clientX - left) / width) * live.current.totalDur)
    const durSec   = data.durationSecs ?? 5
    saveHistory()
    const isVideoOnVideoTrack = data.type === 'video' && trackId.startsWith('v')
    const linkId = isVideoOnVideoTrack ? newClipId() : undefined
    const baseClip = {
      id:        newClipId(),
      track:     trackId,
      startSec,
      durSec,
      src:       data.src,
      name:      data.name,
      type:      data.type,
      label:     data.name,
      style:     data.type === 'audio' ? 'b' : 'a',
      waveform:  data.type === 'audio',
      trimIn:    data.trimIn ?? 0,
      sourceDur: data.sourceDur ?? data.durationSecs ?? durSec,
      ...(linkId && { linkedId: linkId }),
    }
    if (isVideoOnVideoTrack && !live.current.trackMeta['a1']?.locked) {
      const audioClip = {
        id:        newClipId(),
        linkedId:  linkId,
        track:     'a1',
        startSec,
        durSec,
        src:       data.src,
        name:      data.name,
        type:      'audio',
        label:     data.name,
        style:     'b',
        waveform:  true,
        trimIn:    data.trimIn ?? 0,
        sourceDur: data.sourceDur ?? data.durationSecs ?? durSec,
      }
      setClips(prev => [...prev, baseClip, audioClip])
    } else {
      setClips(prev => [...prev, baseClip])
    }
  }

  // ── Clip interaction ──────────────────────────────────────────────────────
  const onClipMouseDown = (e, clipId) => {
    if (live.current.activeTool === 'ripple') return   // ripple only on trim handles

    if (live.current.activeTool === 'rolling') {
      const clip = live.current.clips.find(c => c.id === clipId)
      if (!clip || !clipsColRef.current) return
      if (live.current.trackMeta[clip.track]?.locked) return
      const { left, width } = clipsColRef.current.getBoundingClientRect()
      const clickSec  = ((e.clientX - left) / width) * live.current.totalDur
      const THRESH_S  = (10 / width) * live.current.totalDur
      const allClips  = live.current.clips

      // Right edge of this clip → check for right adjacent clip
      if (Math.abs(clickSec - (clip.startSec + clip.durSec)) < THRESH_S) {
        const rc = allClips.find(c => c.track === clip.track && Math.abs(c.startSec - (clip.startSec + clip.durSec)) < 0.05)
        if (rc) {
          e.stopPropagation(); e.preventDefault()
          saveHistory()
          rollingDragRef.current = { leftClipId: clipId, rightClipId: rc.id, leftOrigDur: clip.durSec, rightOrigStart: rc.startSec, rightOrigDur: rc.durSec, startX: e.clientX }
          setIsDragging(true)
          return
        }
      }
      // Left edge of this clip → check for left adjacent clip
      if (Math.abs(clickSec - clip.startSec) < THRESH_S) {
        const lc = allClips.find(c => c.track === clip.track && Math.abs((c.startSec + c.durSec) - clip.startSec) < 0.05)
        if (lc) {
          e.stopPropagation(); e.preventDefault()
          saveHistory()
          rollingDragRef.current = { leftClipId: lc.id, rightClipId: clipId, leftOrigDur: lc.durSec, rightOrigStart: clip.startSec, rightOrigDur: clip.durSec, startX: e.clientX }
          setIsDragging(true)
          return
        }
      }
      return
    }

    if (live.current.activeTool === 'razor') return

    if (live.current.activeTool === 'slip') {
      const clip = live.current.clips.find(c => c.id === clipId)
      if (!clip || live.current.trackMeta[clip.track]?.locked) return
      e.stopPropagation(); e.preventDefault()
      saveHistory()
      slipDragRef.current = {
        clipId,
        startX:     e.clientX,
        origTrimIn: clip.trimIn ?? 0,
        origDurSec: clip.durSec,
        sourceDur:  clip.sourceDur ?? clip.durSec * 2,
      }
      setSlipDragId(clipId)
      setIsDragging(true)
      return
    }

    if (live.current.activeTool === 'slide') {
      const clip = live.current.clips.find(c => c.id === clipId)
      if (!clip || live.current.trackMeta[clip.track]?.locked) return
      const allClips = live.current.clips
      const lc = allClips.find(c => c.track === clip.track && c.id !== clipId &&
        Math.abs((c.startSec + c.durSec) - clip.startSec) < 0.12)
      const rc = allClips.find(c => c.track === clip.track && c.id !== clipId &&
        Math.abs(c.startSec - (clip.startSec + clip.durSec)) < 0.12)
      if (!lc && !rc) return  // no adjacent clips — slide has nothing to do
      e.stopPropagation(); e.preventDefault()
      saveHistory()
      slideDragRef.current = {
        clipId,
        startX:         e.clientX,
        origStart:      clip.startSec,
        origDur:        clip.durSec,
        leftClipId:     lc?.id    ?? null,
        leftOrigDur:    lc?.durSec ?? 0,
        rightClipId:    rc?.id    ?? null,
        rightOrigStart: rc?.startSec ?? 0,
        rightOrigDur:   rc?.durSec ?? 0,
      }
      setSlideContext({ mainId: clipId, leftId: lc?.id ?? null, rightId: rc?.id ?? null })
      setIsDragging(true)
      return
    }

    const clip = live.current.clips.find(c => c.id === clipId)
    if (!clip || live.current.trackMeta[clip.track]?.locked) return

    e.stopPropagation()
    e.preventDefault()

    // Select clip immediately on mousedown (unless multi-select)
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !live.current.selectedClips.has(clipId)) {
      setSelectedClips(new Set([clipId]))
      setSelectedClip(clipId)
    }

    const isMulti = live.current.selectedClips.size > 1 && live.current.selectedClips.has(clipId)
    const multiOrigStarts = {}
    if (isMulti) {
      live.current.clips.forEach(c => {
        if (live.current.selectedClips.has(c.id)) multiOrigStarts[c.id] = c.startSec
      })
    }

    const linkedPeer = clip.linkedId
      ? live.current.clips.find(c => c.linkedId === clip.linkedId && c.id !== clipId)
      : null
    saveHistory()
    dragRef.current = {
      type: 'move', clipId,
      startX: e.clientX,
      origStart: clip.startSec, origDur: clip.durSec, origTrack: clip.track,
      isMulti, multiOrigStarts,
      linkedId: clip.linkedId ?? null,
      linkedOrigStart: linkedPeer?.startSec ?? null,
    }
    setIsDragging(true)
  }

  const onTrimMouseDown = (e, clipId, type) => {
    e.stopPropagation()
    e.preventDefault()
    const clip = live.current.clips.find(c => c.id === clipId)
    if (!clip || live.current.trackMeta[clip.track]?.locked) return

    if (live.current.activeTool === 'rolling') {
      const allClips = live.current.clips
      if (type === 'trimR') {
        const rc = allClips.find(c => c.track === clip.track && Math.abs(c.startSec - (clip.startSec + clip.durSec)) < 0.05)
        if (rc) {
          saveHistory()
          rollingDragRef.current = { leftClipId: clipId, rightClipId: rc.id, leftOrigDur: clip.durSec, rightOrigStart: rc.startSec, rightOrigDur: rc.durSec, startX: e.clientX }
          setIsDragging(true)
          return
        }
      }
      if (type === 'trimL') {
        const lc = allClips.find(c => c.track === clip.track && Math.abs((c.startSec + c.durSec) - clip.startSec) < 0.05)
        if (lc) {
          saveHistory()
          rollingDragRef.current = { leftClipId: lc.id, rightClipId: clipId, leftOrigDur: lc.durSec, rightOrigStart: clip.startSec, rightOrigDur: clip.durSec, startX: e.clientX }
          setIsDragging(true)
          return
        }
      }
      return
    }

    if (live.current.activeTool === 'ripple') {
      const allClips = live.current.clips
      const origEnd  = clip.startSec + clip.durSec
      // Build set of cascade clip IDs and their original start positions
      const cascadeIds  = new Set()
      const origStarts  = {}
      allClips.forEach(c => {
        if (c.track !== clip.track) return
        origStarts[c.id] = c.startSec
        if (c.id === clipId) return
        if (type === 'trimR' && c.startSec >= origEnd - 0.05) cascadeIds.add(c.id)
        if (type === 'trimL' && c.startSec + c.durSec <= clip.startSec + 0.05) cascadeIds.add(c.id)
      })
      saveHistory()
      rippleDragRef.current = {
        clipId, track: clip.track, type, startX: e.clientX,
        origStart: clip.startSec, origDur: clip.durSec, origEnd,
        cascadeIds, origStarts,
      }
      setIsDragging(true)
      return
    }

    saveHistory()
    dragRef.current = {
      type, clipId,
      startX: e.clientX,
      origStart: clip.startSec, origDur: clip.durSec, origTrack: clip.track,
      origTrimIn: clip.trimIn ?? 0,
      isMulti: false, multiOrigStarts: {},
    }
    setIsDragging(true)
  }

  const onClipClick = (e, clipId) => {
    const _clip = live.current.clips.find(c => c.id === clipId)
    if (_clip && live.current.trackMeta[_clip.track]?.locked) return

    if (live.current.activeTool === 'razor') {
      // Split clip at click position
      const clip = _clip
      if (!clip || !clipsColRef.current) return
      const { left, width } = clipsColRef.current.getBoundingClientRect()
      const clickSec = ((e.clientX - left) / width) * live.current.totalDur
      const splitAt = Math.max(clip.startSec + 0.2, Math.min(clip.startSec + clip.durSec - 0.2, clickSec))
      const id2 = newClipId()
      saveHistory()
      setClips(prev => {
        const out = []
        prev.forEach(c => {
          if (c.id !== clipId) { out.push(c); return }
          out.push({ ...c, durSec: splitAt - c.startSec })
          out.push({ ...c, id: id2, startSec: splitAt, durSec: c.startSec + c.durSec - splitAt })
        })
        return out
      })
    } else {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        setSelectedClips(prev => {
          const next = new Set(prev)
          next.has(clipId) ? next.delete(clipId) : next.add(clipId)
          return next
        })
      } else {
        setSelectedClips(new Set([clipId]))
        setSelectedClip(clipId)
      }
    }
  }

  const onRulerMouseDown = e => {
    draggingHead.current = true
    if (!clipsColRef.current) return
    const { left, width } = clipsColRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((e.clientX - left) / width) * 100))
    setPlayheadPct(pct)
    setCurrentTime((pct / 100) * live.current.totalDur)
  }

  const onTrackAreaClick = e => {
    if (e.target === e.currentTarget || e.target.classList.contains(styles.laneBg)) {
      setSelectedClips(new Set())
      setSelectedClip(null)
    }
  }

  // ── Hover preview tracking (razor + rolling) ─────────────────────────────
  const onClipsMouseMove = e => {
    if (!clipsColRef.current) return
    const { left, width } = clipsColRef.current.getBoundingClientRect()
    const hoverX   = e.clientX - left
    const hoverSec = (hoverX / width) * live.current.totalDur

    // Razor
    if (activeTool === 'razor') {
      setRazorX(hoverX)
      setRazorSec(hoverSec)
    } else {
      if (razorX   !== null) setRazorX(null)
      if (razorSec !== null) setRazorSec(null)
    }

    // Rolling — find adjacent clip pair nearest to cursor on the hovered track
    if (activeTool === 'rolling' && trackRowsRef.current) {
      const { top } = trackRowsRef.current.getBoundingClientRect()
      const trackIdx = Math.max(0, Math.min(visibleTracks.length - 1, Math.floor((e.clientY - top) / 36)))
      const hovTrack = visibleTracks[trackIdx]?.id
      const THRESH_S = (10 / width) * live.current.totalDur
      let found = null
      if (hovTrack) {
        const tc = clips.filter(c => c.track === hovTrack).sort((a, b) => a.startSec - b.startSec)
        for (let i = 0; i < tc.length - 1; i++) {
          const lc = tc[i], rc = tc[i + 1]
          const editSec = lc.startSec + lc.durSec
          if (Math.abs(rc.startSec - editSec) < 0.05 && Math.abs(hoverSec - editSec) < THRESH_S) {
            found = { leftClipId: lc.id, rightClipId: rc.id, x: (editSec / live.current.totalDur) * width }
            break
          }
        }
      }
      setRollingEditPt(found)
    } else if (rollingEditPt !== null) {
      setRollingEditPt(null)
    }
  }
  const onClipsMouseLeave = () => {
    if (razorX   !== null) setRazorX(null)
    if (razorSec !== null) setRazorSec(null)
    setRazorHoverClipId(null)
    if (rollingEditPt !== null) setRollingEditPt(null)
  }

  // helpers
  const splitClipAtPlayhead = (clipId) => {
    const clip = live.current.clips.find(c => c.id === clipId)
    if (!clip) return
    const splitSec = (live.current.playheadPct / 100) * live.current.totalDur
    if (splitSec <= clip.startSec || splitSec >= clip.startSec + clip.durSec) return
    live.current.saveHistory()
    const leftDur  = splitSec - clip.startSec
    const leftClip = { ...clip, durSec: leftDur }
    const rightClip = { ...clip, id: newClipId(), startSec: splitSec, durSec: clip.durSec - leftDur, trimIn: (clip.trimIn ?? 0) + leftDur }
    setClips(prev => [...prev.filter(c => c.id !== clipId), leftClip, rightClip])
    setSelectedClips(new Set([rightClip.id]))
  }

  const clipLeft  = c => `${(c.startSec / live.current.totalDur) * 100}%`
  const clipWidth = c => `${(c.durSec  / live.current.totalDur) * 100}%`

  return (
    <>
    <div className={`${styles.timeline} ${isDragging ? styles.dragging : ''} ${expanded ? styles.timelineExpanded : ''}`}>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className={styles.toolbar}>

        <div className={styles.toolGroup}>
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`${styles.toolBtn} ${activeTool === t.id ? styles.toolActive : ''}`}
              onClick={() => setActiveTool(t.id)}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className={styles.tbSep}/>

        {/* Mark In / Mark Out / Clear */}
        <div className={styles.markGroup}>
          <button
            className={`${styles.markBtn} ${markIn !== null ? styles.markBtnActive : ''}`}
            onClick={() => setMarkIn(currentSeconds)}
            title="Mark In (I)"
          >
            {/* Vertical bar + right-pointing filled triangle */}
            <svg viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="3" width="2" height="10" rx="0.5"/>
              <polygon points="5,4 5,12 13,8"/>
            </svg>
          </button>

          <button
            className={`${styles.markBtn} ${markOut !== null ? styles.markBtnActive : ''}`}
            onClick={() => setMarkOut(currentSeconds)}
            title="Mark Out (O)"
          >
            {/* Left-pointing filled triangle + vertical bar */}
            <svg viewBox="0 0 16 16" fill="currentColor">
              <polygon points="11,4 11,12 3,8"/>
              <rect x="12" y="3" width="2" height="10" rx="0.5"/>
            </svg>
          </button>

          <button
            className={`${styles.markBtn} ${markIn === null && markOut === null ? styles.markBtnDim : ''}`}
            onClick={() => { setMarkIn(null); setMarkOut(null) }}
            title="Clear In &amp; Out (G)"
          >
            {/* Two small brackets with X between */}
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 3H2v10h2"/>
              <path d="M12 3h2v10h-2"/>
              <line x1="6" y1="6" x2="10" y2="10"/>
              <line x1="10" y1="6" x2="6" y2="10"/>
            </svg>
          </button>
        </div>

        <div className={styles.tbSep}/>

        {/* Mark In / Out range readout */}
        {(markIn !== null || markOut !== null) && (
          <div className={styles.markRangeDisplay}>
            <span className={styles.markRangeLabel}>I</span>
            <span className={styles.markRangeVal}>{markIn !== null ? formatMSS(markIn) : '—'}</span>
            <span className={styles.markRangeSep}>·</span>
            <span className={styles.markRangeLabel}>O</span>
            <span className={styles.markRangeVal}>{markOut !== null ? formatMSS(markOut) : '—'}</span>
            {markIn !== null && markOut !== null && (
              <span className={styles.markRangeDur}>({formatMSS(Math.abs(markOut - markIn))})</span>
            )}
          </div>
        )}

        {/* Clip / Delete — only shown when both marks are set */}
        {markIn !== null && markOut !== null && (
          <>
            <div className={styles.tbSep}/>
            <div className={styles.markGroup}>
              <button
                className={styles.markBtn}
                title="Clip — save marked range to library"
                onClick={() => {
                  setClipName('')
                  setClipPopupOpen(true)
                }}
              >
                {/* Clapperboard — universal "video clip" symbol */}
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="12" height="7.5" rx="1"/>
                  <rect x="2" y="4.5" width="12" height="2.5" rx="0.5"/>
                  <line x1="5.5" y1="4.5" x2="4"   y2="7"/>
                  <line x1="9"   y1="4.5" x2="7.5" y2="7"/>
                  <line x1="12.5" y1="4.5" x2="11" y2="7"/>
                </svg>
              </button>
              <button
                className={styles.markBtn}
                title="Delete — remove marked range, close gap"
                onClick={() => {
                  const s = Math.min(markIn, markOut), e = Math.max(markIn, markOut)
                  useEditorStore.getState().saveHistory()
                  setClips(prev => extractRange(prev, s, e, live.current.trackMeta))
                  setMarkIn(null); setMarkOut(null)
                }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3,4 13,4"/>
                  <path d="M5,4V3a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V4"/>
                  <rect x="4" y="4" width="8" height="10" rx="1"/>
                  <line x1="7" y1="7" x2="7" y2="11"/>
                  <line x1="9" y1="7" x2="9" y2="11"/>
                </svg>
              </button>
            </div>
          </>
        )}

        {(markIn !== null || markOut !== null) && <div className={styles.tbSep}/>}

        <button
          className={`${styles.snapBtn} ${snapEnabled ? styles.snapOn : ''}`}
          onClick={() => setSnapEnabled(p => !p)}
          title="Toggle Snapping (S)"
        >
          {/* Horseshoe magnet — universal snap symbol */}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4.5 2.5v3.8a3.5 3.5 0 0 0 7 0V2.5"/>
            <line x1="2.5" y1="2.5" x2="6.5" y2="2.5" strokeWidth="2.2"/>
            <line x1="9.5" y1="2.5" x2="13.5" y2="2.5" strokeWidth="2.2"/>
            <line x1="4" y1="13" x2="12" y2="13" strokeOpacity="0.35" strokeWidth="1"/>
          </svg>
        </button>

        <div className={styles.tbSep}/>

        {tcEditing ? (
          <input
            className={styles.timecodeInput}
            value={tcInput}
            onChange={e => setTcInput(e.target.value)}
            onBlur={() => {
              const t = parseTC(tcInput)
              if (t !== null) {
                const clamped = Math.max(0, Math.min(live.current.totalDur, t))
                useEditorStore.getState().setCurrentTime(clamped)
                setPlayheadPct((clamped / live.current.totalDur) * 100)
              }
              setTcEditing(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') e.target.blur()
              if (e.key === 'Escape') setTcEditing(false)
              e.stopPropagation()
            }}
            autoFocus
          />
        ) : (
          <div
            className={styles.timecode}
            onClick={() => { setTcInput(formatTC(currentSeconds)); setTcEditing(true) }}
            title="Click to enter timecode"
            style={{ cursor: 'text' }}
          >
            {formatTC(currentSeconds)}
          </div>
        )}

        <div className={styles.tbSep}/>

        {/* Import SRT captions — standard CC box (YouTube/Netflix style) */}
        <button
          className={styles.snapBtn}
          onClick={() => srtInputRef.current?.click()}
          title="Import SRT Captions"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
            <rect x="1" y="3.5" width="14" height="9" rx="1.5"/>
            {/* Two "C" curves = closed-caption symbol */}
            <path d="M6.2 9.5a2 2 0 1 1 0-3.1" strokeWidth="1.4"/>
            <path d="M10.5 9.5a2 2 0 1 1 0-3.1" strokeWidth="1.4"/>
          </svg>
        </button>
        <input ref={srtInputRef} type="file" accept=".srt" style={{ display: 'none' }} onChange={handleSRTImport}/>

        {/* Add Adjustment Layer — horizontal sliders (Lightroom-style adjustments) */}
        <button
          className={styles.snapBtn}
          onClick={addAdjustmentLayer}
          title="Add Adjustment Layer"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <line x1="1.5" y1="4.5" x2="14.5" y2="4.5"/>
            <line x1="1.5" y1="8"   x2="14.5" y2="8"/>
            <line x1="1.5" y1="11.5" x2="14.5" y2="11.5"/>
            <circle cx="5.5" cy="4.5"  r="2" fill="currentColor" stroke="none"/>
            <circle cx="9.5" cy="8"    r="2" fill="currentColor" stroke="none"/>
            <circle cx="12"  cy="11.5" r="2" fill="currentColor" stroke="none"/>
          </svg>
        </button>

        <div className={styles.tbSep}/>

        {/* Audio Mixer toggle — vertical faders (mixing console) */}
        <button
          className={`${styles.snapBtn} ${showMixer ? styles.snapOn : ''}`}
          onClick={() => setShowMixer(p => !p)}
          title="Audio Mixer"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <line x1="4"  y1="1.5" x2="4"  y2="14.5"/>
            <line x1="8"  y1="1.5" x2="8"  y2="14.5"/>
            <line x1="12" y1="1.5" x2="12" y2="14.5"/>
            <rect x="2"  y="5.5"  width="4" height="2.5" rx="1" fill="currentColor" stroke="none"/>
            <rect x="6"  y="9"    width="4" height="2.5" rx="1" fill="currentColor" stroke="none"/>
            <rect x="10" y="3.5"  width="4" height="2.5" rx="1" fill="currentColor" stroke="none"/>
          </svg>
        </button>

        <div className={styles.tbSep}/>

        {/* Loop playback toggle */}
        <button
          className={`${styles.snapBtn} ${loopEnabled ? styles.snapOn : ''}`}
          onClick={() => {
            const next = !loopEnabled
            setLoopEnabled(next)
            if (next && markIn !== null && markOut !== null) {
              setLoopRegion(Math.min(markIn, markOut), Math.max(markIn, markOut))
            } else if (!next) {
              setLoopRegion(null, null)
            }
          }}
          title="Loop playback between marks (when set)"
        >
          {/* Loop / repeat arrows */}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 8a5.5 5.5 0 0 1 9.3-3.97L13.5 6"/>
            <path d="M13.5 8a5.5 5.5 0 0 1-9.3 3.97L2.5 10"/>
            <polyline points="11.5,3.5 13.5,6 11,6"/>
            <polyline points="4.5,12.5 2.5,10 5,10"/>
          </svg>
        </button>

        {/* Keyboard shortcuts help */}
        <button
          className={styles.snapBtn}
          onClick={() => setShowShortcuts(p => !p)}
          title="Keyboard Shortcuts (?)"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="6"/>
            <path d="M6.2 6.3a2 2 0 1 1 2.4 1.9C8 8.6 8 9.2 8 9.7"/>
            <circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none"/>
          </svg>
        </button>

        <div className={styles.tbSep}/>

        {/* Contextual tool hint — truncated in toolbar, full text on hover */}
        <span
          className={styles.toolHint}
          onMouseEnter={e => {
            const r = e.currentTarget.getBoundingClientRect()
            setHintPopover({ text: TOOL_HINTS[activeTool], x: r.left, y: r.top - 8 })
          }}
          onMouseLeave={() => setHintPopover(null)}
        >{TOOL_HINTS[activeTool]}</span>

        <div className={styles.tbGap}/>

        <div className={styles.zoomGroup}>
          <button className={styles.zoomBtn} onClick={() => setZoom(Math.max(0, zoom - 10))} title="Zoom Out (-)">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="2" y1="6" x2="10" y2="6"/></svg>
          </button>
          <input
            className={styles.zoomSlider}
            type="range" min={0} max={100} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            title={`Zoom: ${zoom}%`}
          />
          <button className={styles.zoomBtn} onClick={() => setZoom(Math.min(100, zoom + 10))} title="Zoom In (+)">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="6" y1="2" x2="6" y2="10"/><line x1="2" y1="6" x2="10" y2="6"/>
            </svg>
          </button>
        </div>

        <button
          className={`${styles.expandBtn} ${expanded ? styles.expandBtnActive : ''}`}
          title={expanded ? 'Collapse timeline' : 'Expand timeline'}
          onClick={() => setExpanded(p => !p)}
        >
          {expanded ? (
            // Inward arrows (collapse)
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <polyline points="1,1 5,5"/><polyline points="9,5 13,1"/>
              <polyline points="1,13 5,9"/><polyline points="9,9 13,13"/>
              <polyline points="5,1 5,5 1,5"/><polyline points="9,1 9,5 13,5"/>
              <polyline points="5,13 5,9 1,9"/><polyline points="9,13 9,9 13,9"/>
            </svg>
          ) : (
            // Outward arrows (expand)
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <polyline points="1,5 1,1 5,1"/><polyline points="9,1 13,1 13,5"/>
              <polyline points="1,9 1,13 5,13"/><polyline points="13,9 13,13 9,13"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className={styles.body}>

        {/* Track header column */}
        <div className={styles.headerCol}>
          <div className={styles.cornerCell}>
            <span className={styles.cornerLabel}>TRACKS</span>
          </div>

          {visibleTracks.map(track => {
            const ts = getTS(track.id)
            return (
              <div
                key={track.id}
                className={`${styles.trackHeader} ${ts.muted ? styles.headerMuted : ''}`}
                style={{ '--tc': track.color }}
              >
                <div className={styles.trackColorBar}/>

                <div className={styles.trackNameWrap} onDoubleClick={() => startRename(track.id)}>
                  {ts.renaming
                    ? <input
                        ref={renameRef}
                        className={styles.renameInput}
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onBlur={() => commitRename(track.id)}
                        onKeyDown={e => e.key === 'Enter' && commitRename(track.id)}
                      />
                    : <span className={styles.trackName} title="Double-click to rename">{ts.label}</span>
                  }
                  <span className={styles.trackType}>{track.type}</span>
                </div>

                <div className={styles.trackControls}>
                  <button
                    className={`${styles.ctrl} ${!ts.visible ? styles.ctrlOff : ''}`}
                    onClick={() => toggleTrack(track.id, 'visible')}
                    title="Toggle Visibility"
                  ><EyeIcon off={!ts.visible}/></button>

                  <button
                    className={`${styles.ctrl} ${ts.locked ? styles.ctrlLock : ''}`}
                    onClick={() => toggleTrack(track.id, 'locked')}
                    title="Lock Track"
                  ><LockIcon locked={ts.locked}/></button>

                  <button
                    className={`${styles.ctrl} ${ts.muted ? styles.ctrlMute : ''}`}
                    onClick={() => toggleTrack(track.id, 'muted')}
                    title="Mute Track"
                  ><SpeakerIcon muted={ts.muted}/></button>

                  <button
                    className={`${styles.ctrl} ${ts.solo ? styles.ctrlSolo : ''}`}
                    onClick={() => toggleTrack(track.id, 'solo')}
                    title="Solo Track"
                  ><SoloIcon active={ts.solo}/></button>

                  <button
                    className={styles.ctrl}
                    onClick={() => moveTrack(track.id, 'up')}
                    title="Move track up"
                  ><ChevUpIcon /></button>
                  <button
                    className={styles.ctrl}
                    onClick={() => moveTrack(track.id, 'down')}
                    title="Move track down"
                  ><ChevDownIcon /></button>
                  <button
                    className={`${styles.ctrl} ${styles.ctrlDel}`}
                    onClick={() => deleteTrack(track.id)}
                    title="Delete track and all its clips"
                  ><TrashIcon /></button>
                </div>
              </div>
            )
          })}

          <div className={styles.addTrackRow} onClick={addNextTrack}>
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
            </svg>
            Add Track
          </div>
        </div>

        {/* Clips + ruler column */}
        <div ref={clipsColOuterRef} className={styles.clipsColOuter}>
        <div
          className={styles.clipsCol}
          ref={clipsColRef}
          style={{ width: `${100 + zoom * 9}%` }}
          onMouseMove={onClipsMouseMove}
          onMouseLeave={onClipsMouseLeave}
        >

          {/* Ruler */}
          <div className={styles.ruler} onMouseDown={onRulerMouseDown}>
            {/* Mark In/Out highlighted region */}
            {markIn !== null && markOut !== null && (
              <div
                className={styles.markRegion}
                style={{
                  left:  `${(Math.min(markIn, markOut) / live.current.totalDur) * 100}%`,
                  width: `${(Math.abs(markOut - markIn) / live.current.totalDur) * 100}%`,
                }}
              />
            )}

            <div className={styles.minorTicksRow} aria-hidden>
              {minorMarks.map(s => (
                <div key={s} className={styles.minorTick} style={{ left: `${(s / live.current.totalDur) * 100}%` }}/>
              ))}
            </div>

            {rulerMarks.map(s => (
              <div key={s} className={styles.rulerMark} style={{ left: `${(s / live.current.totalDur) * 100}%` }}>
                <span className={styles.rulerLabel}>
                  {`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
                </span>
              </div>
            ))}

            {/* Mark In marker — draggable */}
            {markIn !== null && (
              <div
                className={styles.markInPin}
                style={{ left: `${(markIn / live.current.totalDur) * 100}%` }}
                onMouseDown={e => { e.stopPropagation(); markInDragRef.current = true; setIsDragging(true) }}
                title={`Mark In: ${formatMSS(markIn)} — drag to move`}
              >
                <div className={styles.markInFlag}/>
                <div className={styles.markPinStem}/>
              </div>
            )}

            {/* Mark Out marker — draggable */}
            {markOut !== null && (
              <div
                className={styles.markOutPin}
                style={{ left: `${(markOut / live.current.totalDur) * 100}%` }}
                onMouseDown={e => { e.stopPropagation(); markOutDragRef.current = true; setIsDragging(true) }}
                title={`Mark Out: ${formatMSS(markOut)} — drag to move`}
              >
                <div className={styles.markOutFlag}/>
                <div className={styles.markPinStem}/>
              </div>
            )}

            {/* Timeline markers */}
            {markers.map(m => (
              <div
                key={m.id}
                className={styles.markerPin}
                style={{ left: `${(m.timeSec / live.current.totalDur) * 100}%` }}
                onClick={e => {
                  e.stopPropagation()
                  useEditorStore.getState().setCurrentTime(m.timeSec)
                  setPlayheadPct((m.timeSec / live.current.totalDur) * 100)
                }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); removeMarker(m.id) }}
                title={`Marker: ${m.label || formatMSS(m.timeSec)} — right-click to delete`}
              >
                <div className={styles.markerTriangle}/>
                <div className={styles.markerStem}/>
              </div>
            ))}

            <div className={styles.playheadHandle} style={{ left: `${displayPct}%` }}>
              <div className={styles.playheadTriangle}/>
            </div>
          </div>

          {/* Track rows */}
          <div
            className={`${styles.trackRows} ${visibleTracks.length === 0 && dragOverTrack === '__empty' ? styles.emptyDragOver : ''} ${activeTool === 'razor' ? styles.cursorRazorArea : ''}`}
            ref={trackRowsRef}
            onClick={onTrackAreaClick}
            onDragOver={e => {
              e.preventDefault()
              if (visibleTracks.length === 0) setDragOverTrack('__empty')
            }}
            onDragLeave={() => { if (dragOverTrack === '__empty') setDragOverTrack(null) }}
            onDrop={e => {
              e.preventDefault()
              setDragOverTrack(null)
              let data
              try { data = JSON.parse(e.dataTransfer.getData('application/x-media-item')) } catch { return }
              if (!data?.src) return
              if (live.current.visibleTracks.length === 0) {
                // Empty timeline — route by type
                handleMediaDrop(e, data.type === 'audio' ? 'a1' : 'v1')
              } else {
                // Drop landed in empty space below/between tracks — find nearest track by Y
                const rect = trackRowsRef.current?.getBoundingClientRect()
                if (!rect) return
                const relY    = e.clientY - rect.top
                const trackH  = 36
                const idx     = Math.max(0, Math.min(Math.floor(relY / trackH), live.current.visibleTracks.length - 1))
                handleMediaDrop(e, live.current.visibleTracks[idx].id)
              }
            }}
          >
            {/* Mark In/Out shaded region over tracks */}
            {markIn !== null && markOut !== null && (
              <div
                className={styles.markRegionTracks}
                style={{
                  left:  `${(Math.min(markIn, markOut) / live.current.totalDur) * 100}%`,
                  width: `${(Math.abs(markOut - markIn) / live.current.totalDur) * 100}%`,
                }}
              />
            )}
            {markIn  !== null && <div className={styles.markInLine}  style={{ left: `${(markIn  / live.current.totalDur) * 100}%` }}/>}
            {markOut !== null && <div className={styles.markOutLine} style={{ left: `${(markOut / live.current.totalDur) * 100}%` }}/>}
            {markers.map(m => (
              <div key={'ml-' + m.id} className={styles.markerLine} style={{ left: `${(m.timeSec / live.current.totalDur) * 100}%` }}/>
            ))}

            <div className={styles.playheadLine} style={{ left: `${displayPct}%` }}/>

            {/* Snap guide line */}
            {isDragging && snapLineSec !== null && (
              <div className={styles.snapLine} style={{ left: `${(snapLineSec / live.current.totalDur) * 100}%` }}/>
            )}

            {/* Razor cut preview */}
            {activeTool === 'razor' && razorX !== null && (
              <div className={styles.razorPreview} style={{ left: razorX }}>
                <span className={styles.razorIcon}>✂</span>
              </div>
            )}

            {/* Rolling edit point indicator */}
            {activeTool === 'rolling' && rollingEditPt !== null && (
              <div className={styles.rollingEditPt} style={{ left: rollingEditPt.x }}>
                <div className={styles.rollingHandle}>
                  <svg viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="10">
                    <path d="M1 5h12M4 2L1 5l3 3M10 2l3 3-3 3"/>
                  </svg>
                </div>
              </div>
            )}

            {/* Marquee selection rectangle */}
            {marquee && (
              <div
                className={styles.marquee}
                style={{
                  left:   Math.min(marquee.x1, marquee.x2),
                  top:    Math.min(marquee.y1, marquee.y2),
                  width:  Math.abs(marquee.x2 - marquee.x1),
                  height: Math.abs(marquee.y2 - marquee.y1),
                }}
              />
            )}

            {/* Onboarding hint — shows once on first visit */}
            {hintVisible && (
              <div className={styles.onboardHint} onClick={dismissHint}>
                <div className={styles.hintHeader}>
                  <span className={styles.hintTitle}>Timeline Controls</span>
                  <button className={styles.hintClose} onClick={dismissHint}>✕</button>
                </div>
                <div className={styles.hintGrid}>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>Drag body</kbd><span>Move clip</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>Drag edge</kbd><span>Trim clip</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>Drag empty</kbd><span>Marquee select</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>⇧+click</kbd><span>Multi-select</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>Ctrl+A</kbd><span>Select all</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>Ctrl+D</kbd><span>Duplicate</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>← →</kbd><span>Nudge (⇧=1 s)</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>Del</kbd><span>Delete selected</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>Esc</kbd><span>Deselect all</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>C</kbd><span>Razor — click to cut</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>S</kbd><span>Toggle snap</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>I / O</kbd><span>Mark In / Mark Out</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>G</kbd><span>Clear In &amp; Out</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>;</kbd><span>Lift — delete range, keep gap</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>'</kbd><span>Extract — delete range, close gap</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>,</kbd><span>Insert — move selected clip to mark/playhead, ripple</span></div>
                  <div className={styles.hintRow}><kbd className={styles.kbd}>.</kbd><span>Overwrite — move selected clip to mark/playhead</span></div>
                </div>
                <div className={styles.hintFooter}>Click anywhere to dismiss · auto-closes in 7 s</div>
              </div>
            )}

            {visibleTracks.length === 0 && (
              <div className={`${styles.emptyTimeline} ${dragOverTrack === '__empty' ? styles.emptyTimelineDrop : ''}`}>
                {dragOverTrack === '__empty' ? (
                  <>
                    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="36" height="36">
                      <line x1="24" y1="8" x2="24" y2="40"/>
                      <line x1="8" y1="24" x2="40" y2="24"/>
                    </svg>
                    <span>Drop to add to V1 track</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" width="40" height="40">
                      <rect x="4" y="14" width="40" height="8" rx="2"/>
                      <rect x="4" y="26" width="40" height="8" rx="2"/>
                      <line x1="4" y1="10" x2="4" y2="38"/>
                    </svg>
                    <span>Drag a clip here to begin</span>
                    <span className={styles.emptyTimelineHint}>V1 and A1 tracks appear automatically</span>
                  </>
                )}
              </div>
            )}

            {visibleTracks.map(track => {
              const ts = getTS(track.id)
              const trackClips = clips.filter(c => c.track === track.id)
              return (
                <div
                  key={track.id}
                  className={`${styles.trackRow}
                    ${ts.locked                            ? styles.rowLocked     : ''}
                    ${ts.muted                             ? styles.rowMuted      : ''}
                    ${!ts.visible                          ? styles.rowHidden     : ''}
                    ${anySolo && !ts.solo                  ? styles.rowSoloDimmed : ''}
                    ${dragOverTrack === track.id            ? styles.rowDragOver  : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOverTrack(track.id) }}
                  onDragLeave={() => setDragOverTrack(null)}
                  onDrop={e => { e.stopPropagation(); handleMediaDrop(e, track.id) }}
                >
                  <div
                    className={styles.laneBg}
                    onMouseDown={e => {
                      if (live.current.activeTool !== 'select' || !trackRowsRef.current) return
                      const rect = trackRowsRef.current.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const y = e.clientY - rect.top
                      marqueeDragRef.current = { x1: x, y1: y, x2: x, y2: y }
                      setMarquee({ x1: x, y1: y, x2: x, y2: y })
                      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                        setSelectedClips(new Set())
                        setSelectedClip(null)
                      }
                    }}
                  />

                  {trackClips.map(clip => {
                    const sel          = selectedClips.has(clip.id)
                    const isSlipping   = slipDragId === clip.id
                    const isSliding    = slideContext?.mainId === clip.id
                    const isSlideLeft  = slideContext?.leftId  === clip.id
                    const isSlideRight = slideContext?.rightId === clip.id
                    const trimIn       = clip.trimIn ?? 0
                    const sourceDur    = clip.sourceDur ?? clip.durSec
                    const hasLeftSrc   = trimIn > 0.02
                    const hasRightSrc  = (trimIn + clip.durSec) < (sourceDur - 0.02)
                    return (
                      <div
                        key={clip.id}
                        className={`${styles.clip} ${styles[`clip_${clip.style}`]}
                          ${sel           ? styles.clipSel      : ''}
                          ${activeTool === 'select' ? (isDragging && sel ? styles.clipDragging : styles.clipGrab) : ''}
                          ${activeTool === 'razor'   ? styles.cursorRazor   : ''}
                          ${activeTool === 'razor' && razorHoverClipId === clip.id ? styles.razorHoverClip : ''}
                          ${activeTool === 'rolling' ? styles.cursorRolling : ''}
                          ${activeTool === 'slip'    ? styles.cursorSlip    : ''}
                          ${activeTool === 'slide'   ? styles.cursorSlide   : ''}
                          ${isSliding     ? styles.clipSliding  : ''}
                          ${(isSlideLeft || isSlideRight) ? styles.clipSlideAdj : ''}`}
                        style={{ left: clipLeft(clip), width: clipWidth(clip) }}
                        onMouseDown={e => onClipMouseDown(e, clip.id)}
                        onClick={e => onClipClick(e, clip.id)}
                        onMouseEnter={() => { if (activeTool === 'razor') setRazorHoverClipId(clip.id) }}
                        onMouseLeave={() => { if (activeTool === 'razor') setRazorHoverClipId(null) }}
                        onContextMenu={e => {
                          if (activeTool === 'razor') return
                          e.preventDefault()
                          e.stopPropagation()
                          setSelectedClips(new Set([clip.id]))
                          setSelectedClip(clip.id)
                          setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id })
                        }}
                      >
                        <div
                          className={`${styles.trimL} ${activeTool === 'ripple' ? styles.trimRipple : ''}`}
                          title={activeTool === 'ripple' ? 'Ripple trim left edge' : 'Trim left'}
                          onMouseDown={e => onTrimMouseDown(e, clip.id, 'trimL')}
                        />

                        <div
                          className={styles.clipInner}
                          onDoubleClick={e => {
                            if (activeTool !== 'select' || clip.type === 'caption' || clip.type === 'text') return
                            e.stopPropagation()
                            const defaultLabel = clip.label || clip.src?.split('/').pop()?.replace(/\.[^.]+$/, '') || ''
                            setRenamingClipId(clip.id)
                            setClipRenameVal(defaultLabel)
                          }}
                        >
                          {renamingClipId === clip.id ? (
                            <input
                              className={styles.clipRenameInput}
                              value={clipRenameVal}
                              onChange={e => setClipRenameVal(e.target.value)}
                              onBlur={() => {
                                if (clipRenameVal.trim()) updateClip(clip.id, { label: clipRenameVal.trim() })
                                setRenamingClipId(null)
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                                if (e.key === 'Escape') setRenamingClipId(null)
                                e.stopPropagation()
                              }}
                              onClick={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                              autoFocus
                            />
                          ) : clip.type === 'adjustment' ? (
                            <span className={styles.clipLabel}>⚙ {clip.label || 'Adjustment'}</span>
                          ) : clip.type === 'caption' ? (
                            <span className={styles.clipLabel} title={clip.text}>
                              ❝{clip.text?.slice(0, 24) || 'Caption'}
                            </span>
                          ) : clip.type === 'text' ? (
                            <span
                              className={styles.textClipContent}
                              style={{
                                fontFamily: clip.fontFamily ?? 'Arial',
                                fontWeight: clip.fontWeight ?? '700',
                                fontStyle:  clip.fontStyle  ?? 'normal',
                              }}
                            >
                              {clip.textContent || 'Title Text'}
                            </span>
                          ) : clip.waveformSrc ? (
                            <img src={clip.waveformSrc} className={styles.waveformImg} alt="" draggable={false}/>
                          ) : clip.waveform ? (
                            <div className={styles.waveform}/>
                          ) : clip.label ? (
                            <span className={styles.clipLabel}>
                              {clip.reversed && <span className={styles.clipBadge} title="Reversed">↩</span>}
                              {clip.linkedId && <span className={styles.clipBadge} title="Linked audio/video">🔗</span>}
                              {clip.label}
                            </span>
                          ) : (
                            <div className={styles.clipStripe}/>
                          )}
                        </div>

                        <div
                          className={`${styles.trimR} ${activeTool === 'ripple' ? styles.trimRipple : ''}`}
                          title={activeTool === 'ripple' ? 'Ripple trim right edge' : 'Trim right'}
                          onMouseDown={e => onTrimMouseDown(e, clip.id, 'trimR')}
                        />

                        {/* Color label stripe */}
                        {clip.color && <div className={styles.clipColorStripe} style={{ background: clip.color }}/>}

                        {/* Fade in ramp */}
                        {(clip.fadeIn ?? 0) > 0 && (
                          <div
                            className={styles.fadeInRamp}
                            style={{ width: `${Math.min(48, (clip.fadeIn / clip.durSec) * 100)}%` }}
                          />
                        )}
                        {/* Fade out ramp */}
                        {(clip.fadeOut ?? 0) > 0 && (
                          <div
                            className={styles.fadeOutRamp}
                            style={{ width: `${Math.min(48, (clip.fadeOut / clip.durSec) * 100)}%` }}
                          />
                        )}
                        {/* Dissolve transition indicator */}
                        {clip.transitionIn?.type === 'dissolve' && (
                          <div
                            className={styles.transitionBadge}
                            style={{ width: `${Math.min(40, (clip.transitionIn.dur / clip.durSec) * 100)}%` }}
                            title={`Dissolve ${(clip.transitionIn.dur).toFixed(1)}s`}
                          />
                        )}

                        {sel && <div className={styles.selOverlay}/>}
                        <button
                          className={styles.clipDelBtn}
                          title="Delete clip"
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => {
                            e.stopPropagation()
                            useEditorStore.getState().saveHistory()
                            setClips(prev => prev.filter(c => c.id !== clip.id))
                            setSelectedClips(new Set())
                          }}
                        >✕</button>

                        {activeTool === 'razor' && razorHoverClipId === clip.id && razorSec !== null && (
                          <div
                            className={styles.razorClipLine}
                            style={{ left: `${Math.max(0, Math.min(100, ((razorSec - clip.startSec) / clip.durSec) * 100))}%` }}
                          />
                        )}

                        {/* Slip tool — source boundary indicators + live offset label */}
                        {activeTool === 'slip' && hasLeftSrc  && <div className={styles.slipSourceLeft}/>}
                        {activeTool === 'slip' && hasRightSrc && <div className={styles.slipSourceRight}/>}
                        {isSlipping && (
                          <div className={styles.slipOffsetLabel}>
                            {trimIn > 0 ? '+' : ''}{formatMSS(trimIn)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

          </div>
        </div>
        </div>{/* clipsColOuter */}
      </div>
    </div>

    {/* Fixed popover — renders outside overflow clipping */}
    {hintPopover && (
      <div
        className={styles.hintPopover}
        style={{ left: hintPopover.x, top: hintPopover.y, transform: 'translateY(-100%)' }}
      >
        {hintPopover.text}
      </div>
    )}

    {/* Clip save popup */}
    {clipPopupOpen && markIn !== null && markOut !== null && (
      <div className={styles.clipOverlay} onClick={() => setClipPopupOpen(false)}>
        <div className={styles.clipModal} onClick={e => e.stopPropagation()}>
          <div className={styles.clipModalHeader}>
            <span className={styles.clipModalTitle}>Save Clip</span>
            <span className={styles.clipModalRange}>
              {formatMSS(Math.min(markIn, markOut))} – {formatMSS(Math.max(markIn, markOut))}
              &nbsp;·&nbsp;{formatMSS(Math.abs(markOut - markIn))}
            </span>
          </div>

          <div className={styles.clipNameRow}>
            <label className={styles.clipNameLabel}>Clip Name</label>
            <input
              className={styles.clipNameInput}
              type="text"
              value={clipName}
              onChange={e => setClipName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && clipName.trim()) e.currentTarget.form?.requestSubmit?.() || document.getElementById('clipSaveBtn')?.click()
                if (e.key === 'Escape') setClipPopupOpen(false)
              }}
              autoFocus
              placeholder="e.g. Clip1"
              spellCheck={false}
            />
          </div>

          <div className={styles.clipModalActions}>
            <button
              id="clipSaveBtn"
              className={styles.clipSaveBtn}
              disabled={!clipName.trim()}
              onClick={() => {
                const rangeS = Math.min(markIn, markOut)
                const rangeE = Math.max(markIn, markOut)
                const dur = rangeE - rangeS
                const sourceClip = clips.find(c =>
                  c.type === 'video' &&
                  rangeS >= c.startSec && rangeS < c.startSec + c.durSec
                )
                addSubclip({
                  id: `sc-${Date.now()}`,
                  name: clipName.trim(),
                  type: 'video',
                  src: sourceClip?.src ?? null,
                  trimIn: sourceClip
                    ? (sourceClip.trimIn ?? 0) + (rangeS - sourceClip.startSec)
                    : 0,
                  durationSecs: dur,
                  duration: formatMSS(dur),
                  sourceDur: sourceClip?.sourceDur ?? sourceClip?.durationSecs ?? dur,
                })
                setClipPopupOpen(false)
              }}
            >
              Save
            </button>
            <button className={styles.clipModalCancel} onClick={() => setClipPopupOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Audio Mixer floating panel */}
    {showMixer && <AudioMixer onClose={() => setShowMixer(false)} />}

    {/* Keyboard shortcuts modal */}
    {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

    {/* Right-click context menu */}
    {contextMenu && (() => {
      const ctxClip = clips.find(c => c.id === contextMenu.clipId)
      if (!ctxClip) return null
      const tm = live.current.trackMeta
      const locked = tm[ctxClip.track]?.locked
      return (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setContextMenu(null)}/>
          <div
            className={styles.contextMenu}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className={styles.contextItem} onClick={() => { clipboardRef.current = [ctxClip]; setContextMenu(null) }}>Copy</div>
            <div className={styles.contextItem} onClick={() => {
              clipboardRef.current = [ctxClip]
              if (!locked) { live.current.saveHistory(); setClips(prev => prev.filter(c => c.id !== ctxClip.id)); setSelectedClips(new Set()) }
              setContextMenu(null)
            }}>Cut</div>
            <div className={styles.contextItem} onClick={() => {
              if (!locked) { live.current.saveHistory(); setClips(prev => [...prev, { ...ctxClip, id: newClipId(), startSec: ctxClip.startSec + ctxClip.durSec }]) }
              setContextMenu(null)
            }}>Duplicate</div>
            <div className={styles.contextSep}/>
            <div className={styles.contextItem} onClick={() => { splitClipAtPlayhead(ctxClip.id); setContextMenu(null) }}>Split at Playhead</div>
            <div className={styles.contextSep}/>
            <div className={styles.contextItem} onClick={() => {
              live.current.saveHistory()
              updateClip(ctxClip.id, { transitionIn: ctxClip.transitionIn ? null : { type: 'dissolve', dur: 0.5 } })
              setContextMenu(null)
            }}>{ctxClip.transitionIn ? 'Remove Transition' : 'Add Dissolve'}</div>
            <div className={styles.contextSep}/>
            <div className={styles.contextColorRow}>
              <span className={styles.contextColorLabel}>Label</span>
              {['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ec4899'].map(col => (
                <div
                  key={col}
                  className={`${styles.colorSwatch} ${ctxClip.color === col ? styles.colorSwatchActive : ''}`}
                  style={{ background: col }}
                  onClick={() => { updateClip(ctxClip.id, { color: ctxClip.color === col ? null : col }); setContextMenu(null) }}
                />
              ))}
            </div>
            <div className={styles.contextSep}/>
            <div className={`${styles.contextItem} ${styles.contextDanger}`} onClick={() => {
              if (!locked) {
                live.current.saveHistory()
                setClips(prev => prev.filter(c => c.id !== ctxClip.id && !(ctxClip.linkedId && c.linkedId === ctxClip.linkedId)))
                setSelectedClips(new Set()); setSelectedClip(null)
              }
              setContextMenu(null)
            }}>Delete</div>
            <div className={`${styles.contextItem} ${styles.contextDanger}`} onClick={() => {
              if (!locked) {
                live.current.saveHistory()
                const toRemove = c => c.id === ctxClip.id || (ctxClip.linkedId && c.linkedId === ctxClip.linkedId)
                const survivors = live.current.clips.filter(c => !toRemove(c))
                const result = survivors.map(c => {
                  const shift = (ctxClip.track === c.track && (ctxClip.startSec + ctxClip.durSec) <= c.startSec) ? ctxClip.durSec : 0
                  return shift > 0 ? { ...c, startSec: Math.max(0, c.startSec - shift) } : c
                })
                setClips(result)
                setSelectedClips(new Set())
                setSelectedClip(null)
              }
              setContextMenu(null)
            }}>Ripple Delete</div>
          </div>
        </>
      )
    })()}
    </>
  )
}
