import React, { useState, useRef, useCallback } from 'react'
import * as Tone from 'tone'
import styles from './AIMusic.module.css'

// ── Music theory configs per mood ─────────────────────────────────────────
const MOODS_DATA = {
  happy: {
    name: 'Happy',
    color: '#f59e0b',
    scale: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76],   // C major
    bpm: 120,
    durations:   [0.5,  0.5,  0.25, 0.25, 1.0],
    durWeights:  [0.35, 0.35, 0.15, 0.1,  0.05],
    tonicWeight: 2.5,
    stepBias:    2.0,
    oscillator:  'triangle',
    env: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.5 },
  },
  calm: {
    name: 'Calm',
    color: '#06b6d4',
    scale: [57, 59, 60, 62, 64, 65, 67, 69, 71, 72],   // A natural minor
    bpm: 70,
    durations:   [1.0,  1.5,  0.5,  2.0],
    durWeights:  [0.3,  0.3,  0.2,  0.2],
    tonicWeight: 2.0,
    stepBias:    3.0,
    oscillator:  'sine',
    env: { attack: 0.10, decay: 0.15, sustain: 0.7, release: 1.2 },
  },
  energetic: {
    name: 'Energetic',
    color: '#ef4444',
    scale: [62, 64, 66, 67, 69, 71, 74, 76],           // D major
    bpm: 140,
    durations:   [0.25, 0.25, 0.5,  0.125],
    durWeights:  [0.4,  0.35, 0.15, 0.1],
    tonicWeight: 1.5,
    stepBias:    1.2,
    oscillator:  'triangle',
    env: { attack: 0.01, decay: 0.08, sustain: 0.4, release: 0.3 },
  },
  romantic: {
    name: 'Romantic',
    color: '#ec4899',
    scale: [65, 67, 69, 70, 72, 74, 76, 77],           // F major
    bpm: 80,
    durations:   [0.75, 1.0,  0.5,  1.5],
    durWeights:  [0.35, 0.35, 0.2,  0.1],
    tonicWeight: 2.2,
    stepBias:    2.5,
    oscillator:  'sine',
    env: { attack: 0.06, decay: 0.12, sustain: 0.65, release: 1.0 },
  },
  mysterious: {
    name: 'Mysterious',
    color: '#8b5cf6',
    scale: [59, 62, 65, 66, 68, 71, 73, 74],           // B octatonic
    bpm: 88,
    durations:   [0.5,  0.75, 1.0,  0.25, 1.5],
    durWeights:  [0.25, 0.3,  0.25, 0.1,  0.1],
    tonicWeight: 1.8,
    stepBias:    1.5,
    oscillator:  'triangle',
    env: { attack: 0.04, decay: 0.20, sustain: 0.5, release: 0.9 },
  },
}

const MOODS = Object.entries(MOODS_DATA).map(([id, d]) => ({ id, label: d.name, color: d.color }))

const LENGTHS = [
  { id: 'short',  label: 'Short',  noteCount: 32  },
  { id: 'medium', label: 'Medium', noteCount: 64  },
  { id: 'long',   label: 'Long',   noteCount: 128 },
]

// ── Markov-chain melody generator ─────────────────────────────────────────
function weightedChoice(items, weights) {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i] }
  return items[items.length - 1]
}

function generateNotes(cfg, count) {
  const { scale, durations, durWeights, tonicWeight, stepBias } = cfg
  const tonic = scale[0]
  let current = scale[Math.floor(scale.length / 3)]
  const notes = []

  for (let i = 0; i < count; i++) {
    const dur = weightedChoice(durations, durWeights)

    // Weight toward stepwise motion + tonic resolution
    const weights = scale.map(pitch => {
      const interval = Math.abs(pitch - current)
      const sW = interval <= 2 ? stepBias : interval <= 4 ? 1.0 : 0.4
      const tW = pitch % 12 === tonic % 12 ? tonicWeight : 1.0
      return sW * tW
    })
    // Every 8 notes cadence toward tonic
    if (i % 8 === 7) {
      const ti = scale.reduce((b, p, idx) =>
        Math.abs(p % 12 - tonic % 12) < Math.abs(scale[b] % 12 - tonic % 12) ? idx : b, 0)
      weights[ti] *= 3.5
    }

    notes.push({ pitch: current, dur })
    current = weightedChoice(scale, weights)
  }
  return notes
}

// ── AudioBuffer → waveform image (data URL) ───────────────────────────────
function toWaveformImg(audioBuffer, width = 800, height = 28) {
  const channel  = audioBuffer.getChannelData(0)
  const blockSz  = Math.floor(channel.length / width)
  const canvas   = document.createElement('canvas')
  canvas.width   = width
  canvas.height  = height
  const ctx      = canvas.getContext('2d')
  const mid      = height / 2

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(255,255,255,0.82)'

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
}

// ── AudioBuffer → WAV blob ────────────────────────────────────────────────
function toWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length
  const ab = new ArrayBuffer(44 + len * ch * 2)
  const v = new DataView(ab)
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true)
  ws(8, 'WAVE'); ws(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, ch, true); v.setUint32(24, sr, true)
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true)
  v.setUint16(34, 16, true); ws(36, 'data')
  v.setUint32(40, len * ch * 2, true)
  let off = 44
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, buf.getChannelData(c)[i]))
      v.setInt16(off, s < 0 ? s * 32768 : s * 32767, true)
      off += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

// ── Component ─────────────────────────────────────────────────────────────
export default function AIMusic({ onClose, onAdd }) {
  const [mood, setMood]         = useState('happy')
  const [length, setLength]     = useState('medium')
  const [status, setStatus]     = useState('')
  const [generating, setGen]    = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [error, setError]       = useState('')
  const prevUrl = useRef(null)

  const generate = useCallback(async () => {
    if (generating) return
    setGen(true)
    setError('')
    if (prevUrl.current) { URL.revokeObjectURL(prevUrl.current); prevUrl.current = null }
    setAudioUrl(null)

    try {
      setStatus('Composing melody…')
      const cfg       = MOODS_DATA[mood]
      const noteCount = LENGTHS.find(l => l.id === length)?.noteCount ?? 64
      const notes     = generateNotes(cfg, noteCount)

      setStatus('Rendering audio…')
      const beatSec  = 60 / cfg.bpm
      const totalSec = notes.reduce((s, n) => s + n.dur * beatSec, 0) + 1.5

      const toneBuf = await Tone.Offline(() => {
        const delay = new Tone.FeedbackDelay({
          delayTime: beatSec / 2,
          feedback: 0.18,
          wet: 0.14,
        }).toDestination()

        const synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: cfg.oscillator },
          envelope:   cfg.env,
          volume:     -6,
        }).connect(delay)

        let t = 0.05
        notes.forEach(({ pitch, dur }) => {
          const secDur = dur * beatSec
          synth.triggerAttackRelease(
            Tone.Frequency(pitch, 'midi').toFrequency(),
            secDur * 0.85,
            t,
          )
          t += secDur
        })
      }, totalSec)

      const audioBuffer   = toneBuf.get()
      const waveformImg   = toWaveformImg(audioBuffer)
      const blob          = toWav(audioBuffer)
      const url           = URL.createObjectURL(blob)
      prevUrl.current     = url
      setAudioUrl(url)
      // store waveform on the ref so handleAdd can pass it
      prevUrl.waveformImg = waveformImg
      setStatus('Ready!')
    } catch (e) {
      setError(e.message || 'Generation failed — please try again.')
      setStatus('')
    } finally {
      setGen(false)
    }
  }, [mood, length, generating])

  const handleAdd = () => {
    if (!audioUrl) return
    onAdd(audioUrl, `AI ${MOODS_DATA[mood].name} Music.wav`, prevUrl.waveformImg ?? null)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
              <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11l-1.5-3.5L3 6l3.5-1.5L8 1z"/>
              <path d="M13 9.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8.8-1.7z" opacity="0.6"/>
            </svg>
            <span>Generate AI Music</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="10" height="10">
              <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
            </svg>
          </button>
        </div>

        {/* Mood */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Mood</div>
          <div className={styles.moodGrid}>
            {MOODS.map(m => (
              <button
                key={m.id}
                className={`${styles.moodBtn} ${mood === m.id ? styles.moodBtnActive : ''}`}
                style={mood === m.id ? { '--mc': m.color } : undefined}
                onClick={() => setMood(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Length */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Length</div>
          <div className={styles.lengthRow}>
            {LENGTHS.map(l => (
              <button
                key={l.id}
                className={`${styles.lengthBtn} ${length === l.id ? styles.lengthBtnActive : ''}`}
                onClick={() => setLength(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && <div className={styles.errorBox}>{error}</div>}

        {/* Status */}
        {status && !error && (
          <div className={styles.statusRow}>
            {generating && <div className={styles.spinner}/>}
            <span className={styles.statusText}>{status}</span>
          </div>
        )}

        {/* Preview */}
        {audioUrl && (
          <div className={styles.previewRow}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={audioUrl} className={styles.audioEl}/>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.genBtn} onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : audioUrl ? 'Regenerate' : 'Generate'}
          </button>
          {audioUrl && (
            <button className={styles.addBtn} onClick={handleAdd}>
              + Add to Timeline
            </button>
          )}
        </div>

        <p className={styles.poweredBy}>
          AI melody via Markov chains + music theory · Tone.js synthesis · runs fully in browser
        </p>
      </div>
    </div>
  )
}
