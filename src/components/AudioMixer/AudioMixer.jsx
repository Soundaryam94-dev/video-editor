import React from 'react'
import styles from './AudioMixer.module.css'
import { useEditorStore } from '../../store/editorStore'

const AUDIO_TRACKS = [
  { id: 'a1', label: 'A1', color: '#22c55e' },
  { id: 'a2', label: 'A2', color: '#14b8a6' },
  { id: 'a3', label: 'A3', color: '#06b6d4' },
]

export default function AudioMixer({ onClose }) {
  const trackVolumes   = useEditorStore(s => s.trackVolumes)
  const setTrackVolume = useEditorStore(s => s.setTrackVolume)
  const mutedTracks    = useEditorStore(s => s.mutedTracks)
  const setTrackMuted  = useEditorStore(s => s.setTrackMuted)

  return (
    <div className={styles.mixer}>
      <div className={styles.header}>
        <span className={styles.title}>Audio Mixer</span>
        <button className={styles.close} onClick={onClose} title="Close">✕</button>
      </div>

      <div className={styles.tracks}>
        {AUDIO_TRACKS.map(track => {
          const vol    = (trackVolumes[track.id] ?? 1) * 100
          const muted  = !!mutedTracks[track.id]
          const dbVal  = vol === 0 ? '-∞' : (20 * Math.log10(vol / 100)).toFixed(1)

          return (
            <div key={track.id} className={`${styles.track} ${muted ? styles.trackMuted : ''}`}>
              <div className={styles.faderWrap}>
                <div className={styles.faderScale}>
                  {['+6', '0', '-6', '-12', '-∞'].map(l => (
                    <span key={l} className={styles.scaleMark}>{l}</span>
                  ))}
                </div>
                <input
                  type="range"
                  className={styles.fader}
                  min={0} max={200} step={1}
                  value={vol}
                  onChange={e => setTrackVolume(track.id, Number(e.target.value) / 100)}
                  style={{ '--fill': `${vol / 2}%`, '--color': track.color }}
                />
              </div>
              <div className={styles.trackInfo}>
                <span className={styles.db}>{dbVal} dB</span>
                <span className={styles.pct}>{Math.round(vol)}%</span>
              </div>
              <button
                className={`${styles.muteBtn} ${muted ? styles.muteBtnActive : ''}`}
                onClick={() => setTrackMuted(track.id, !muted)}
                title={muted ? 'Unmute' : 'Mute'}
              >M</button>
              <div className={styles.trackLabel} style={{ color: track.color }}>
                {track.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
