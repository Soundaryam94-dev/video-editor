import React, { useState, useRef, useCallback, useEffect } from 'react'
import styles from './MediaPanel.module.css'
import { useEditorStore } from '../../store/editorStore'
import AIMusic from './AIMusic'

const TABS      = ['All', 'Videos', 'Images', 'Audio', 'Stock', 'Clips']

function fmtDur(secs) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function extBadge(name) {
  return name.split('.').pop().toUpperCase()
}


// ── Stock API helpers ──────────────────────────────────────────────────────
async function fetchPexelsVideos(key, query, page) {
  const r = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=20&page=${page}`,
    { headers: { Authorization: key } }
  )
  const d = await r.json()
  return (d.videos ?? []).flatMap(v => {
    const file = v.video_files?.find(f => f.quality === 'sd' && f.file_type === 'video/mp4')
      || v.video_files?.find(f => f.file_type === 'video/mp4')
      || v.video_files?.[0]
    if (!file?.link) return []
    return [{
      id: `pexels-v-${v.id}`, source: 'Pexels', type: 'video',
      thumbnail: v.image, src: file.link,
      duration: v.duration, width: v.width, height: v.height,
      author: v.user?.name ?? 'Pexels',
    }]
  })
}

async function fetchPexelsPhotos(key, query, page) {
  const r = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20&page=${page}`,
    { headers: { Authorization: key } }
  )
  const d = await r.json()
  return (d.photos ?? []).map(p => ({
    id: `pexels-p-${p.id}`, source: 'Pexels', type: 'image',
    thumbnail: p.src?.medium, src: p.src?.large || p.src?.original,
    width: p.width, height: p.height, author: p.photographer ?? 'Pexels',
  }))
}

async function fetchPixabayVideos(key, query, page) {
  const r = await fetch(
    `https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(query)}&per_page=20&page=${page}`
  )
  const d = await r.json()
  return (d.hits ?? []).flatMap(v => {
    const vid = v.videos?.medium || v.videos?.small || v.videos?.large
    if (!vid?.url) return []
    return [{
      id: `pixabay-v-${v.id}`, source: 'Pixabay', type: 'video',
      thumbnail: vid.thumbnail, src: vid.url,
      duration: v.duration, width: vid.width, height: vid.height,
      author: v.user ?? 'Pixabay',
    }]
  })
}

async function fetchPixabayPhotos(key, query, page) {
  const r = await fetch(
    `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&per_page=20&page=${page}&image_type=photo`
  )
  const d = await r.json()
  return (d.hits ?? []).map(p => ({
    id: `pixabay-p-${p.id}`, source: 'Pixabay', type: 'image',
    thumbnail: p.previewURL, src: p.webformatURL,
    width: p.imageWidth, height: p.imageHeight, author: p.user ?? 'Pixabay',
  }))
}

async function fetchFreesoundAudio(key, query) {
  const q = query.trim() || 'background music'
  const r = await fetch(
    `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(q)}&token=${key}&fields=id,name,duration,previews,username,tags&page_size=20&filter=duration:[5 TO 300]&format=json`
  )
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    if (r.status === 401) throw new Error('Invalid API key — enter the correct key below.')
    if (r.status === 429) throw new Error('Rate limit reached — wait a moment and try again.')
    throw new Error(`Freesound error ${r.status}: ${txt.slice(0, 80)}`)
  }
  const d = await r.json()
  return (d.results ?? []).map(a => ({
    id: `freesound-${a.id}`,
    title: a.name || 'Track',
    tags: (a.tags ?? []).slice(0, 2),
    duration: fmtDur(Math.round(a.duration ?? 0)),
    durationSecs: Math.round(a.duration ?? 0),
    src: a.previews?.['preview-hq-mp3'] || a.previews?.['preview-lq-mp3'] || '',
    author: a.username ?? 'Freesound',
  }))
}

// ── Video thumbnail generator ─────────────────────────────────────────────
function generateThumbFromVideo(src, seekSec, width = 160, height = 90) {
  return new Promise(resolve => {
    if (!src) return resolve(null)
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'
    video.src = src
    video.onloadedmetadata = () => {
      video.currentTime = Math.max(0, Math.min(seekSec, video.duration - 0.05))
    }
    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      try {
        canvas.getContext('2d').drawImage(video, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      } catch { resolve(null) }
    }
    video.onerror = () => resolve(null)
  })
}

// ── Waveform generator ────────────────────────────────────────────────────
async function generateWaveformFromUrl(url, width = 800, height = 28) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    // Use callback form for broad browser compatibility
    const audioBuffer = await new Promise((resolve, reject) =>
      audioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject)
    )
    audioCtx.close()

    const channel = audioBuffer.getChannelData(0)
    const blockSz = Math.max(1, Math.floor(channel.length / width))
    const canvas  = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const mid = height / 2

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'

    for (let i = 0; i < width; i++) {
      let peak = 0
      const start = i * blockSz
      for (let j = 0; j < blockSz; j++) {
        const abs = Math.abs(channel[start + j] ?? 0)
        if (abs > peak) peak = abs
      }
      const h = Math.max(1, peak * mid * 0.92)
      ctx.fillRect(i, mid - h, 1, h * 2)
    }
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

// ── Audio track row ────────────────────────────────────────────────────────
function AudioTrackRow({ title, tags, duration, isPlaying, onPlay, onAdd, draggable, onDragStart }) {
  const [added, setAdded] = useState(false)

  const handleAdd = e => {
    e.stopPropagation()
    onAdd?.()
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className={styles.audioTrackRow} draggable={draggable} onDragStart={onDragStart}>
      <div className={styles.audioTrackIcon}>
        <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
          <rect x="1" y="7" width="3" height="6" rx="1.5"/>
          <rect x="6" y="3" width="3" height="14" rx="1.5"/>
          <rect x="11" y="5" width="3" height="10" rx="1.5"/>
          <rect x="16" y="8" width="3" height="4" rx="1.5"/>
        </svg>
      </div>
      <div className={styles.audioTrackInfo}>
        <div className={styles.audioTrackTitle} title={title}>{title}</div>
        <div className={styles.audioTrackMeta}>
          <span className={styles.audioTrackTags}>{tags.join(' • ')}</span>
          <span className={styles.audioTrackDur}>{duration}</span>
        </div>
      </div>
      <div className={styles.audioTrackActions}>
        <button
          className={`${styles.audioPlayBtn} ${isPlaying ? styles.audioPlayBtnActive : ''}`}
          onClick={e => { e.stopPropagation(); onPlay() }}
          title={isPlaying ? 'Pause preview' : 'Preview'}
        >
          {isPlaying
            ? <svg viewBox="0 0 10 12" fill="currentColor" width="9" height="11"><rect x="0.5" y="0.5" width="3" height="11" rx="1"/><rect x="6.5" y="0.5" width="3" height="11" rx="1"/></svg>
            : <svg viewBox="0 0 10 12" fill="currentColor" width="9" height="11"><polygon points="1,0.5 9.5,6 1,11.5"/></svg>
          }
        </button>
        {onAdd && (
          <button
            className={`${styles.audioAddBtn} ${added ? styles.audioAddBtnDone : ''}`}
            onClick={handleAdd}
            title="Add to timeline"
          >
            {added
              ? <svg viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="9" height="7"><polyline points="1,4 3.5,6.5 9,1"/></svg>
              : <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="9" height="9"><line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/></svg>
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export default function MediaPanel() {
  const [tab, setTab]           = useState('All')
  const [media, setMedia]       = useState([])
  const [audioList, setAudio]   = useState([])
  const [draggingOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const setClips        = useEditorStore(s => s.setClips)
  const clips           = useEditorStore(s => s.clips)
  const pendingSource   = useEditorStore(s => s.pendingSource)
  const setPendingSource = useEditorStore(s => s.setPendingSource)
  const subclips        = useEditorStore(s => s.subclips)
  const updateSubclip   = useEditorStore(s => s.updateSubclip)

  // ── Stock state ────────────────────────────────────────────────────────
  const [stockType,    setStockType]    = useState('videos')
  const [stockQuery,   setStockQuery]   = useState('')
  const [stockResults, setStockResults] = useState([])
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError,   setStockError]   = useState('')
  const [stockPage,    setStockPage]    = useState(1)
  const [stockHasMore, setStockHasMore] = useState(false)
  const [showKeys,     setShowKeys]     = useState(false)
  const [pexelsKey,    setPexelsKey]    = useState(() => localStorage.getItem('ve_pexels_key')  || '')
  const [pixabayKey,   setPixabayKey]   = useState(() => localStorage.getItem('ve_pixabay_key') || '')
  const [pexelsInput,  setPexelsInput]  = useState(() => localStorage.getItem('ve_pexels_key')  || '')
  const [pixabayInput, setPixabayInput] = useState(() => localStorage.getItem('ve_pixabay_key') || '')

  // ── AI Music modal state ───────────────────────────────────────────────
  const [showAIModal, setShowAIModal] = useState(false)

  // ── Audio browse state ─────────────────────────────────────────────────
  const [audioSubTab,    setAudioSubTab]    = useState('trending')
  const [audioSearch,    setAudioSearch]    = useState('')
  const [trendTracks,    setTrendTracks]    = useState([])
  const [trendLoading,   setTrendLoading]   = useState(false)
  const [trendError,     setTrendError]     = useState('')
  const [playingId,      setPlayingId]      = useState(null)
  const [freesoundKey,      setFreesoundKey]      = useState(() => localStorage.getItem('ve_freesound_key') || '')
  const [audioKeyInput,    setAudioKeyInput]    = useState('')
  const [audioKeySaved,    setAudioKeySaved]    = useState(false)
  const [showAudioKeyPanel, setShowAudioKeyPanel] = useState(false)
  const audioPlayerRef = useRef(null)


  const hasKeys = !!(pexelsKey || pixabayKey)

  const saveKeys = () => {
    localStorage.setItem('ve_pexels_key',  pexelsInput.trim())
    localStorage.setItem('ve_pixabay_key', pixabayInput.trim())
    setPexelsKey(pexelsInput.trim())
    setPixabayKey(pixabayInput.trim())
    setShowKeys(false)
  }


  // ── Fetch trending audio ───────────────────────────────────────────────
  const loadTrending = useCallback(async (query = '') => {
    if (!freesoundKey) return
    setTrendLoading(true)
    setTrendError('')
    try {
      const tracks = await fetchFreesoundAudio(freesoundKey, query)
      setTrendTracks(tracks)
      if (tracks.length === 0) setTrendError('No results found.')
    } catch (e) {
      setTrendError(e.message)
      if (e.message.includes('Invalid API key') || e.message.includes('401')) {
        setShowAudioKeyPanel(true)
        setAudioKeyInput(freesoundKey)
      }
    } finally {
      setTrendLoading(false)
    }
  }, [freesoundKey])

  useEffect(() => {
    if (tab === 'Audio' && freesoundKey && trendTracks.length === 0 && !trendLoading) {
      loadTrending()
    }
  }, [tab, freesoundKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio playback ─────────────────────────────────────────────────────
  const handlePlay = useCallback((id, src) => {
    if (playingId === id) {
      audioPlayerRef.current?.pause()
      audioPlayerRef.current = null
      setPlayingId(null)
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
        audioPlayerRef.current = null
      }
      setPlayingId(id)
      if (src) {
        const player = new Audio(src)
        player.play().catch(() => {})
        player.onended = () => setPlayingId(null)
        audioPlayerRef.current = player
      }
    }
  }, [playingId])


  // ── Stock search ───────────────────────────────────────────────────────
  const runSearch = useCallback(async (query, type, page = 1) => {
    if (!query.trim()) return
    setStockLoading(true)
    setStockError('')
    if (page === 1) setStockResults([])

    const results = []
    const errors  = []

    await Promise.allSettled([
      pexelsKey  && (type === 'videos' ? fetchPexelsVideos(pexelsKey, query, page)  : fetchPexelsPhotos(pexelsKey, query, page)).then(r  => results.push(...r)).catch(e  => errors.push('Pexels: ' + e.message)),
      pixabayKey && (type === 'videos' ? fetchPixabayVideos(pixabayKey, query, page) : fetchPixabayPhotos(pixabayKey, query, page)).then(r => results.push(...r)).catch(e => errors.push('Pixabay: ' + e.message)),
    ])

    setStockResults(prev => page === 1 ? results : [...prev, ...results])
    setStockHasMore(results.length >= 15)
    setStockLoading(false)
    if (results.length === 0)
      setStockError(errors.length ? errors.join(' · ') : 'No results found — try a different search term.')
  }, [pexelsKey, pixabayKey])

  const handleSearchSubmit = e => {
    e.preventDefault()
    setStockPage(1)
    runSearch(stockQuery, stockType, 1)
  }

  const loadMore = () => {
    const next = stockPage + 1
    setStockPage(next)
    runSearch(stockQuery, stockType, next)
  }

  // ── Add to timeline ────────────────────────────────────────────────────
  const addToTimeline = useCallback((src, name, type, durationSecs, waveformSrc = null) => {
    const trackId = type === 'audio' ? 'a1' : 'v1'
    const clipId  = `c${Date.now()}${Math.random()}`
    setClips(prev => {
      const trackClips = prev.filter(c => c.track === trackId)
      const startSec   = trackClips.length === 0
        ? 0
        : Math.max(...trackClips.map(c => c.startSec + c.durSec))
      const durSec = durationSecs
      if (durSec < 0.01) return prev
      return [...prev, {
        id: clipId,
        track: trackId, startSec, durSec,
        src, name, type,
        label: name, style: type === 'audio' ? 'b' : 'a',
        waveform: type === 'audio',
        waveformSrc: waveformSrc ?? null,
        sourceDur: durationSecs,
      }]
    })
    return clipId
  }, [setClips])

  const updateClipWaveform = useCallback((clipId, waveformSrc) => {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, waveformSrc } : c))
  }, [setClips])

  // ── Universal waveform generation ──────────────────────────────────────
  // Catches every audio clip that lacks a waveform — drag-to-timeline,
  // click-to-add, or any other entry path.
  const pendingWaveforms = useRef(new Set())
  useEffect(() => {
    clips.forEach(clip => {
      if (clip.type !== 'audio') return
      if (clip.waveformSrc) return
      if (!clip.src) return
      if (pendingWaveforms.current.has(clip.id)) return
      pendingWaveforms.current.add(clip.id)
      generateWaveformFromUrl(clip.src)
        .then(waveformSrc => { if (waveformSrc) updateClipWaveform(clip.id, waveformSrc) })
        .catch(() => {})
    })
  }, [clips, updateClipWaveform])

  // ── Universal thumbnail generation for saved subclips ─────────────────
  const pendingThumbs = useRef(new Set())
  useEffect(() => {
    subclips.forEach(sc => {
      if (sc.thumb) return
      if (!sc.src) return
      if (pendingThumbs.current.has(sc.id)) return
      pendingThumbs.current.add(sc.id)
      generateThumbFromVideo(sc.src, sc.trimIn ?? 0)
        .then(thumb => { if (thumb) updateSubclip(sc.id, { thumb }) })
        .catch(() => {})
    })
  }, [subclips, updateSubclip])

  const handleAIAdd = useCallback((url, name, waveformSrc) => {
    const audio = document.createElement('audio')
    audio.src = url
    audio.onloadedmetadata = () => {
      setAudio(prev => [...prev, { id: Date.now() + Math.random(), name, duration: fmtDur(audio.duration), durationSecs: audio.duration, src: url }])
      addToTimeline(url, name, 'audio', audio.duration, waveformSrc)
    }
    audio.onerror = () => {
      setAudio(prev => [...prev, { id: Date.now() + Math.random(), name, duration: '--:--', durationSecs: 30, src: url }])
      addToTimeline(url, name, 'audio', 30, waveformSrc)
    }
  }, [addToTimeline])

  const importStock = useCallback((item) => {
    const name = `${item.source.toLowerCase()}-${item.id.split('-').pop()}`
    if (item.type === 'video') {
      setMedia(prev => [...prev, {
        id: Date.now() + Math.random(), name: name + '.mp4',
        type: 'video', duration: fmtDur(item.duration ?? 5),
        durationSecs: item.duration ?? 5, thumb: item.thumbnail, src: item.src,
      }])
      addToTimeline(item.src, name, 'video', item.duration ?? 5)
    } else {
      setMedia(prev => [...prev, {
        id: Date.now() + Math.random(), name: name + '.jpg',
        type: 'image', thumb: item.thumbnail, src: item.src, durationSecs: 5,
      }])
      addToTimeline(item.src, name, 'image', 5)
    }
  }, [addToTimeline])

  // ── Process local files ────────────────────────────────────────────────
  const processFiles = useCallback((fileList) => {
    Array.from(fileList).forEach(file => {
      const { type: mime, name } = file
      const objectUrl = URL.createObjectURL(file)

      if (mime.startsWith('video/')) {
        const video = document.createElement('video')
        video.preload = 'metadata'; video.muted = true; video.src = objectUrl
        video.onloadedmetadata = () => { video.currentTime = Math.min(1, video.duration * 0.1) }
        video.onseeked = () => {
          const canvas = document.createElement('canvas')
          canvas.width = 160; canvas.height = 90
          try { canvas.getContext('2d').drawImage(video, 0, 0, 160, 90) } catch (_) {}
          setMedia(prev => [...prev, {
            id: Date.now() + Math.random(), name, type: 'video',
            duration: fmtDur(video.duration), durationSecs: video.duration,
            thumb: canvas.toDataURL('image/jpeg', 0.75), src: objectUrl,
          }])
          addToTimeline(objectUrl, name, 'video', video.duration)
        }
        video.onerror = () => {
          setMedia(prev => [...prev, { id: Date.now() + Math.random(), name, type: 'video', duration: '--:--', durationSecs: 5, emoji: '🎬', src: objectUrl }])
          addToTimeline(objectUrl, name, 'video', 5)
        }
      } else if (mime.startsWith('audio/')) {
        const audio = document.createElement('audio')
        audio.preload = 'metadata'; audio.src = objectUrl
        audio.onloadedmetadata = () => {
          const dur = audio.duration
          setAudio(prev => [...prev, { id: Date.now() + Math.random(), name, duration: fmtDur(dur), durationSecs: dur, src: objectUrl }])
          addToTimeline(objectUrl, name, 'audio', dur)
        }
        audio.onerror = () => {
          setAudio(prev => [...prev, { id: Date.now() + Math.random(), name, duration: '--:--', durationSecs: 5, src: objectUrl }])
          addToTimeline(objectUrl, name, 'audio', 5)
        }
      } else if (mime.startsWith('image/')) {
        setMedia(prev => [...prev, { id: Date.now() + Math.random(), name, type: 'image', thumb: objectUrl, src: objectUrl, durationSecs: 5 }])
        addToTimeline(objectUrl, name, 'image', 5)
      }
    })
  }, [addToTimeline])

  const onFileChange = e => { if (e.target.files?.length) { processFiles(e.target.files); e.target.value = '' } }

  const openAudioPicker = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'audio/*,.mp3,.wav,.aac,.ogg,.flac,.m4a,.opus,.wma'
    input.onchange = e => { if (e.target.files?.length) processFiles(e.target.files) }
    input.click()
  }, [processFiles])
  const onDragOver   = e => { e.preventDefault(); setDragOver(true) }
  const onDragLeave  = e => { e.preventDefault(); setDragOver(false) }
  const onDrop       = e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files) }

  const visibleMedia = media.filter(m => {
    if (tab === 'Videos') return m.type === 'video'
    if (tab === 'Images') return m.type === 'image'
    return true
  })

  const onMediaDragStart = (e, item) => {
    e.dataTransfer.setData('application/x-media-item', JSON.stringify({
      id: item.id, src: item.src, name: item.name, type: item.type,
      durationSecs: item.durationSecs ?? 5,
      trimIn: item.trimIn ?? 0,
      sourceDur: item.sourceDur,
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }
  const onAudioDragStart = (e, item) => {
    e.dataTransfer.setData('application/x-media-item', JSON.stringify({ id: item.id, src: item.src, name: item.name, type: 'audio', durationSecs: item.durationSecs ?? 5 }))
    e.dataTransfer.effectAllowed = 'copy'
  }
  const onStockDragStart = (e, item) => {
    e.dataTransfer.setData('application/x-media-item', JSON.stringify({ id: item.id, src: item.src, name: item.source + ' ' + item.type, type: item.type, durationSecs: item.duration ?? 5 }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  // ── Render audio panel ─────────────────────────────────────────────────
  const renderAudio = () => {
    const handleAudioSearch = e => {
      e.preventDefault()
      if (audioSubTab === 'trending') loadTrending(audioSearch)
    }

    const q = audioSearch.trim().toLowerCase()
    const filteredTracks  = q ? trendTracks.filter(t => t.title.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q))) : trendTracks
    const filteredUploads = q ? audioList.filter(a => a.name.toLowerCase().includes(q)) : audioList

    const apiSetupCard = (
      <div className={styles.apiSetupCard}>
        <div className={styles.apiSetupTitle}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
            <rect x="2.5" y="7.5" width="11" height="7.5" rx="1.5"/><path d="M5 7.5V5.5a3 3 0 0 1 6 0v2"/><circle cx="8" cy="11.5" r="1" fill="currentColor"/>
          </svg>
          {freesoundKey ? 'Update Freesound API key' : 'Connect Freesound to search audio'}
        </div>
        <div className={styles.apiSteps}>
          <div className={styles.apiStep}>
            <span className={styles.apiStepNum}>1</span>
            <span className={styles.apiStepText}>
              Create a free account at{' '}
              <a href="https://freesound.org/home/register/" target="_blank" rel="noopener noreferrer" className={styles.apiLink}>freesound.org/home/register</a>
            </span>
          </div>
          <div className={styles.apiStep}>
            <span className={styles.apiStepNum}>2</span>
            <span className={styles.apiStepText}>
              Log in → go to{' '}
              <a href="https://freesound.org/apiv2/apply" target="_blank" rel="noopener noreferrer" className={styles.apiLink}>freesound.org/apiv2/apply</a>
              {' '}→ create an app → copy the <strong>API Key (token)</strong>
            </span>
          </div>
          <div className={styles.apiStep}>
            <span className={styles.apiStepNum}>3</span>
            <span className={styles.apiStepText}>Paste it below and click Save</span>
          </div>
        </div>
        <div className={styles.apiInputRow}>
          <input
            className={styles.apiKeyInput}
            type="text"
            placeholder="Paste Freesound API key here…"
            value={audioKeyInput}
            onChange={e => { setAudioKeyInput(e.target.value); setAudioKeySaved(false) }}
          />
          <button
            className={styles.apiSaveBtn}
            disabled={!audioKeyInput.trim()}
            onClick={() => {
              const k = audioKeyInput.trim()
              localStorage.setItem('ve_freesound_key', k)
              setFreesoundKey(k)
              setTrendTracks([])
              setTrendError('')
              setAudioKeySaved(true)
              setShowAudioKeyPanel(false)
            }}
          >
            {audioKeySaved ? '✓ Saved' : 'Save'}
          </button>
        </div>
        <p className={styles.apiHint}>Free · 2,000 req/day · 500k Creative Commons sounds</p>
      </div>
    )

    return (
      <div className={styles.audioPanel}>

        {/* Generate AI Music */}
        <button className={styles.aiMusicBtn} onClick={() => setShowAIModal(true)}>
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style={{ flexShrink: 0 }}>
            <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11l-1.5-3.5L3 6l3.5-1.5L8 1z"/>
            <path d="M13 9.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8.8-1.7z" opacity="0.7"/>
          </svg>
          Generate AI Music
        </button>

        {/* Tab bar */}
        <div className={styles.audioTabBar}>
          <div className={styles.audioTabs}>
            <button
              className={`${styles.audioTabBtn} ${audioSubTab === 'trending' ? styles.audioTabActive : ''}`}
              onClick={() => { setAudioSubTab('trending'); setAudioSearch('') }}
            >
              Trending
            </button>
            <button
              className={`${styles.audioTabBtn} ${audioSubTab === 'uploads' ? styles.audioTabActive : ''}`}
              onClick={() => { setAudioSubTab('uploads'); setAudioSearch('') }}
            >
              My Uploads
              {audioList.length > 0 && (
                <span className={styles.audioTabBadge}>{audioList.length}</span>
              )}
            </button>
          </div>
          <button
            className={`${styles.audioKeyIcon} ${showAudioKeyPanel ? styles.audioKeyIconActive : ''}`}
            title={freesoundKey ? 'Update Freesound API key' : 'Add Freesound API key'}
            onClick={() => { setShowAudioKeyPanel(p => !p); if (!audioKeyInput) setAudioKeyInput(freesoundKey) }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <rect x="2.5" y="7.5" width="11" height="7.5" rx="1.5"/><path d="M5 7.5V5.5a3 3 0 0 1 6 0v2"/><circle cx="8" cy="11.5" r="1" fill="currentColor"/>
            </svg>
          </button>
        </div>

        {/* Search bar — below tabs, context-aware */}
        <form className={styles.audioSearchRow} onSubmit={handleAudioSearch}>
          <div className={styles.audioSearchWrap}>
            <span className={styles.audioSearchIcon}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13">
                <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
              </svg>
            </span>
            <input
              className={styles.audioSearchInput}
              placeholder={audioSubTab === 'trending' ? 'Search Freesound…' : 'Filter my uploads…'}
              value={audioSearch}
              onChange={e => setAudioSearch(e.target.value)}
            />
            {audioSearch && (
              <button type="button" className={styles.audioSearchClear} onClick={() => setAudioSearch('')}>
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="8" height="8">
                  <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
                </svg>
              </button>
            )}
          </div>
          {audioSubTab === 'trending' && (
            <button type="submit" className={styles.audioSearchBtn} title="Search Freesound" disabled={!freesoundKey}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13">
                <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
              </svg>
            </button>
          )}
        </form>

        {/* API key card — shown when no key or key panel open */}
        {(!freesoundKey || showAudioKeyPanel) && apiSetupCard}

        {/* ── Trending tab ── */}
        {audioSubTab === 'trending' && (
          <div className={styles.audioTabContent}>
            {freesoundKey && trendLoading && (
              <div className={styles.audioSpinnerWrap}>
                <div className={styles.audioSpinner}/>
                <span>Loading…</span>
              </div>
            )}
            {freesoundKey && !trendLoading && trendError && (
              <div className={styles.audioError}>{trendError}</div>
            )}
            {freesoundKey && !trendLoading && !trendError && trendTracks.length === 0 && (
              <div className={styles.audioEmpty}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="32" height="32" style={{ opacity: 0.3 }}>
                  <rect x="1" y="7" width="3" height="6" rx="1.5"/>
                  <rect x="6" y="3" width="3" height="14" rx="1.5"/>
                  <rect x="11" y="5" width="3" height="10" rx="1.5"/>
                  <rect x="16" y="8" width="3" height="4" rx="1.5"/>
                </svg>
                <span>Type a keyword and press Enter to search</span>
              </div>
            )}
            {freesoundKey && !trendLoading && trendTracks.length > 0 && filteredTracks.length === 0 && (
              <div className={styles.audioEmpty}>
                <span>No tracks match "{audioSearch}"</span>
              </div>
            )}
            {freesoundKey && !trendLoading && filteredTracks.map(track => (
              <AudioTrackRow
                key={track.id}
                title={track.title}
                tags={track.tags.length ? track.tags : ['Music']}
                duration={track.duration}
                isPlaying={playingId === track.id}
                onPlay={() => handlePlay(track.id, track.src)}
                onAdd={() => addToTimeline(track.src, track.title, 'audio', track.durationSecs)}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/x-media-item', JSON.stringify({
                    id: track.id, src: track.src, name: track.title, type: 'audio', durationSecs: track.durationSecs,
                  }))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              />
            ))}
          </div>
        )}

        {/* ── My Uploads tab ── */}
        {audioSubTab === 'uploads' && (
          <div className={styles.audioTabContent}>
            <button
              className={styles.audioUploadBtn}
              onClick={openAudioPicker}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M8 2v9M4.5 5.5L8 2l3.5 3.5M2 12v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1"/>
              </svg>
              Upload audio file
            </button>
            {audioList.length === 0 ? (
              <div className={styles.audioEmpty}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="32" height="32" style={{ opacity: 0.3 }}>
                  <rect x="1" y="7" width="3" height="6" rx="1.5"/>
                  <rect x="6" y="3" width="3" height="14" rx="1.5"/>
                  <rect x="11" y="5" width="3" height="10" rx="1.5"/>
                  <rect x="16" y="8" width="3" height="4" rx="1.5"/>
                </svg>
                <span>No uploads yet — drag &amp; drop audio here or click Upload</span>
              </div>
            ) : filteredUploads.length === 0 ? (
              <div className={styles.audioEmpty}>
                <span>No uploads match "{audioSearch}"</span>
              </div>
            ) : (
              filteredUploads.map(a => (
                <AudioTrackRow
                  key={a.id}
                  title={a.name}
                  tags={['My Upload']}
                  duration={a.duration}
                  isPlaying={playingId === a.id}
                  onPlay={() => handlePlay(a.id, a.src)}
                  onAdd={() => addToTimeline(a.src, a.name, 'audio', a.durationSecs)}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/x-media-item', JSON.stringify({
                      id: a.id, src: a.src, name: a.name, type: 'audio', durationSecs: a.durationSecs,
                    }))
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                />
              ))
            )}
          </div>
        )}

      </div>
    )
  }

  // ── Render stock panel ─────────────────────────────────────────────────
  const renderStock = () => (
    <div className={styles.stockPanel}>
      <form className={styles.stockSearchBar} onSubmit={handleSearchSubmit}>
        <input
          className={styles.stockInput}
          placeholder={stockType === 'videos' ? 'Search videos…' : 'Search photos…'}
          value={stockQuery}
          onChange={e => setStockQuery(e.target.value)}
        />
        <button className={styles.stockSearchBtn} type="submit" title="Search" disabled={stockLoading || !hasKeys}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13">
            <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
          </svg>
        </button>
        <button type="button" className={`${styles.stockKeyBtn} ${showKeys ? styles.stockKeyBtnActive : ''}`} onClick={() => setShowKeys(p => !p)} title="API Keys">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
            <rect x="2.5" y="7.5" width="11" height="7.5" rx="1.5"/><path d="M5 7.5V5.5a3 3 0 0 1 6 0v2"/><circle cx="8" cy="11.5" r="1" fill="currentColor"/>
          </svg>
        </button>
      </form>

      {showKeys && (
        <div className={styles.keysPanel}>
          <p className={styles.keysHint}>
            Get free keys at <strong>pexels.com/api</strong> and <strong>pixabay.com/api/docs</strong>
          </p>
          <label className={styles.keyLabel}>Pexels API Key</label>
          <input className={styles.keyInput} type="password" placeholder="Paste your Pexels key…" value={pexelsInput} onChange={e => setPexelsInput(e.target.value)}/>
          <label className={styles.keyLabel}>Pixabay API Key</label>
          <input className={styles.keyInput} type="password" placeholder="Paste your Pixabay key…" value={pixabayInput} onChange={e => setPixabayInput(e.target.value)}/>
          <button className={styles.keySaveBtn} onClick={saveKeys}>Save Keys</button>
        </div>
      )}

      <div className={styles.stockTypeRow}>
        {['videos', 'photos'].map(t => (
          <button key={t} className={`${styles.stockTypeBtn} ${stockType === t ? styles.stockTypeBtnActive : ''}`} onClick={() => { setStockType(t); setStockResults([]); setStockError('') }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        {hasKeys && (
          <span className={styles.stockProviders}>
            {pexelsKey  && <span className={styles.providerBadge} style={{ background: 'rgba(5,153,95,0.18)', color: '#05995f' }}>Pexels</span>}
            {pixabayKey && <span className={styles.providerBadge} style={{ background: 'rgba(35,131,226,0.18)', color: '#2383e2' }}>Pixabay</span>}
          </span>
        )}
      </div>

      {!hasKeys && (
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="36" height="36" style={{ opacity: 0.3 }}>
            <circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12L20 3M18 5l2 2M16 3h4v4"/>
          </svg>
          <span>API keys required</span>
          <span className={styles.emptyHint}>Click the key icon above to add your Pexels or Pixabay API key</span>
        </div>
      )}

      {hasKeys && stockResults.length === 0 && !stockLoading && !stockError && (
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="32" height="32" style={{ opacity: 0.3 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>Search for {stockType}</span>
          <span className={styles.emptyHint}>Type a query above and press Enter</span>
        </div>
      )}

      {stockError && <div className={styles.stockError}>{stockError}</div>}

      {stockLoading && stockResults.length === 0 && (
        <div className={styles.stockSpinnerWrap}>
          <div className={styles.stockSpinner}/>
          <span>Searching…</span>
        </div>
      )}

      {stockResults.length > 0 && (
        <div className={styles.stockGrid}>
          {stockResults.map(item => (
            <div key={item.id} className={styles.stockItem} draggable onDragStart={e => onStockDragStart(e, item)} title={`${item.author} · ${item.source}`}>
              <div className={styles.stockThumb}>
                <img src={item.thumbnail} alt="" className={styles.stockThumbImg} loading="lazy"/>
                {item.type === 'video' && item.duration && <span className={styles.stockDur}>{fmtDur(item.duration)}</span>}
                <div className={styles.stockOverlay}>
                  <button className={styles.stockImportBtn} onClick={() => importStock(item)}>
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12">
                      <line x1="7" y1="2" x2="7" y2="10"/><line x1="4" y1="7" x2="7" y2="10"/><line x1="10" y1="7" x2="7" y2="10"/>
                      <line x1="2" y1="12" x2="12" y2="12"/>
                    </svg>
                    Import
                  </button>
                </div>
              </div>
              <div className={styles.stockMeta}>
                <span className={styles.stockAuthor}>{item.author}</span>
                <span className={`${styles.stockSource} ${item.source === 'Pexels' ? styles.sourcePexels : styles.sourcePixabay}`}>{item.source}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {stockLoading && stockResults.length > 0 && <div className={styles.stockLoadingMore}><div className={styles.stockSpinner}/></div>}

      {stockHasMore && !stockLoading && stockResults.length > 0 && (
        <button className={styles.loadMoreBtn} onClick={loadMore}>Load more</button>
      )}
    </div>
  )

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className={styles.panel} style={{ position: 'relative' }}>
      <div className={styles.header}>
        <span className={styles.title}>Media</span>
      </div>

      {tab !== 'Stock' && tab !== 'Audio' && tab !== 'Clips' && (
        <div className={`${styles.uploadSection} ${draggingOver ? styles.dragActive : ''}`}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        >
          <input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*,.mp4,.mov,.avi,.webm,.mkv,.mp3,.wav,.aac,.ogg,.jpg,.jpeg,.png,.gif,.webp" className={styles.fileInput} onChange={onFileChange}/>
          <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            Upload media
          </button>
          <p className={styles.uploadHint}>{draggingOver ? 'Drop files here' : 'or drag & drop · drag clips to timeline'}</p>
        </div>
      )}

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.activeTab : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Stock' && renderStock()}
      {tab === 'Audio' && renderAudio()}

      {tab === 'Clips' && (
        <div className={styles.scroll}>
          {subclips.length === 0
            ? <div className={styles.emptyState}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="32" height="32">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <polygon points="10,8 16,12 10,16"/>
                </svg>
                <span>No clips saved yet</span>
                <span className={styles.emptyHint}>Set Mark In &amp; Out, then click the Clip button</span>
              </div>
            : <div className={styles.grid}>
                {subclips.map(sc => (
                  <div
                    key={sc.id}
                    className={`${styles.thumb} ${pendingSource?.src === sc.src && pendingSource?.trimIn === sc.trimIn ? styles.thumbSelected : ''}`}
                    draggable
                    onDragStart={e => onMediaDragStart(e, sc)}
                    onClick={() => setPendingSource({ src: sc.src, name: sc.name, type: sc.type, durationSecs: sc.durationSecs, trimIn: sc.trimIn })}
                    title={`${sc.name} · ${sc.duration} · Drag to timeline`}
                  >
                    <div className={styles.thumbImg}>
                      {sc.thumb
                        ? <img src={sc.thumb} alt={sc.name} className={styles.thumbPreview}/>
                        : <span>🎬</span>
                      }
                    </div>
                    <span className={`${styles.badge} ${styles.badgeVideo}`}>CLIP</span>
                    <span className={styles.duration}>{sc.duration}</span>
                    <div className={styles.thumbName}>{sc.name}</div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {tab !== 'Stock' && tab !== 'Audio' && tab !== 'Clips' && (
        <div className={styles.scroll}>
          {visibleMedia.length === 0
            ? <div className={styles.emptyState}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="32" height="32">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>No {tab !== 'All' ? tab.toLowerCase() : 'media'} uploaded yet</span>
                <span className={styles.emptyHint}>Click Upload or drag files above</span>
              </div>
            : <div className={styles.grid}>
                {visibleMedia.map(m => (
                  <div
                    key={m.id}
                    className={`${styles.thumb} ${pendingSource?.src === m.src ? styles.thumbSelected : ''}`}
                    draggable
                    onDragStart={e => onMediaDragStart(e, m)}
                    onClick={() => setPendingSource({ src: m.src, name: m.name, type: m.type, durationSecs: m.durationSecs ?? 5 })}
                    title={`Click to select as source · Drag to timeline · ${m.name}`}
                  >
                    <div className={styles.thumbImg}>
                      {m.thumb ? <img src={m.thumb} alt={m.name} className={styles.thumbPreview}/> : <span>{m.emoji || (m.type === 'video' ? '🎬' : '🖼️')}</span>}
                    </div>
                    <span className={`${styles.badge} ${m.type === 'video' ? styles.badgeVideo : styles.badgeImage}`}>{extBadge(m.name)}</span>
                    {m.duration && <span className={styles.duration}>{m.duration}</span>}
                    <div className={styles.thumbName}>{m.name}</div>
                    {pendingSource?.src === m.src && <div className={styles.sourceLabel}>SOURCE</div>}
                  </div>
                ))}
              </div>
          }

          {tab === 'All' && audioList.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Audio Files</div>
              {audioList.map(a => (
                <div
                  key={a.id}
                  className={`${styles.audioItem} ${pendingSource?.src === a.src ? styles.audioItemSelected : ''}`}
                  draggable
                  onDragStart={e => onAudioDragStart(e, a)}
                  onClick={() => setPendingSource({ src: a.src, name: a.name, type: 'audio', durationSecs: a.durationSecs ?? 5 })}
                  title={`Click to select as source · Drag to timeline · ${a.name}`}
                >
                  <div className={styles.audioIcon}>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <rect x="1" y="7" width="3" height="6" rx="1.5"/>
                      <rect x="6" y="3" width="3" height="14" rx="1.5"/>
                      <rect x="11" y="5" width="3" height="10" rx="1.5"/>
                      <rect x="16" y="8" width="3" height="4" rx="1.5"/>
                    </svg>
                  </div>
                  <div className={styles.audioInfo}>
                    <div className={styles.audioName}>{a.name}</div>
                    <div className={styles.audioDur}>{a.duration}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {showAIModal && (
        <AIMusic
          onClose={() => setShowAIModal(false)}
          onAdd={handleAIAdd}
        />
      )}
    </div>
  )
}
