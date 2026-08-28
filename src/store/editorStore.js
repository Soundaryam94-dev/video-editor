import { create } from 'zustand'

export const useEditorStore = create((set) => ({
  projectName: 'Untitled Project',
  currentTime: 0,
  duration: 0,
  playing: false,
  zoom: 0,
  activeTool: 'media',
  selectedClipId: null,

  // Shared clip list — Timeline writes, Preview reads
  // duration auto-updates from clip end times
  clips: [],
  setClips: (fn) => set(s => {
    const clips = typeof fn === 'function' ? fn(s.clips) : fn
    const duration = clips.length > 0
      ? Math.max(...clips.map(c => c.startSec + c.durSec))
      : 0
    return { clips, duration }
  }),

  // Undo / redo history — snapshots of clips array
  past:   [],
  future: [],
  saveHistory: () => set(s => ({
    past:   [...s.past.slice(-49), s.clips],
    future: [],
  })),
  undo: () => set(s => {
    if (s.past.length === 0) return {}
    const clips    = s.past[s.past.length - 1]
    const past     = s.past.slice(0, -1)
    const future   = [s.clips, ...s.future.slice(0, 49)]
    const duration = clips.length > 0 ? Math.max(...clips.map(c => c.startSec + c.durSec)) : 0
    return { clips, past, future, duration }
  }),
  redo: () => set(s => {
    if (s.future.length === 0) return {}
    const clips    = s.future[0]
    const future   = s.future.slice(1)
    const past     = [...s.past.slice(-49), s.clips]
    const duration = clips.length > 0 ? Math.max(...clips.map(c => c.startSec + c.durSec)) : 0
    return { clips, past, future, duration }
  }),

  // Live clip update — no history, used while dragging property sliders
  updateClip: (id, changes) => set(s => ({
    clips: s.clips.map(c => c.id === id ? { ...c, ...changes } : c)
  })),
  // Alias for text panel (recalculates duration for text clips)
  updateTextClip: (id, changes) => set(s => {
    const clips = s.clips.map(c => c.id === id ? { ...c, ...changes } : c)
    const duration = clips.length > 0 ? Math.max(...clips.map(c => c.startSec + c.durSec)) : 0
    return { clips, duration }
  }),

  hiddenTracks: {},
  setTrackHidden: (id, hidden) => set(s => ({
    hiddenTracks: { ...s.hiddenTracks, [id]: hidden }
  })),

  mutedTracks: {},
  setTrackMuted: (id, muted) => set(s => ({
    mutedTracks: { ...s.mutedTracks, [id]: muted }
  })),

  soloedTracks: {},
  setTrackSoloed: (id, soloed) => set(s => ({
    soloedTracks: { ...s.soloedTracks, [id]: soloed }
  })),

  canvasRatio: { id: '16:9', w: 16, h: 9, label: '16:9', pw: 1920, ph: 1080 },
  setCanvasRatio: (r) => set({ canvasRatio: r }),

  // Source clip focused in Media panel — used by Insert button to create trimmed timeline clip
  pendingSource: null,
  setPendingSource: (source) => set({ pendingSource: source }),

  // Saved subclip library
  subclips: [],
  addSubclip: (clip) => set(s => ({ subclips: [...s.subclips, clip] })),
  updateSubclip: (id, fields) => set(s => ({ subclips: s.subclips.map(sc => sc.id !== id ? sc : { ...sc, ...fields }) })),

  markers: [],
  addMarker:    (m)     => set(s => ({ markers: [...s.markers, m] })),
  removeMarker: (id)    => set(s => ({ markers: s.markers.filter(m => m.id !== id) })),
  updateMarker: (id, f) => set(s => ({ markers: s.markers.map(m => m.id === id ? { ...m, ...f } : m) })),

  loopEnabled: false,
  loopIn:      null,
  loopOut:     null,
  setLoopEnabled: (v)        => set({ loopEnabled: v }),
  setLoopRegion:  (inn, out) => set({ loopIn: inn, loopOut: out }),

  setProjectName: (name) => set({ projectName: name }),
  setCurrentTime: (t)    => set({ currentTime: t }),
  setPlaying: (v)        => set({ playing: v }),
  togglePlaying: ()      => set(s => ({ playing: !s.playing })),
  setZoom: (z)           => set({ zoom: z }),
  setActiveTool: (tool)  => set({ activeTool: tool }),
  setSelectedClip: (id)  => set({ selectedClipId: id }),

  loadProject: (data) => set({
    clips:        data.clips ?? [],
    markers:      data.markers ?? [],
    projectName:  data.projectName ?? 'Untitled Project',
    canvasRatio:  data.canvasRatio ?? { id: '16:9', w: 16, h: 9, label: '16:9', pw: 1920, ph: 1080 },
    duration:     data.clips?.length > 0 ? Math.max(...data.clips.map(c => c.startSec + c.durSec)) : 0,
    past:         [],
    future:       [],
    selectedClipId: null,
    playing:      false,
    currentTime:  0,
  }),

  // Per-track audio volume (0–2, default 1)
  trackVolumes: {},
  setTrackVolume: (trackId, vol) => set(s => ({
    trackVolumes: { ...s.trackVolumes, [trackId]: vol },
  })),

  // Color curve management — stores per-channel control points
  setCurve: (clipId, channel, pts) => set(s => ({
    clips: s.clips.map(c => c.id !== clipId ? c : {
      ...c, curves: { ...(c.curves ?? {}), [channel]: pts },
    }),
  })),

  // Keyframe management
  setKeyframe: (clipId, prop, t, v) => set(s => {
    const clips = s.clips.map(c => {
      if (c.id !== clipId) return c
      const kfs = { ...(c.keyframes ?? {}) }
      const existing = (kfs[prop] ?? []).filter(kf => Math.abs(kf.t - t) > 0.05)
      kfs[prop] = [...existing, { t, v }].sort((a, b) => a.t - b.t)
      return { ...c, keyframes: kfs }
    })
    const duration = clips.length > 0 ? Math.max(...clips.map(c => c.startSec + c.durSec)) : 0
    return { clips, duration }
  }),
  removeKeyframe: (clipId, prop, t) => set(s => {
    const clips = s.clips.map(c => {
      if (c.id !== clipId) return c
      const kfs = { ...(c.keyframes ?? {}) }
      kfs[prop] = (kfs[prop] ?? []).filter(kf => Math.abs(kf.t - t) > 0.05)
      return { ...c, keyframes: kfs }
    })
    const duration = clips.length > 0 ? Math.max(...clips.map(c => c.startSec + c.durSec)) : 0
    return { clips, duration }
  }),
}))
