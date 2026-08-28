import React, { useState, useEffect, useRef } from 'react'
import styles from './ResizeModal.module.css'
import { useEditorStore } from '../../store/editorStore'

// ── Preset library ─────────────────────────────────────────────────────────
const PRESETS = [
  // Social
  { id: 'ig-post',    name: 'Instagram Post',     sub: 'Square',         pw: 1080, ph: 1080, rw: 1,  rh: 1,  cat: 'Social'        },
  { id: 'ig-story',   name: 'Instagram Story',    sub: 'Portrait',       pw: 1080, ph: 1920, rw: 9,  rh: 16, cat: 'Social'        },
  { id: 'ig-reel',    name: 'Instagram Reel',     sub: 'Vertical',       pw: 1080, ph: 1920, rw: 9,  rh: 16, cat: 'Social'        },
  { id: 'tiktok',     name: 'TikTok Video',       sub: 'Vertical',       pw: 1080, ph: 1920, rw: 9,  rh: 16, cat: 'Social'        },
  { id: 'fb-video',   name: 'Facebook Video',     sub: 'Landscape',      pw: 1280, ph: 720,  rw: 16, rh: 9,  cat: 'Social'        },
  { id: 'tw-video',   name: 'Twitter/X Video',    sub: 'Landscape',      pw: 1280, ph: 720,  rw: 16, rh: 9,  cat: 'Social'        },
  // Video
  { id: 'yt-video',   name: 'YouTube Video',      sub: 'Full HD',        pw: 1920, ph: 1080, rw: 16, rh: 9,  cat: 'Video'         },
  { id: 'yt-short',   name: 'YouTube Short',      sub: 'Vertical',       pw: 1080, ph: 1920, rw: 9,  rh: 16, cat: 'Video'         },
  { id: 'yt-thumb',   name: 'YouTube Thumbnail',  sub: 'Landscape',      pw: 1280, ph: 720,  rw: 16, rh: 9,  cat: 'Video'         },
  { id: '4k',         name: '4K Ultra HD',        sub: 'Landscape',      pw: 3840, ph: 2160, rw: 16, rh: 9,  cat: 'Video'         },
  { id: 'cinema',     name: 'Cinematic',          sub: 'Ultrawide 21:9', pw: 2560, ph: 1080, rw: 21, rh: 9,  cat: 'Video'         },
  { id: 'vertical',   name: 'Vertical Video',     sub: 'Portrait 9:16',  pw: 1080, ph: 1920, rw: 9,  rh: 16, cat: 'Video'         },
  // Presentation
  { id: 'pres-169',   name: 'Presentation',       sub: '16:9 Widescreen',pw: 1920, ph: 1080, rw: 16, rh: 9,  cat: 'Presentation'  },
  { id: 'pres-43',    name: 'Presentation',       sub: '4:3 Standard',   pw: 1024, ph: 768,  rw: 4,  rh: 3,  cat: 'Presentation'  },
  { id: 'pres-sq',    name: 'Presentation',       sub: '1:1 Square',     pw: 1080, ph: 1080, rw: 1,  rh: 1,  cat: 'Presentation'  },
]

const CATS = ['All', 'Social', 'Video', 'Presentation']

const THUMB_MAX = 48

function PresetThumb({ rw, rh, selected }) {
  const tw = rw >= rh ? THUMB_MAX : Math.round(THUMB_MAX * rw / rh)
  const th = rh >= rw ? THUMB_MAX : Math.round(THUMB_MAX * rh / rw)
  return (
    <div className={styles.thumbWrap}>
      <div
        className={`${styles.thumb} ${selected ? styles.thumbSel : ''}`}
        style={{ width: tw, height: th }}
      />
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export default function ResizeModal({ onClose }) {
  const canvasRatio    = useEditorStore(s => s.canvasRatio)
  const setCanvasRatio = useEditorStore(s => s.setCanvasRatio)

  const [cat, setCat]             = useState('All')
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null)          // preset id or null
  const [customW, setCustomW]     = useState(canvasRatio.pw ?? 1920)
  const [customH, setCustomH]     = useState(canvasRatio.ph ?? 1080)
  const [linked, setLinked]       = useState(false)         // lock aspect ratio
  const searchRef                  = useRef(null)

  // Auto-focus search on open
  useEffect(() => { searchRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const ratio = linked ? customW / customH : null

  const onWChange = v => {
    const n = Math.max(1, Number(v) || 1)
    setCustomW(n)
    if (linked && ratio) setCustomH(Math.round(n / ratio))
    setSelected(null)
  }
  const onHChange = v => {
    const n = Math.max(1, Number(v) || 1)
    setCustomH(n)
    if (linked && ratio) setCustomW(Math.round(n * ratio))
    setSelected(null)
  }

  const pickPreset = p => {
    setSelected(p.id)
    setCustomW(p.pw)
    setCustomH(p.ph)
  }

  const apply = () => {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
    const g   = gcd(customW, customH)
    setCanvasRatio({
      id:    selected ?? 'custom',
      w:     customW / g,
      h:     customH / g,
      label: `${customW / g}:${customH / g}`,
      pw:    customW,
      ph:    customH,
    })
    onClose()
  }

  const filtered = PRESETS.filter(p => {
    const inCat    = cat === 'All' || p.cat === cat
    const inSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sub.toLowerCase().includes(search.toLowerCase())
    return inCat && inSearch
  })

  return (
    <div className={styles.backdrop} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true">

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="18" height="18">
              <rect x="2" y="2" width="7" height="7" rx="1.5"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5"/>
            </svg>
            <span className={styles.title}>Resize canvas</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
              <line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/>
            </svg>
          </button>
        </div>

        {/* ── Custom size ── */}
        <div className={styles.customSection}>
          <span className={styles.sectionLabel}>Custom size</span>
          <div className={styles.sizeRow}>
            <div className={styles.sizeField}>
              <label className={styles.sizeLabel}>W</label>
              <input
                className={styles.sizeInput}
                type="number"
                min="1"
                value={customW}
                onChange={e => onWChange(e.target.value)}
              />
            </div>
            <button
              className={`${styles.linkBtn} ${linked ? styles.linkBtnOn : ''}`}
              onClick={() => setLinked(l => !l)}
              title={linked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            >
              {linked ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="14" height="14">
                  <rect x="4" y="7" width="8" height="7" rx="1.5"/>
                  <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="14" height="14">
                  <rect x="4" y="7" width="8" height="7" rx="1.5"/>
                  <path d="M10.5 7V4a2.5 2.5 0 0 0-5 0"/>
                </svg>
              )}
            </button>
            <div className={styles.sizeField}>
              <label className={styles.sizeLabel}>H</label>
              <input
                className={styles.sizeInput}
                type="number"
                min="1"
                value={customH}
                onChange={e => onHChange(e.target.value)}
              />
            </div>
            <span className={styles.unit}>px</span>
          </div>
        </div>

        {/* ── Divider + search ── */}
        <div className={styles.presetHeader}>
          <span className={styles.sectionLabel}>Presets</span>
          <input
            ref={searchRef}
            className={styles.searchInput}
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Category tabs ── */}
        <div className={styles.tabs}>
          {CATS.map(c => (
            <button
              key={c}
              className={`${styles.tab} ${cat === c ? styles.tabActive : ''}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* ── Preset grid ── */}
        <div className={styles.grid}>
          {filtered.length === 0 && (
            <div className={styles.empty}>No presets match "{search}"</div>
          )}
          {filtered.map(p => {
            const sel = selected === p.id
            return (
              <button
                key={p.id}
                className={`${styles.card} ${sel ? styles.cardSel : ''}`}
                onClick={() => pickPreset(p)}
              >
                <PresetThumb rw={p.rw} rh={p.rh} selected={sel} />
                <span className={styles.cardName}>{p.name}</span>
                <span className={styles.cardSub}>{p.sub}</span>
                <span className={styles.cardDim}>{p.pw} × {p.ph}</span>
              </button>
            )
          })}
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.applyBtn} onClick={apply}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
              <polyline points="2 8 6 12 14 4"/>
            </svg>
            Apply Resize
          </button>
        </div>

      </div>
    </div>
  )
}
