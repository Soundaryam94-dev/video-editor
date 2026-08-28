import React, { useState, useRef } from 'react'
import styles from './ExportModal.module.css'
import { useEditorStore } from '../../store/editorStore'
import { ensureFFmpeg, resetFFmpeg } from '../../lib/ffmpegSingleton'
import { drawTextClips } from '../../utils/textRenderer'

// ── Helpers ───────────────────────────────────────────────────────────────────
function guessExt(src) {
  const path = (src || '').split('?')[0]
  const file = path.split('/').pop() || ''
  const dot  = file.lastIndexOf('.')
  if (dot >= 0) {
    const ext = file.slice(dot + 1).toLowerCase()
    if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) return ext
  }
  return 'mp4'
}

function computeSegments(sortedClips, start, end) {
  const segs = []
  let cursor = start
  for (const clip of sortedClips) {
    const cs = clip.startSec
    const ce = cs + clip.durSec
    if (ce <= start) continue
    if (cs >= end) break
    const effStart = Math.max(cs, start)
    const effEnd   = Math.min(ce, end)
    if (cursor < effStart - 0.01)
      segs.push({ type: 'gap', dur: effStart - cursor })
    segs.push({ type: 'clip', clip, trimIn: (clip.trimIn ?? 0) + (effStart - cs), dur: effEnd - effStart })
    cursor = effEnd
  }
  if (cursor < end - 0.01) segs.push({ type: 'gap', dur: end - cursor })
  return segs
}

async function runExport({ clips, hiddenTracks, ratio, crf, fps, onStep, onProgress, ffmpegRef }) {
  const { fetchFile } = await import('@ffmpeg/util')

  onStep('Initializing FFmpeg…')
  onProgress(3)
  // Animate progress slowly while WASM compiles (gives visual feedback)
  let fake = 3
  const ticker = setInterval(() => {
    fake = Math.min(fake + 0.4, 16)
    onProgress(Math.round(fake))
  }, 250)
  let ffmpeg
  try {
    ffmpeg = await ensureFFmpeg()
  } finally {
    clearInterval(ticker)
  }
  ffmpegRef.current = ffmpeg
  ffmpeg.on('log', ({ type, message }) => console.log(`[FFmpeg ${type}]`, message))
  onProgress(18)

  // Pick highest-priority visible video track
  const primaryTrack = ['v1', 'v2', 'v3', 'v4'].find(id =>
    !hiddenTracks[id] &&
    clips.some(c => c.track === id && c.type !== 'text' && c.type !== 'audio')
  )
  if (!primaryTrack)
    throw new Error('No visible video clips found.\nAdd video clips to the timeline and try again.')

  const vClips = clips
    .filter(c => c.track === primaryTrack && c.type !== 'text' && c.type !== 'audio')
    .sort((a, b) => a.startSec - b.startSec)

  const totalDur = vClips.reduce((m, c) => Math.max(m, c.startSec + c.durSec), 0)
  const segments = computeSegments(vClips, 0, totalDur)

  const { pw: W, ph: H } = ratio
  const scaleF = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}`

  const vFiles = []
  const aFiles = []

  // exec() in @ffmpeg/ffmpeg v0.12 returns exit code (never throws) — check it
  const run = async (args, label) => {
    const code = await ffmpeg.exec(args)
    if (code !== 0) throw new Error(`FFmpeg failed at "${label}" (exit ${code}).\nCheck the browser console for FFmpeg logs.`)
  }

  // ── Process each segment ──────────────────────────────────────────────────
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    onProgress(18 + Math.round((i / segments.length) * 58))

    if (seg.type === 'gap') {
      onStep(`Generating gap ${i + 1}/${segments.length}…`)
      const vn = `gv${i}.mp4`, an = `ga${i}.aac`
      await run([
        '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${fps}:d=${seg.dur.toFixed(3)}`,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', vn,
      ], 'gap video')
      await run([
        '-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:d=${seg.dur.toFixed(3)}`,
        '-t', seg.dur.toFixed(3), '-c:a', 'aac', '-b:a', '64k', an,
      ], 'gap audio')
      vFiles.push(vn); aFiles.push(an)
    } else {
      const { clip, trimIn, dur } = seg
      onStep(`Processing "${clip.name || clip.label || 'clip'}" (${i + 1}/${segments.length})…`)

      const ext = guessExt(clip.src)
      const inF = `ci${i}.${ext}`, vF = `cv${i}.mp4`, aF = `ca${i}.aac`

      try {
        await ffmpeg.writeFile(inF, await fetchFile(clip.src))
      } catch (err) {
        throw new Error(
          `Cannot fetch "${clip.name || 'clip'}".\n` +
          `Stock media may have CORS restrictions — download the file and import it locally.\n(${err.message})`
        )
      }

      // Video only
      const vfStr = clip.reversed ? `${scaleF},reverse` : scaleF
      await run([
        '-ss', trimIn.toFixed(3), '-i', inF, '-t', dur.toFixed(3),
        '-vf', vfStr, '-an',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', String(crf), '-pix_fmt', 'yuv420p',
        vF,
      ], `encode video segment ${i + 1}`)

      // Audio — check return code instead of try/catch (exec() returns code, never throws)
      const afArgs = clip.reversed ? ['-af', 'areverse'] : []
      const audioCode = await ffmpeg.exec([
        '-ss', trimIn.toFixed(3), '-i', inF, '-t', dur.toFixed(3),
        '-vn', ...afArgs, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', aF,
      ])
      if (audioCode !== 0) {
        // No audio stream — generate silence
        await run([
          '-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:d=${dur.toFixed(3)}`,
          '-t', dur.toFixed(3), '-c:a', 'aac', '-b:a', '64k', aF,
        ], 'silence fallback')
      }

      await ffmpeg.deleteFile(inF)
      vFiles.push(vF); aFiles.push(aF)
    }
  }

  // ── Concatenate video ──────────────────────────────────────────────────────
  onStep('Concatenating video…'); onProgress(78)
  await ffmpeg.writeFile('vlist.txt', new TextEncoder().encode(vFiles.map(f => `file '${f}'`).join('\n')))
  await run(['-f', 'concat', '-safe', '0', '-i', 'vlist.txt', '-c', 'copy', 'vonly.mp4'], 'concat video')
  for (const f of vFiles) { try { await ffmpeg.deleteFile(f) } catch {} }

  // ── Concatenate audio ──────────────────────────────────────────────────────
  onStep('Concatenating audio…'); onProgress(82)
  await ffmpeg.writeFile('alist.txt', new TextEncoder().encode(aFiles.map(f => `file '${f}'`).join('\n')))
  await run(['-f', 'concat', '-safe', '0', '-i', 'alist.txt', '-c', 'copy', 'aonly.aac'], 'concat audio')
  for (const f of aFiles) { try { await ffmpeg.deleteFile(f) } catch {} }

  // ── Mix in audio-track clips (a1 / a2 / a3) ───────────────────────────────
  let finalAudioFile = 'aonly.aac'
  const audioTrackClips = clips
    .filter(c => ['a1', 'a2', 'a3'].includes(c.track) && !hiddenTracks[c.track])
    .sort((a, b) => a.startSec - b.startSec)

  if (audioTrackClips.length > 0) {
    onStep(`Mixing ${audioTrackClips.length} audio track clip(s)…`); onProgress(86)
    const posFiles = []

    for (let i = 0; i < audioTrackClips.length; i++) {
      const clip   = audioTrackClips[i]
      const inF    = `atr${i}.bin`
      const trimF  = `atr${i}t.aac`
      const posF   = `atr${i}p.aac`
      const tIn    = clip.trimIn ?? 0
      const dur    = Math.min(clip.durSec, totalDur - clip.startSec)
      if (dur <= 0) continue

      try {
        await ffmpeg.writeFile(inF, await fetchFile(clip.src))
      } catch (e) {
        console.warn(`Skipping audio clip "${clip.name}": ${e.message}`)
        continue
      }

      await run([
        '-ss', tIn.toFixed(3), '-i', inF, '-t', dur.toFixed(3),
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', trimF,
      ], `trim audio clip ${i + 1}`)
      try { await ffmpeg.deleteFile(inF) } catch {}

      // Pad with silence before and after to position on the timeline
      const delayMs = Math.round(clip.startSec * 1000)
      await run([
        '-i', trimF,
        '-af', `adelay=${delayMs}|${delayMs},apad=pad_dur=${totalDur.toFixed(3)}`,
        '-t', totalDur.toFixed(3),
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', posF,
      ], `position audio clip ${i + 1}`)
      try { await ffmpeg.deleteFile(trimF) } catch {}
      posFiles.push(posF)
    }

    if (posFiles.length > 0) {
      const mixCount = posFiles.length + 1 // +1 for aonly.aac (video audio)
      const mixInputs = ['-i', 'aonly.aac', ...posFiles.flatMap(f => ['-i', f])]
      await run([
        ...mixInputs,
        '-filter_complex', `amix=inputs=${mixCount}:duration=first:dropout_transition=2:normalize=0`,
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', 'amixed.aac',
      ], 'mix audio tracks')
      for (const f of posFiles) { try { await ffmpeg.deleteFile(f) } catch {} }
      finalAudioFile = 'amixed.aac'
    }
  }

  // ── Composite text overlays onto video ────────────────────────────────────
  const textClips = clips
    .filter(c => c.type === 'text')
    .sort((a, b) => (a.startSec ?? 0) - (b.startSec ?? 0))
  let finalVideoFile = 'vonly.mp4'

  if (textClips.length > 0) {
    onStep(`Compositing ${textClips.length} text overlay(s)…`); onProgress(87)

    // Render each text clip as a full-canvas PNG at its midpoint (stable, non-animated frame)
    const textPngNames = []
    for (let i = 0; i < textClips.length; i++) {
      const clip    = textClips[i]
      const midTime = (clip.startSec ?? 0) + (clip.durSec ?? 5) / 2
      const canvas  = document.createElement('canvas')
      canvas.width  = W
      canvas.height = H
      drawTextClips(canvas.getContext('2d'), [clip], W, H, midTime)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      const fname = `tpng${i}.png`
      await ffmpeg.writeFile(fname, new Uint8Array(await blob.arrayBuffer()))
      textPngNames.push(fname)
    }

    // Build chained overlay filter: [0:v][1:v]overlay=...[vt0];[vt0][2:v]overlay=...[vout]
    const extraInputs = textPngNames.flatMap(f => ['-i', f])
    const filterParts = textClips.map((clip, i) => {
      const s = (clip.startSec ?? 0).toFixed(3)
      const e = ((clip.startSec ?? 0) + (clip.durSec ?? 5)).toFixed(3)
      const inPin  = i === 0 ? '[0:v]' : `[vt${i - 1}]`
      const outPin = i === textClips.length - 1 ? '[vout]' : `[vt${i}]`
      return `${inPin}[${i + 1}:v]overlay=0:0:enable='between(t,${s},${e})'${outPin}`
    })

    await run([
      '-i', 'vonly.mp4',
      ...extraInputs,
      '-filter_complex', filterParts.join(';'),
      '-map', '[vout]',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', String(crf), '-pix_fmt', 'yuv420p',
      'vtextd.mp4',
    ], 'composite text overlays')

    for (const f of textPngNames) { try { await ffmpeg.deleteFile(f) } catch {} }
    try { await ffmpeg.deleteFile('vonly.mp4') } catch {}
    finalVideoFile = 'vtextd.mp4'
  }

  // ── Merge & finalize ───────────────────────────────────────────────────────
  onStep('Merging & packaging…'); onProgress(91)
  await run([
    '-i', finalVideoFile, '-i', finalAudioFile,
    '-c:v', 'copy', '-c:a', 'copy',
    '-shortest', '-movflags', '+faststart',
    'output.mp4',
  ], 'final merge')

  onStep('Reading output…'); onProgress(98)
  const data = await ffmpeg.readFile('output.mp4')
  onProgress(100)
  return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }))
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const CheckCircle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
    <circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/>
  </svg>
)
const XCircle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
)
const DownloadIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M3 11h10M8 3v7M5 7l3 4 3-4"/>
  </svg>
)

// ── Component ─────────────────────────────────────────────────────────────────
const QUALITY = [
  { id: 'high',   label: 'High',   hint: 'CRF 18 · large file',    crf: 18 },
  { id: 'medium', label: 'Medium', hint: 'CRF 23 · balanced',       crf: 23 },
  { id: 'low',    label: 'Low',    hint: 'CRF 28 · smaller file',   crf: 28 },
  { id: 'draft',  label: 'Draft',  hint: 'CRF 35 · fastest preview', crf: 35 },
]
const FPS_OPTIONS = [24, 25, 30, 60]

export default function ExportModal({ onClose }) {
  const clips        = useEditorStore(s => s.clips)
  const hiddenTracks = useEditorStore(s => s.hiddenTracks)
  const ratio        = useEditorStore(s => s.canvasRatio)
  const projectName  = useEditorStore(s => s.projectName)

  const [phase,    setPhase]    = useState('settings')
  const [progress, setProgress] = useState(0)
  const [stepLabel, setStep]    = useState('')
  const [outputUrl, setOutputUrl] = useState(null)
  const [error,    setError]    = useState(null)

  const [filename, setFilename] = useState(projectName.replace(/[^a-z0-9_\- ]/gi, '') || 'export')
  const [quality,  setQuality]  = useState('medium')
  const [fps,      setFps]      = useState(30)

  const ffmpegRef = useRef(null)
  const abortRef  = useRef(false)

  // Kick off WASM load immediately while user configures settings
  React.useEffect(() => {
    ensureFFmpeg().catch(resetFFmpeg)
  }, [])

  const handleExport = async () => {
    abortRef.current = false
    setPhase('exporting')
    setProgress(0)
    setStep('')
    setError(null)
    try {
      const url = await runExport({
        clips, hiddenTracks, ratio,
        crf: QUALITY.find(q => q.id === quality)?.crf ?? 23,
        fps,
        onStep:     setStep,
        onProgress: setProgress,
        ffmpegRef,
      })
      setOutputUrl(url)
      setPhase('done')
    } catch (err) {
      if (abortRef.current) return
      console.error('[Export]', err)
      setError(err.message ?? String(err))
      setPhase('error')
    }
  }

  const handleCancel = () => {
    abortRef.current = true
    try { ffmpegRef.current?.terminate() } catch {}
    ffmpegRef.current = null
    resetFFmpeg() // allow fresh load next time if we terminated mid-export
    if (phase === 'exporting') { setPhase('settings'); setProgress(0); setStep('') }
    else onClose()
  }

  const handleDownload = () => {
    if (!outputUrl) return
    const a = document.createElement('a')
    a.href = outputUrl
    a.download = filename.endsWith('.mp4') ? filename : `${filename}.mp4`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const overlayClick = e => {
    if (e.target === e.currentTarget && phase !== 'exporting') onClose()
  }

  const hasVideoClips = clips.some(c => !hiddenTracks[c.track] && c.type !== 'text' && c.type !== 'audio')

  return (
    <div className={styles.overlay} onMouseDown={overlayClick}>
      <div className={styles.modal}>

        {/* ── Settings ── */}
        {phase === 'settings' && (
          <>
            <div className={styles.header}>
              <span className={styles.title}>Export Video</span>
              <button className={styles.closeBtn} onClick={onClose}>✕</button>
            </div>

            <div className={styles.body}>
              <div className={styles.field}>
                <label className={styles.label}>Filename</label>
                <div className={styles.fileRow}>
                  <input
                    className={styles.input}
                    value={filename}
                    onChange={e => setFilename(e.target.value)}
                    placeholder="export"
                  />
                  <span className={styles.ext}>.mp4</span>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Resolution</label>
                <div className={styles.readOnly}>{ratio.pw} × {ratio.ph}</div>
              </div>

              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label className={styles.label}>Quality</label>
                  <select className={styles.select} value={quality} onChange={e => setQuality(e.target.value)}>
                    {QUALITY.map(q => (
                      <option key={q.id} value={q.id}>{q.label} — {q.hint}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Frame Rate</label>
                  <select className={styles.select} value={fps} onChange={e => setFps(Number(e.target.value))}>
                    {FPS_OPTIONS.map(f => <option key={f} value={f}>{f} fps</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.note}>
                <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13" style={{flexShrink:0,marginTop:1}}>
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a.75.75 0 1 1 0 1.5A.75.75 0 0 1 8 4zm-.25 3h1.5v4h-1.5z"/>
                </svg>
                Exports the primary video track with text overlays and audio composited.
                Overlay video tracks (V2–V4) are not yet composited.
              </div>

              {!hasVideoClips && (
                <div className={styles.warn}>No visible video clips on the timeline.</div>
              )}
            </div>

            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                className={styles.exportBtn}
                onClick={handleExport}
                disabled={!hasVideoClips}
              >
                <DownloadIcon /> Export
              </button>
            </div>
          </>
        )}

        {/* ── Exporting ── */}
        {phase === 'exporting' && (
          <>
            <div className={styles.header}>
              <span className={styles.title}>Exporting…</span>
            </div>
            <div className={styles.body}>
              <div className={styles.progressWrap}>
                <div className={styles.stepLabel}>{stepLabel || 'Starting…'}</div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${progress}%` }}/>
                </div>
                <div className={styles.progressPct}>{progress}%</div>
              </div>
              <div className={styles.progressNote}>
                Do not close this window during export.
              </div>
            </div>
            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
            </div>
          </>
        )}

        {/* ── Done ── */}
        {phase === 'done' && (
          <>
            <div className={styles.header}>
              <span className={styles.title}>Export Complete</span>
              <button className={styles.closeBtn} onClick={onClose}>✕</button>
            </div>
            <div className={styles.body}>
              <div className={styles.resultBox}>
                <div className={styles.successIcon}><CheckCircle /></div>
                <div className={styles.resultName}>{filename.endsWith('.mp4') ? filename : `${filename}.mp4`}</div>
                <div className={styles.resultSub}>MP4 · {ratio.pw}×{ratio.ph} · {fps} fps</div>
              </div>
            </div>
            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>Close</button>
              <button className={styles.exportBtn} onClick={handleDownload}>
                <DownloadIcon /> Download
              </button>
            </div>
          </>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <>
            <div className={styles.header}>
              <span className={styles.title}>Export Failed</span>
              <button className={styles.closeBtn} onClick={onClose}>✕</button>
            </div>
            <div className={styles.body}>
              <div className={styles.resultBox}>
                <div className={styles.errorIcon}><XCircle /></div>
                <pre className={styles.errorMsg}>{error}</pre>
              </div>
            </div>
            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>Close</button>
              <button className={styles.exportBtn} onClick={() => setPhase('settings')}>
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
