import React, { useState, useRef, useEffect, useMemo } from 'react'
import styles from './Preview.module.css'
import { formatTime } from '../../utils/formatTime'
import { useEditorStore } from '../../store/editorStore'
import { drawTextClips, drawShapeClips } from '../../utils/textRenderer'
import { evalCurve, curveToTableValues } from '../../utils/curves'

// ── Icons ──────────────────────────────────────────────────────────────────
const SkipBackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none"/>
    <line x1="5" y1="19" x2="5" y2="5"/>
  </svg>
)
const SkipForwardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none"/>
    <line x1="19" y1="5" x2="19" y2="19"/>
  </svg>
)
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
)
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1"/>
    <rect x="14" y="4" width="4" height="16" rx="1"/>
  </svg>
)
const VolumeHighIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
)
const VolumeLowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
)
const VolumeMuteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
)
const FitIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
    <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
    <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
    <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
  </svg>
)
const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
)
const ExitFullscreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="4 14 10 14 10 20"/>
    <polyline points="20 10 14 10 14 4"/>
    <line x1="10" y1="14" x2="3" y2="21"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
    <polyline points="2,6 5,9 10,3"/>
  </svg>
)

const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200]

// ── Shape hit-testing helpers ─────────────────────────────────────────────
// Returns true if (mx, my) is inside the rotated shape bounding box
function hitTestShape(mx, my, clip, canvasW, canvasH) {
  const cx   = (clip.posX / 100) * canvasW
  const cy   = (clip.posY / 100) * canvasH
  const sw   = ((clip.width  ?? 40) / 100) * canvasW
  const sh   = ((clip.height ?? 25) / 100) * canvasH
  const rot  = (clip.rotation ?? 0) * Math.PI / 180
  const cosR = Math.cos(rot), sinR = Math.sin(rot)
  const lx   = cosR * (mx - cx) + sinR * (my - cy)
  const ly   = -sinR * (mx - cx) + cosR * (my - cy)
  return Math.abs(lx) <= sw / 2 && Math.abs(ly) <= sh / 2
}

// ── Shape selection / resize helpers ──────────────────────────────────────
const SEL_PAD = 7    // px padding around selection box
const HIT_R   = 10   // px radius for corner-handle hit detection

function hitTestShapeHandles(mx, my, clip, canvasW, canvasH) {
  if (!clip) return null
  const cx   = (clip.posX / 100) * canvasW
  const cy   = (clip.posY / 100) * canvasH
  const sw   = ((clip.width  ?? 40) / 100) * canvasW
  const sh   = ((clip.height ?? 25) / 100) * canvasH
  const rot  = ((clip.rotation ?? 0) * Math.PI) / 180
  const cosR = Math.cos(rot), sinR = Math.sin(rot)

  const corners = [
    { id: 'tl', lx: -(sw / 2 + SEL_PAD), ly: -(sh / 2 + SEL_PAD) },
    { id: 'tr', lx:  (sw / 2 + SEL_PAD), ly: -(sh / 2 + SEL_PAD) },
    { id: 'bl', lx: -(sw / 2 + SEL_PAD), ly:  (sh / 2 + SEL_PAD) },
    { id: 'br', lx:  (sw / 2 + SEL_PAD), ly:  (sh / 2 + SEL_PAD) },
  ]
  for (const c of corners) {
    const wx = cx + c.lx * cosR - c.ly * sinR
    const wy = cy + c.lx * sinR + c.ly * cosR
    if (Math.hypot(mx - wx, my - wy) < HIT_R) return c.id
  }
  // Inside rotated bounding box → move
  const lmx = cosR * (mx - cx) + sinR * (my - cy)
  const lmy = -sinR * (mx - cx) + cosR * (my - cy)
  if (Math.abs(lmx) <= sw / 2 + SEL_PAD && Math.abs(lmy) <= sh / 2 + SEL_PAD) return 'move'
  return null
}
const VIDEO_PRIORITY = ['v1', 'v2', 'v3', 'v4']
const V_TRACK_ORDER = ['v1', 'v2', 'v3', 'v4']  // v1=bottom layer, v4=top layer

// Linear keyframe interpolation
function interpolateKF(kfs, t) {
  if (!kfs || kfs.length === 0) return null
  const sorted = [...kfs].sort((a, b) => a.t - b.t)
  if (t <= sorted[0].t) return sorted[0].v
  if (t >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].v
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].t && t < sorted[i + 1].t) {
      const frac = (t - sorted[i].t) / (sorted[i + 1].t - sorted[i].t)
      return sorted[i].v + frac * (sorted[i + 1].v - sorted[i].v)
    }
  }
  return null
}

function hasCurves(clip) {
  if (!clip?.curves) return false
  return Object.values(clip.curves).some(pts => pts && !(pts.length === 2 && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 255 && pts[1][1] === 255))
}

// Build filter string for adjustment layer's visual effects (no transform/opacity)
function buildAdjFilter(clip) {
  if (!clip) return ''
  const br = 1 + (clip.brightness ?? 0) / 100
  const co = 1 + (clip.contrast   ?? 0) / 100
  const sa = 1 + (clip.saturation ?? 0) / 100
  const hu = clip.hue      ?? 0
  const bl = clip.blur     ?? 0
  const gr = (clip.grayscale ?? 0) / 100
  const parts = [`brightness(${br.toFixed(3)})`, `contrast(${co.toFixed(3)})`, `saturate(${sa.toFixed(3)})`]
  if (hu !== 0) parts.push(`hue-rotate(${hu}deg)`)
  if (bl > 0)   parts.push(`blur(${bl}px)`)
  if (gr > 0)   parts.push(`grayscale(${gr.toFixed(3)})`)
  return parts.join(' ')
}

// Build CSS style object from a clip's visual properties, with optional keyframe time
function buildVideoStyle(clip, t = 0) {
  if (!clip) return {}

  const kfGet = (key, def) => {
    const v = interpolateKF(clip.keyframes?.[key], t)
    return v !== null ? v : (clip[key] ?? def)
  }

  const scale   = kfGet('scale',   100) / 100
  const posX    = clip.posX     ?? 0
  const posY    = clip.posY     ?? 0
  const rotate  = kfGet('rotate',  0)
  const opacity = kfGet('opacity', 100) / 100

  const br      = 1 + (clip.brightness  ?? 0) / 100
  const co      = 1 + (clip.contrast    ?? 0) / 100
  const sa      = 1 + (clip.saturation  ?? 0) / 100
  const hu      = clip.hue       ?? 0
  const bl      = clip.blur      ?? 0
  const gr      = (clip.grayscale ?? 0) / 100
  const warmth  = clip.warmth    ?? 0

  const cropT = clip.cropT ?? 0
  const cropB = clip.cropB ?? 0
  const cropL = clip.cropL ?? 0
  const cropR = clip.cropR ?? 0

  const filterParts = [
    `brightness(${br.toFixed(3)})`,
    `contrast(${co.toFixed(3)})`,
    `saturate(${sa.toFixed(3)})`,
  ]
  if (hu !== 0)  filterParts.push(`hue-rotate(${hu}deg)`)
  if (bl > 0)    filterParts.push(`blur(${bl}px)`)
  if (gr > 0)    filterParts.push(`grayscale(${gr.toFixed(3)})`)
  if (warmth > 0) {
    filterParts.push(`sepia(${(warmth / 100 * 0.4).toFixed(3)})`)
    filterParts.push(`hue-rotate(${(-warmth * 0.2).toFixed(1)}deg)`)
  } else if (warmth < 0) {
    filterParts.push(`hue-rotate(${(-warmth * 0.3).toFixed(1)}deg)`)
  }

  const clipPath = (cropT > 0 || cropB > 0 || cropL > 0 || cropR > 0)
    ? `inset(${cropT}% ${cropR}% ${cropB}% ${cropL}%)`
    : undefined

  return {
    transform: `scale(${scale}) translate(${posX}px, ${posY}px) rotate(${rotate}deg)`,
    opacity,
    filter: filterParts.join(' '),
    clipPath,
  }
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Preview({ onOpenResize }) {
  const currentTime    = useEditorStore(s => s.currentTime)
  const duration       = useEditorStore(s => s.duration)
  const allClips       = useEditorStore(s => s.clips)
  const hiddenTracks   = useEditorStore(s => s.hiddenTracks)
  const mutedTracks    = useEditorStore(s => s.mutedTracks)
  const soloedTracks   = useEditorStore(s => s.soloedTracks)
  const playing         = useEditorStore(s => s.playing)
  const setPlaying      = useEditorStore(s => s.setPlaying)
  const setCurrentTime  = useEditorStore(s => s.setCurrentTime)
  const selectedClipId  = useEditorStore(s => s.selectedClipId)
  const setSelectedClip = useEditorStore(s => s.setSelectedClip)
  const updateClip      = useEditorStore(s => s.updateClip)
  const saveHistory     = useEditorStore(s => s.saveHistory)
  const ratio           = useEditorStore(s => s.canvasRatio)
  const trackVolumes    = useEditorStore(s => s.trackVolumes)

  const clips = useMemo(
    () => allClips.filter(c => !hiddenTracks[c.track]),
    [allClips, hiddenTracks]
  )

  const [previewZoom, setPreviewZoom] = useState('fit')
  const [zoomOpen,    setZoomOpen]    = useState(false)
  const [volume,      setVolume]      = useState(1)
  const [volOpen,     setVolOpen]     = useState(false)
  const [speedOpen,   setSpeedOpen]   = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hoverHandle,  setHoverHandle]  = useState(null)
  const [editingShapeId, setEditingShapeId] = useState(null)
  const [editFontPx,     setEditFontPx]     = useState(20)

  const videoRef      = useRef(null)
  const videoLayerRefs = useRef({})
  const rafRef        = useRef(null)
  const ctRef         = useRef(currentTime)
  ctRef.current       = currentTime
  const progressRef   = useRef(null)
  const previewRef    = useRef(null)
  const zoomRef       = useRef(null)
  const volWrapRef    = useRef(null)
  const textCanvasRef = useRef(null)
  const canvasDivRef  = useRef(null)
  const shapeDragRef  = useRef(null)   // drag/resize state while mouse is held
  const speedWrapRef  = useRef(null)
  const activeClipRef = useRef(null)

  const progress    = (currentTime / Math.max(duration, 1)) * 100
  const zoomLabel   = previewZoom === 'fit' ? 'Fit' : `${previewZoom}%`
  const canvasScale = previewZoom === 'fit' ? null : previewZoom / 100
  const isMuted     = volume === 0

  // Active video clip at current time
  const activeClip = useMemo(() => {
    for (const trackId of VIDEO_PRIORITY) {
      const clip = clips.find(c =>
        c.track === trackId && c.type === 'video' &&
        currentTime >= c.startSec && currentTime < c.startSec + c.durSec
      )
      if (clip) return clip
    }
    return null
  }, [clips, currentTime])
  activeClipRef.current = activeClip

  // All active video clips at current time ordered bottom (v1) → top (v4), excluding adjustment layers
  const activeVideoClips = useMemo(() =>
    V_TRACK_ORDER
      .map(track => clips.find(c =>
        c.type === 'video' && c.track === track &&
        currentTime >= c.startSec && currentTime < c.startSec + c.durSec
      ))
      .filter(Boolean),
    [clips, currentTime]
  )

  // Active adjustment layers ordered by track (lower tracks apply first)
  const activeAdjClips = useMemo(() =>
    V_TRACK_ORDER
      .map(track => clips.find(c =>
        c.type === 'adjustment' && c.track === track &&
        currentTime >= c.startSec && currentTime < c.startSec + c.durSec
      ))
      .filter(Boolean),
    [clips, currentTime]
  )

  // Clips fading/sliding OUT during a transition-in on the next clip
  const transitionExitClips = useMemo(() => {
    const result = []
    V_TRACK_ORDER.forEach(track => {
      const entering = clips.find(c =>
        c.type === 'video' && c.track === track &&
        c.transitionIn?.dur > 0 &&
        currentTime >= c.startSec && currentTime < c.startSec + c.transitionIn.dur
      )
      if (!entering) return
      const p    = (currentTime - entering.startSec) / entering.transitionIn.dur
      const type = entering.transitionIn.type ?? 'dissolve'
      let exitOpacity   = 1 - p
      let exitTransform = null
      if (type === 'slideLeft')  { exitOpacity = 1; exitTransform = `translateX(${-p * 100}%)` }
      if (type === 'slideRight') { exitOpacity = 1; exitTransform = `translateX(${p * 100}%)` }
      if (type === 'slideUp')    { exitOpacity = 1; exitTransform = `translateY(${-p * 100}%)` }
      if (type === 'slideDown')  { exitOpacity = 1; exitTransform = `translateY(${p * 100}%)` }
      if (type === 'wipeLeft' || type === 'wipeRight') exitOpacity = 1
      if (type === 'fadeBlack')  exitOpacity = Math.max(0, 1 - p * 2)
      const prevClip = clips
        .filter(c => c.type === 'video' && c.track === track && c.id !== entering.id && (c.startSec + c.durSec) <= entering.startSec + 0.1)
        .sort((a, b) => (b.startSec + b.durSec) - (a.startSec + a.durSec))[0]
      if (prevClip) result.push({ clip: prevClip, opacity: Math.max(0, exitOpacity), transform: exitTransform })
    })
    return result
  }, [clips, currentTime])

  // Active caption clips
  const activeCaptionClips = useMemo(() =>
    clips.filter(c =>
      c.type === 'caption' &&
      currentTime >= c.startSec && currentTime < c.startSec + c.durSec
    ),
    [clips, currentTime]
  )

  // ── Playback engine ────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current

    if (!playing) {
      cancelAnimationFrame(rafRef.current)
      if (video) video.pause()
      return
    }

    function startRaf() {
      let last = performance.now()
      const tick = now => {
        const dt   = (now - last) / 1000
        last       = now
        const next = ctRef.current + dt
        // Loop check
        const st = useEditorStore.getState()
        if (st.loopEnabled) {
          const loopOut = st.loopOut ?? st.duration
          const loopIn  = st.loopIn  ?? 0
          if (loopIn < loopOut && next >= loopOut) {
            setCurrentTime(loopIn)
            rafRef.current = requestAnimationFrame(tick)
            return
          }
        }
        if (next >= duration) {
          setCurrentTime(0)
          setPlaying(false)
          return
        }
        setCurrentTime(next)
        // Seek reversed video on each tick
        const ac = activeClipRef.current
        if (video && ac?.reversed) {
          const speed = ac.speed ?? 1
          const elapsed = next - ac.startSec
          const revPos = Math.max(ac.trimIn ?? 0, (ac.trimIn ?? 0) + ac.durSec * speed - elapsed * speed)
          if (Math.abs(video.currentTime - revPos) > 0.05) video.currentTime = revPos
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    // For reversed clips: pause video so RAF-based seeking controls it
    if (video && activeClip?.reversed) video.pause()

    if (video && activeClip && !activeClip.reversed) {
      const trimIn = activeClip.trimIn ?? 0
      const pos = Math.max(0, ctRef.current - activeClip.startSec + trimIn)
      if (Math.abs(video.currentTime - pos) > 0.3) video.currentTime = pos

      video.play().catch(() => {})

      const onUpdate = () => {
        const t = activeClip.startSec + video.currentTime - trimIn
        // Loop check
        const st = useEditorStore.getState()
        if (st.loopEnabled) {
          const loopOut = st.loopOut ?? st.duration
          const loopIn  = st.loopIn  ?? 0
          if (loopIn < loopOut && t >= loopOut) {
            const newPos = Math.max(0, loopIn - activeClip.startSec + trimIn)
            if (newPos >= 0 && loopIn >= activeClip.startSec) {
              video.currentTime = newPos
            }
            setCurrentTime(loopIn)
            return
          }
        }
        setCurrentTime(Math.min(t, duration))
        const clipDone = video.currentTime >= trimIn + activeClip.durSec
        if (t >= duration || clipDone) {
          video.removeEventListener('timeupdate', onUpdate)
          video.removeEventListener('ended', onEnded)
          if (t >= duration) { setPlaying(false); setCurrentTime(0) }
          else startRaf()
        }
      }

      const onEnded = () => {
        video.removeEventListener('timeupdate', onUpdate)
        video.removeEventListener('ended', onEnded)
        startRaf()
      }

      video.addEventListener('timeupdate', onUpdate)
      video.addEventListener('ended', onEnded)

      return () => {
        video.pause()
        video.removeEventListener('timeupdate', onUpdate)
        video.removeEventListener('ended', onEnded)
        cancelAnimationFrame(rafRef.current)
      }
    }

    startRaf()
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, activeClip?.id, duration, setCurrentTime, setPlaying])

  // ── Manual seek ───────────────────────────────────────────────────────
  useEffect(() => {
    if (playing) return
    const video = videoRef.current
    if (!video || !activeClip) return
    let pos
    if (activeClip.reversed) {
      const speed = activeClip.speed ?? 1
      const elapsed = currentTime - activeClip.startSec
      pos = Math.max(activeClip.trimIn ?? 0, (activeClip.trimIn ?? 0) + activeClip.durSec * speed - elapsed * speed)
    } else {
      pos = Math.max(0, currentTime - activeClip.startSec + (activeClip.trimIn ?? 0))
    }
    if (Math.abs(video.currentTime - pos) > 0.1) video.currentTime = pos
  }, [currentTime, activeClip, playing])

  // Sync overlay video layers on play/pause
  useEffect(() => {
    activeVideoClips.forEach((clip, idx) => {
      if (idx === 0) return
      const v = videoLayerRefs.current[clip.id]
      if (!v) return
      const pos = Math.max(0, ctRef.current - clip.startSec + (clip.trimIn ?? 0))
      if (Math.abs(v.currentTime - pos) > 0.3) v.currentTime = pos
      if (playing) v.play().catch(() => {})
      else v.pause()
    })
  }, [playing, activeVideoClips])

  // Sync overlay layers when scrubbing paused
  useEffect(() => {
    if (playing) return
    activeVideoClips.forEach((clip, idx) => {
      if (idx === 0) return
      const v = videoLayerRefs.current[clip.id]
      if (!v) return
      const pos = Math.max(0, currentTime - clip.startSec + (clip.trimIn ?? 0))
      if (Math.abs(v.currentTime - pos) > 0.1) v.currentTime = pos
    })
  }, [currentTime, activeVideoClips, playing])

  // Hold exiting clips at their last frame during transitions
  useEffect(() => {
    transitionExitClips.forEach(({ clip }) => {
      const v = videoLayerRefs.current['exit-' + clip.id]
      if (!v) return
      const holdAt = Math.max(0, (clip.trimIn ?? 0) + clip.durSec - 0.04)
      if (Math.abs(v.currentTime - holdAt) > 0.1) v.currentTime = holdAt
      v.pause()
    })
  }, [transitionExitClips])

  // ── Track mute / solo logic ────────────────────────────────────────────
  const anySoloed = useMemo(
    () => Object.values(soloedTracks).some(Boolean),
    [soloedTracks]
  )

  const isTrackAudioMuted = useMemo(() => {
    if (!activeClip) return false
    if (anySoloed) return !soloedTracks[activeClip.track]
    return !!mutedTracks[activeClip.track]
  }, [activeClip, mutedTracks, soloedTracks, anySoloed])

  // ── Volume + track mute → video element ───────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted  = isTrackAudioMuted || volume === 0
  }, [volume, isTrackAudioMuted])

  // ── Audio-track clip playback (a1 / a2 / a3) ─────────────────────────
  const audioElsRef = useRef({})

  const activeAudioClips = useMemo(() =>
    clips.filter(c =>
      c.type === 'audio' &&
      currentTime >= c.startSec &&
      currentTime < c.startSec + c.durSec
    ),
    [clips, currentTime]
  )

  // Start, stop, and initial-seek when playback state or active set changes
  useEffect(() => {
    const els    = audioElsRef.current
    const soloed = Object.values(soloedTracks).some(Boolean)

    activeAudioClips.forEach(clip => {
      if (!els[clip.id]) els[clip.id] = new Audio(clip.src)
      const audio    = els[clip.id]
      const clipT    = Math.max(0, ctRef.current - clip.startSec + (clip.trimIn ?? 0))
      const muted    = soloed ? !soloedTracks[clip.track] : !!mutedTracks[clip.track]
      const trackVol = trackVolumes[clip.track] ?? 1
      audio.volume = Math.min(1, volume * trackVol)
      audio.muted  = muted || volume === 0
      if (Math.abs(audio.currentTime - clipT) > 0.3) audio.currentTime = clipT
      if (playing  && audio.paused)  audio.play().catch(() => {})
      if (!playing && !audio.paused) audio.pause()
    })

    // Pause clips that left the active range
    Object.entries(els).forEach(([id, audio]) => {
      if (!activeAudioClips.some(c => c.id === id) && !audio.paused) audio.pause()
    })
  }, [playing, activeAudioClips]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seek while scrubbing (paused)
  useEffect(() => {
    if (playing) return
    const els = audioElsRef.current
    activeAudioClips.forEach(clip => {
      const audio = els[clip.id]
      if (!audio) return
      const clipT = Math.max(0, currentTime - clip.startSec + (clip.trimIn ?? 0))
      if (Math.abs(audio.currentTime - clipT) > 0.1) audio.currentTime = clipT
    })
  }, [currentTime, activeAudioClips, playing])

  // Apply fade-in / fade-out volume envelope to audio clips
  useEffect(() => {
    const els = audioElsRef.current
    const soloed = Object.values(soloedTracks).some(Boolean)
    activeAudioClips.forEach(clip => {
      const audio = els[clip.id]
      if (!audio) return
      const clipRelTime = Math.max(0, currentTime - clip.startSec)
      const fi = clip.fadeIn  ?? 0
      const fo = clip.fadeOut ?? 0
      let fadeFactor = 1
      if (fi > 0 && clipRelTime < fi) fadeFactor *= clipRelTime / fi
      if (fo > 0 && clipRelTime > clip.durSec - fo) fadeFactor *= Math.max(0, (clip.durSec - clipRelTime) / fo)
      const trackVol = trackVolumes[clip.track] ?? 1
      const muted = soloed ? !soloedTracks[clip.track] : !!mutedTracks[clip.track]
      audio.volume = Math.min(1, volume * trackVol * fadeFactor)
      audio.muted  = muted || volume === 0
    })
  }, [currentTime, activeAudioClips, volume, mutedTracks, soloedTracks, trackVolumes])

  // Re-apply volume / mute to all live audio elements
  useEffect(() => {
    const els    = audioElsRef.current
    const soloed = Object.values(soloedTracks).some(Boolean)
    Object.entries(els).forEach(([id, audio]) => {
      const clip = clips.find(c => c.id === id)
      if (!clip) return
      const trackVol = trackVolumes[clip.track] ?? 1
      audio.volume = Math.min(1, volume * trackVol)
      audio.muted  = (soloed ? !soloedTracks[clip.track] : !!mutedTracks[clip.track]) || volume === 0
    })
  }, [volume, mutedTracks, soloedTracks, trackVolumes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup audio elements on unmount
  useEffect(() => {
    const els = audioElsRef.current
    return () => Object.values(els).forEach(a => { a.pause(); a.src = '' })
  }, [])

  // ── Text + shape overlay rendering ────────────────────────────────────
  // Always include the selected text clip so transform/style edits show live
  const activeTextClips = useMemo(() => {
    const inRange = clips.filter(c =>
      c.type === 'text' &&
      currentTime >= c.startSec &&
      currentTime < c.startSec + c.durSec
    )
    const selected = clips.find(c => c.id === selectedClipId && c.type === 'text')
    if (selected && !inRange.some(c => c.id === selected.id)) {
      return [...inRange, selected]
    }
    return inRange
  }, [clips, currentTime, selectedClipId])

  const activeShapeClips = useMemo(() =>
    clips.filter(c =>
      c.type === 'shape' &&
      currentTime >= c.startSec &&
      currentTime < c.startSec + c.durSec
    ),
    [clips, currentTime]
  )

  // Selected shape clip (for properties panel + canvas selection indicator + drag)
  const selectedShapeClip = useMemo(() =>
    clips.find(c => c.id === selectedClipId && c.type === 'shape') ?? null,
    [clips, selectedClipId]
  )

  useEffect(() => {
    const cvs = textCanvasRef.current
    const div = canvasDivRef.current
    if (!cvs || !div) return
    const w = div.clientWidth || 1
    const h = div.clientHeight || 1
    if (cvs.width  !== w) cvs.width  = w
    if (cvs.height !== h) cvs.height = h
    const ctx = cvs.getContext('2d')
    ctx.clearRect(0, 0, w, h)
    // While inline-editing a shape's text, blank that clip's text so the textarea shows it instead
    const shapesForDraw = editingShapeId
      ? activeShapeClips.map(c => c.id === editingShapeId ? { ...c, text: '' } : c)
      : activeShapeClips
    drawShapeClips(ctx, shapesForDraw, w, h)
    drawTextClips(ctx, activeTextClips, w, h, currentTime, false)
    // Draw selection indicator over the selected shape
    if (selectedShapeClip) {
      const cx  = (selectedShapeClip.posX / 100) * w
      const cy  = (selectedShapeClip.posY / 100) * h
      const sw2 = ((selectedShapeClip.width  ?? 40) / 100) * w
      const sh2 = ((selectedShapeClip.height ?? 25) / 100) * h
      const rot = ((selectedShapeClip.rotation ?? 0) * Math.PI) / 180
      const pad = 7
      ctx.save()
      ctx.translate(cx, cy)
      if (rot !== 0) ctx.rotate(rot)
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#6c63ff'
      ctx.lineWidth   = 1.5
      ctx.setLineDash([5, 4])
      ctx.strokeRect(-(sw2 / 2 + pad), -(sh2 / 2 + pad), sw2 + pad * 2, sh2 + pad * 2)
      ctx.setLineDash([])
      // Corner handles
      ctx.fillStyle   = '#fff'
      ctx.strokeStyle = '#6c63ff'
      ctx.lineWidth   = 1.5
      const hx = sw2 / 2 + pad, hy = sh2 / 2 + pad
      ;[[-hx,-hy],[hx,-hy],[-hx,hy],[hx,hy]].forEach(([ex,ey]) => {
        ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke()
      })
      ctx.restore()
    }
  }, [activeShapeClips, activeTextClips, currentTime, selectedShapeClip, editingShapeId])

  // ── Shape drag (move) / corner-handle resize ──────────────────────────
  const HANDLE_CURSORS = {
    tl: 'nw-resize', tr: 'ne-resize',
    bl: 'sw-resize', br: 'se-resize',
    move: 'move',
  }

  // Hover — update cursor when mouse moves over the overlay without dragging
  const onShapePointerMove = e => {
    if (shapeDragRef.current) return
    if (!selectedShapeClip) return
    const div = canvasDivRef.current
    if (!div) return
    const rect = div.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setHoverHandle(hitTestShapeHandles(mx, my, selectedShapeClip, rect.width, rect.height))
  }

  const onShapePointerLeave = () => {
    if (!shapeDragRef.current) setHoverHandle(null)
  }

  const onShapeMouseDown = e => {
    if (!selectedShapeClip) return
    const div = canvasDivRef.current
    if (!div) return
    const rect   = div.getBoundingClientRect()
    const mx     = e.clientX - rect.left
    const my     = e.clientY - rect.top
    const hit    = hitTestShapeHandles(mx, my, selectedShapeClip, rect.width, rect.height)

    if (!hit) {
      // Click is outside the selected shape — check if another shape was clicked
      const other = [...activeShapeClips].reverse().find(c =>
        c.id !== selectedShapeClip.id && hitTestShape(mx, my, c, rect.width, rect.height)
      )
      if (other) setSelectedClip(other.id)
      else       setSelectedClip(null)
      e.preventDefault()
      return
    }

    const clip = selectedShapeClip
    const cW   = rect.width
    const cH   = rect.height
    const sw   = ((clip.width  ?? 40) / 100) * cW
    const sh   = ((clip.height ?? 25) / 100) * cH
    const rot  = (clip.rotation ?? 0) * Math.PI / 180
    const cosR = Math.cos(rot), sinR = Math.sin(rot)
    const cx   = (clip.posX / 100) * cW
    const cy   = (clip.posY / 100) * cH

    // World-space position of the OPPOSITE (anchor) corner, stays fixed during resize
    let anchorW = null
    if (hit !== 'move') {
      const ANCHOR = {
        tl: [ sw / 2,  sh / 2],
        tr: [-sw / 2,  sh / 2],
        bl: [ sw / 2, -sh / 2],
        br: [-sw / 2, -sh / 2],
      }
      const [alx, aly] = ANCHOR[hit]
      anchorW = {
        x: cx + alx * cosR - aly * sinR,
        y: cy + alx * sinR + aly * cosR,
      }
    }

    shapeDragRef.current = {
      mode: hit, clipId: clip.id,
      startX: e.clientX, startY: e.clientY,
      startPosX: clip.posX, startPosY: clip.posY,
      canvasW: cW, canvasH: cH,
      canvasLeft: rect.left, canvasTop: rect.top,
      cosR, sinR,
      anchorW,
    }

    // Global handlers so drag continues outside the canvas element
    const handleMove = ev => {
      const drag = shapeDragRef.current
      if (!drag) return
      if (drag.mode === 'move') {
        const dx = ((ev.clientX - drag.startX) / drag.canvasW) * 100
        const dy = ((ev.clientY - drag.startY) / drag.canvasH) * 100
        updateClip(drag.clipId, {
          posX: Math.max(0, Math.min(100, drag.startPosX + dx)),
          posY: Math.max(0, Math.min(100, drag.startPosY + dy)),
        })
      } else {
        // Rotation-aware resize: work in shape-local coordinate space
        const { anchorW: aw, cosR: cr, sinR: sr, canvasW: cw, canvasH: ch,
                canvasLeft: cl, canvasTop: ct } = drag
        const wmx  = ev.clientX - cl
        const wmy  = ev.clientY - ct
        const dx   = wmx - aw.x
        const dy   = wmy - aw.y
        // Project onto local axes
        const lx   = dx * cr + dy * sr
        const ly   = -dx * sr + dy * cr
        const newW = Math.max(3, (Math.abs(lx) / cw) * 100)
        const newH = Math.max(3, (Math.abs(ly) / ch) * 100)
        // New center = midpoint between anchor and drag corner (in world space)
        const newCx = aw.x + (lx / 2) * cr - (ly / 2) * sr
        const newCy = aw.y + (lx / 2) * sr + (ly / 2) * cr
        updateClip(drag.clipId, {
          posX:   Math.max(0, Math.min(100, (newCx / cw) * 100)),
          posY:   Math.max(0, Math.min(100, (newCy / ch) * 100)),
          width:  newW,
          height: newH,
        })
      }
    }

    const handleUp = () => {
      saveHistory()
      shapeDragRef.current = null
      setHoverHandle(null)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup',   handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup',   handleUp)
    e.preventDefault()
  }

  // ── Double-click → inline text edit ────────────────────────────────────
  const onShapeDoubleClick = e => {
    if (!selectedShapeClip) return
    const div = canvasDivRef.current
    if (!div) return
    const canvasH  = div.getBoundingClientRect().height
    const sh       = (selectedShapeClip.height ?? 25) / 100 * canvasH
    const textSize = selectedShapeClip.textSize ?? 20
    setEditFontPx((textSize / 100) * sh)
    setEditingShapeId(selectedShapeClip.id)
    e.preventDefault()
  }

  const exitTextEdit = () => {
    saveHistory()
    setEditingShapeId(null)
  }

  // ── Apply playback rate from clip speed property ───────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = activeClip?.speed ?? 1
  }, [activeClip?.speed])

  // ── Spacebar play/pause ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(p => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPlaying])

  // ── Fullscreen change listener ─────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // ── Close zoom dropdown on outside click ─────────────────────────────
  useEffect(() => {
    if (!zoomOpen) return
    const onDown = e => {
      if (zoomRef.current && !zoomRef.current.contains(e.target)) setZoomOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [zoomOpen])

  // ── Close volume popup on outside click ──────────────────────────────
  useEffect(() => {
    if (!volOpen) return
    const onDown = e => {
      if (volWrapRef.current && !volWrapRef.current.contains(e.target)) setVolOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [volOpen])

  // ── Close speed popup on outside click ───────────────────────────────
  useEffect(() => {
    if (!speedOpen) return
    const onDown = e => {
      if (speedWrapRef.current && !speedWrapRef.current.contains(e.target)) setSpeedOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [speedOpen])

  // ── Controls ──────────────────────────────────────────────────────────
  const togglePlay  = () => setPlaying(!playing)
  const skipToStart = () => { setPlaying(false); setCurrentTime(0) }
  const skipToEnd   = () => { setPlaying(false); setCurrentTime(duration) }

  // ── Progress bar seek ─────────────────────────────────────────────────
  const seekToClientX = clientX => {
    if (!progressRef.current) return
    const { left, width } = progressRef.current.getBoundingClientRect()
    const t = Math.max(0, Math.min(duration, ((clientX - left) / width) * duration))
    setCurrentTime(t)
  }
  const onProgressMouseDown = e => {
    e.preventDefault()
    seekToClientX(e.clientX)
    const onMove = e => seekToClientX(e.clientX)
    const onUp   = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Fullscreen ────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    const el = previewRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen?.()
  }

  // ── Volume icon ───────────────────────────────────────────────────────
  const VolumeIcon = isMuted ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon

  return (
    <div className={styles.wrapper}>
      {/* ── Top toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.gap} />

        <button
          className={`${styles.fitBtn} ${previewZoom === 'fit' ? styles.fitBtnActive : ''}`}
          title="Fit to screen"
          onClick={() => setPreviewZoom('fit')}
        >
          <FitIcon />
        </button>

        <div className={styles.zoomWrap} ref={zoomRef}>
          <button
            className={`${styles.zoomBtn} ${zoomOpen ? styles.zoomBtnOpen : ''}`}
            onClick={() => setZoomOpen(p => !p)}
          >
            {zoomLabel}
            <svg
              viewBox="0 0 10 6" fill="currentColor" width="9" height="6"
              className={zoomOpen ? styles.caretUp : ''}
            >
              <path d="M0 0l5 6 5-6z"/>
            </svg>
          </button>

          {zoomOpen && (
            <div className={styles.zoomDropdown}>
              <div className={styles.zoomDropHeader}>Zoom Level</div>
              <button
                className={`${styles.zoomOption} ${previewZoom === 'fit' ? styles.zoomOptionSel : ''}`}
                onClick={() => { setPreviewZoom('fit'); setZoomOpen(false) }}
              >
                Fit
                {previewZoom === 'fit' && <CheckIcon />}
              </button>
              {ZOOM_LEVELS.map(z => (
                <button
                  key={z}
                  className={`${styles.zoomOption} ${previewZoom === z ? styles.zoomOptionSel : ''}`}
                  onClick={() => { setPreviewZoom(z); setZoomOpen(false) }}
                >
                  {z}%
                  {previewZoom === z && <CheckIcon />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas zone ── */}
      <div className={styles.previewArea} ref={previewRef}>
        <div
          ref={canvasDivRef}
          className={styles.canvas}
          style={{
            aspectRatio: `${ratio.w} / ${ratio.h}`,
            ...(canvasScale !== null ? { transform: `scale(${canvasScale})` } : {}),
          }}
        >
          {activeVideoClips.length > 0 ? (
            <>
              {/* SVG filter definitions for per-clip color curves */}
              {activeVideoClips.some(hasCurves) && (
                <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                  <defs>
                    {activeVideoClips.filter(hasCurves).map(clip => {
                      const rgbTV = curveToTableValues(clip.curves?.rgb)
                      const rTV   = curveToTableValues(clip.curves?.r)   ?? rgbTV
                      const gTV   = curveToTableValues(clip.curves?.g)   ?? rgbTV
                      const bTV   = curveToTableValues(clip.curves?.b)   ?? rgbTV
                      if (!rTV && !gTV && !bTV) return null
                      return (
                        <filter key={clip.id} id={`crv-${clip.id}`}
                          x="0" y="0" width="100%" height="100%"
                          colorInterpolationFilters="sRGB"
                        >
                          <feComponentTransfer>
                            {rTV && <feFuncR type="table" tableValues={rTV}/>}
                            {gTV && <feFuncG type="table" tableValues={gTV}/>}
                            {bTV && <feFuncB type="table" tableValues={bTV}/>}
                          </feComponentTransfer>
                        </filter>
                      )
                    })}
                  </defs>
                </svg>
              )}

              {transitionExitClips.map(({ clip, opacity, transform }) => {
                const clipT = (clip.trimIn ?? 0) + clip.durSec
                const base = buildVideoStyle(clip, clipT)
                const crvPart = hasCurves(clip) ? `url(#crv-${clip.id})` : ''
                const filterStr = [base.filter, crvPart].filter(Boolean).join(' ')
                const exitStyle = {
                  ...base,
                  filter: filterStr || undefined,
                  opacity: base.opacity * opacity,
                  ...(transform && { transform: `${transform} ${base.transform ?? ''}`.trim() }),
                }
                return (
                  <video
                    key={'exit-' + clip.id}
                    ref={el => { videoLayerRefs.current['exit-' + clip.id] = el }}
                    src={clip.src}
                    className={styles.videoOverlay}
                    style={exitStyle}
                    playsInline preload="auto" muted
                    disablePictureInPicture disableRemotePlayback
                    controlsList="nodownload nofullscreen noremoteplayback"
                    onContextMenu={e => e.preventDefault()}
                  />
                )
              })}

              {activeVideoClips.map((clip, idx) => {
                const clipT    = Math.max(0, currentTime - clip.startSec)
                const base     = buildVideoStyle(clip, clipT)
                const crvPart  = hasCurves(clip) ? `url(#crv-${clip.id})` : ''
                const filterStr = [base.filter, crvPart].filter(Boolean).join(' ')
                const ti = clip.transitionIn
                let transOpacity   = 1
                let transTransform = null
                let transClipPath  = null
                if (ti?.dur > 0) {
                  const elapsed = currentTime - clip.startSec
                  if (elapsed < ti.dur) {
                    const p = elapsed / ti.dur
                    switch (ti.type) {
                      case 'dissolve':   transOpacity = p; break
                      case 'fadeBlack':  transOpacity = Math.max(0, p * 2 - 1); break
                      case 'slideLeft':  transTransform = `translateX(${(1 - p) * 100}%)`; break
                      case 'slideRight': transTransform = `translateX(${-(1 - p) * 100}%)`; break
                      case 'slideUp':    transTransform = `translateY(${(1 - p) * 100}%)`; break
                      case 'slideDown':  transTransform = `translateY(${-(1 - p) * 100}%)`; break
                      case 'wipeLeft':   transClipPath = `inset(0 ${(1 - p) * 100}% 0 0)`; break
                      case 'wipeRight':  transClipPath = `inset(0 0 0 ${(1 - p) * 100}%)`; break
                      case 'zoomIn':     transOpacity = p; transTransform = `scale(${0.7 + p * 0.3})`; break
                      case 'zoomOut':    transOpacity = p; transTransform = `scale(${1.3 - p * 0.3})`; break
                      default:           transOpacity = p
                    }
                  }
                }
                const style = {
                  ...base,
                  opacity: base.opacity * transOpacity,
                  ...(transTransform && { transform: `${transTransform} ${base.transform ?? ''}`.trim() }),
                  ...(transClipPath  && { clipPath: transClipPath }),
                  filter: filterStr || undefined,
                  ...(idx !== 0 && { mixBlendMode: clip.blendMode ?? 'normal' }),
                }
                return (
                  <video
                    key={idx === 0 ? `v0-${clip.src}` : clip.id}
                    ref={el => {
                      videoLayerRefs.current[clip.id] = el
                      if (idx === 0) videoRef.current = el
                    }}
                    src={clip.src}
                    className={idx === 0 ? styles.videoCanvas : styles.videoOverlay}
                    style={style}
                    playsInline
                    preload="auto"
                    muted={idx !== 0}
                    disablePictureInPicture
                    disableRemotePlayback
                    controlsList="nodownload nofullscreen noremoteplayback"
                    onContextMenu={e => e.preventDefault()}
                  />
                )
              })}

              {/* Adjustment layers — backdrop-filter applies to all video layers below */}
              {activeAdjClips.map(adj => (
                <div
                  key={adj.id}
                  className={styles.adjustmentLayer}
                  style={{ backdropFilter: buildAdjFilter(adj), WebkitBackdropFilter: buildAdjFilter(adj) }}
                />
              ))}

              {(activeClip?.fade ?? 0) > 0 && (
                <div
                  className={styles.fadeOverlay}
                  style={{ opacity: (activeClip.fade ?? 0) / 100 }}
                />
              )}
            </>
          ) : (
            <div className={styles.emptyCanvas}>
              <div className={styles.emptyIcon}>
                <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" width="56" height="56">
                  <rect x="4" y="12" width="48" height="32" rx="3"/>
                  <circle cx="18" cy="23" r="4"/>
                  <polyline points="4,38 16,26 26,34 36,24 52,38"/>
                  <line x1="36" y1="4" x2="20" y2="4" strokeOpacity="0.3"/>
                  <line x1="28" y1="1" x2="28" y2="7" strokeOpacity="0.3"/>
                </svg>
              </div>
              <span className={styles.emptyTitle}>No preview</span>
              <span className={styles.emptyHint}>Drag media to the timeline to begin</span>
            </div>
          )}
          {/* Caption overlay */}
          {activeCaptionClips.length > 0 && (
            <div className={styles.captionLayer}>
              {activeCaptionClips.map(cap => (
                <div
                  key={cap.id}
                  className={styles.captionItem}
                  style={{
                    top:        `${cap.posY ?? 88}%`,
                    left:       '50%',
                    transform:  'translate(-50%, -50%)',
                    fontSize:   `${cap.fontSize ?? 5}cqh`,
                    color:      cap.color   ?? '#ffffff',
                    background: cap.bgColor ?? 'rgba(0,0,0,0.65)',
                    textAlign:  cap.align   ?? 'center',
                    fontWeight: cap.bold    ? 700 : 400,
                    fontStyle:  cap.italic  ? 'italic' : 'normal',
                  }}
                >
                  {cap.text}
                </div>
              ))}
            </div>
          )}

          {/* Text/shape overlay canvas */}
          <canvas ref={textCanvasRef} className={styles.textOverlay} />
          {/* Always-on click layer — selects any shape when none is currently selected */}
          {activeShapeClips.length > 0 && (
            <div
              className={styles.shapeSelectLayer}
              onMouseDown={e => {
                // Only handle when shapeInteract is NOT present (no selected shape)
                if (selectedShapeClip || editingShapeId) return
                const div = canvasDivRef.current
                if (!div) return
                const rect = div.getBoundingClientRect()
                const mx = e.clientX - rect.left
                const my = e.clientY - rect.top
                const hit = [...activeShapeClips].reverse().find(c =>
                  hitTestShape(mx, my, c, rect.width, rect.height)
                )
                if (hit) { setSelectedClip(hit.id); e.preventDefault() }
              }}
            />
          )}
          {/* Shape interaction overlay — move + corner-handle resize (hidden while editing text) */}
          {selectedShapeClip && !editingShapeId && (
            <div
              className={styles.shapeInteract}
              style={{ cursor: HANDLE_CURSORS[hoverHandle] ?? 'default' }}
              onMouseDown={onShapeMouseDown}
              onMouseMove={onShapePointerMove}
              onMouseLeave={onShapePointerLeave}
              onDoubleClick={onShapeDoubleClick}
            />
          )}
          {/* Inline text editor — shown when double-clicking a shape */}
          {editingShapeId && selectedShapeClip && editingShapeId === selectedShapeClip.id && (
            <div
              className={styles.shapeTextEditWrap}
              style={{
                left:      `${selectedShapeClip.posX}%`,
                top:       `${selectedShapeClip.posY}%`,
                width:     `${selectedShapeClip.width  ?? 40}%`,
                height:    `${selectedShapeClip.height ?? 25}%`,
                transform: `translate(-50%, -50%) rotate(${selectedShapeClip.rotation ?? 0}deg)`,
              }}
            >
              <textarea
                className={styles.shapeTextEditArea}
                style={{
                  fontSize:   `${editFontPx}px`,
                  color:      selectedShapeClip.textColor ?? '#ffffff',
                  textAlign:  selectedShapeClip.textAlign ?? 'center',
                  fontWeight: selectedShapeClip.textBold   ? 'bold'   : 'normal',
                  fontStyle:  selectedShapeClip.textItalic ? 'italic' : 'normal',
                }}
                defaultValue={selectedShapeClip.text ?? ''}
                autoFocus
                placeholder="Type here…"
                onChange={e => updateClip(selectedShapeClip.id, { text: e.target.value })}
                onBlur={exitTextEdit}
                onKeyDown={e => {
                  if (e.key === 'Escape') { exitTextEdit(); e.preventDefault() }
                  e.stopPropagation()
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Playback bar ── */}
      <div className={styles.playbackBar}>

        {/* Seekable scrub bar */}
        <div className={styles.progressWrap}>
          <div
            className={styles.progressTrack}
            ref={progressRef}
            onMouseDown={onProgressMouseDown}
          >
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            <div className={styles.progressThumb} style={{ left: `${progress}%` }} />
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.left}>
            <span className={styles.timeDisplay}>
              {formatTime(currentTime)}
              <span className={styles.timeSep}> / </span>
              <span className={styles.timeTotal}>{formatTime(duration)}</span>
            </span>
          </div>

          <div className={styles.center}>
            <button className={styles.skipBtn} title="Go to start (Home)" onClick={skipToStart}>
              <SkipBackIcon />
            </button>
            <button
              className={styles.playBtn}
              title={playing ? 'Pause (Space)' : 'Play (Space)'}
              onClick={togglePlay}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button className={styles.skipBtn} title="Go to end (End)" onClick={skipToEnd}>
              <SkipForwardIcon />
            </button>
          </div>

          <div className={styles.right}>
            {/* Speed presets */}
            <div className={styles.speedWrap} ref={speedWrapRef}>
              <button
                className={`${styles.speedBtn} ${speedOpen ? styles.speedBtnOpen : ''}`}
                title="Playback speed"
                onClick={() => setSpeedOpen(p => !p)}
              >
                {activeClip?.speed ? `${activeClip.speed}×` : '1×'}
              </button>
              {speedOpen && (
                <div className={styles.speedPopover}>
                  {[0.25, 0.5, 1, 1.5, 2].map(s => {
                    const active = (activeClip?.speed ?? 1) === s
                    return (
                      <button
                        key={s}
                        className={`${styles.speedOpt} ${active ? styles.speedOptActive : ''}`}
                        onClick={() => {
                          if (!selectedClipId) return
                          saveHistory()
                          const clip = allClips.find(c => c.id === selectedClipId)
                          if (!clip) return
                          const sourceDur = clip.durSec * (clip.speed ?? 1)
                          updateClip(selectedClipId, { speed: s, durSec: Math.max(0.2, sourceDur / s) })
                          setSpeedOpen(false)
                        }}
                      >
                        {s}×
                        {active && <span className={styles.speedOptCheck}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Volume */}
            <div className={styles.volWrap} ref={volWrapRef}>
              <button
                className={`${styles.iconBtn} ${volOpen ? styles.iconBtnActive : ''}`}
                title="Volume"
                onClick={() => setVolOpen(p => !p)}
              >
                <VolumeIcon />
              </button>

              {volOpen && (
                <div className={styles.volPopover}>
                  <span className={styles.volPct}>{Math.round(volume * 100)}%</span>
                  <input
                    className={styles.volSlider}
                    type="range"
                    min={0} max={1} step={0.02}
                    value={volume}
                    onChange={e => setVolume(Number(e.target.value))}
                  />
                  <button
                    className={`${styles.volMuteBtn} ${isMuted ? styles.volMuteBtnActive : ''}`}
                    onClick={() => setVolume(v => v > 0 ? 0 : 1)}
                  >
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              className={styles.iconBtn}
              title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
