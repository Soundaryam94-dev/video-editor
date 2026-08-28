import React, { useState, useEffect } from 'react'
import styles from './TransitionsPanel.module.css'
import { useEditorStore } from '../../store/editorStore'

const TRANSITIONS = [
  { id: 'none',       label: 'None' },
  { id: 'dissolve',   label: 'Dissolve' },
  { id: 'fadeBlack',  label: 'Fade Black' },
  { id: 'slideLeft',  label: 'Slide Left' },
  { id: 'slideRight', label: 'Slide Right' },
  { id: 'slideUp',    label: 'Slide Up' },
  { id: 'slideDown',  label: 'Slide Down' },
  { id: 'wipeLeft',   label: 'Wipe Left' },
  { id: 'wipeRight',  label: 'Wipe Right' },
  { id: 'zoomIn',     label: 'Zoom In' },
  { id: 'zoomOut',    label: 'Zoom Out' },
]

function TransitionCard({ transition, isActive, canApply, onClick }) {
  return (
    <button
      className={[
        styles.card,
        isActive    && styles.cardActive,
        !canApply   && styles.cardDim,
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      title={transition.label}
    >
      <div className={`${styles.preview} ${styles['prev_' + transition.id]}`}>
        <div className={styles.previewA} />
        <div className={styles.previewB} />
        {transition.id === 'fadeBlack' && <div className={styles.previewBlack} />}
      </div>
      <span className={styles.cardLabel}>{transition.label}</span>
      {isActive && <span className={styles.cardCheck}>✓</span>}
    </button>
  )
}

export default function TransitionsPanel() {
  const selectedClipId = useEditorStore(s => s.selectedClipId)
  const clips          = useEditorStore(s => s.clips)
  const updateClip     = useEditorStore(s => s.updateClip)

  const selectedClip = clips.find(c => c.id === selectedClipId)
  const currentType  = selectedClip?.transitionIn?.type ?? 'none'
  const [dur, setDur] = useState(0.5)

  useEffect(() => {
    setDur(selectedClip?.transitionIn?.dur ?? 0.5)
  }, [selectedClipId])

  const apply = (type) => {
    if (!selectedClipId) return
    updateClip(selectedClipId, {
      transitionIn: type === 'none' ? null : { type, dur },
    })
  }

  const changeDur = (newDur) => {
    setDur(newDur)
    if (selectedClipId && currentType !== 'none') {
      updateClip(selectedClipId, { transitionIn: { type: currentType, dur: newDur } })
    }
  }

  const hasClip = !!selectedClipId

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Transitions</span>
      </div>

      <div className={styles.hint}>
        {hasClip
          ? `Clip: ${selectedClip?.label || 'selected'}`
          : 'Select a clip on the timeline'}
      </div>

      <div className={styles.grid}>
        {TRANSITIONS.map(t => (
          <TransitionCard
            key={t.id}
            transition={t}
            isActive={currentType === t.id}
            canApply={hasClip}
            onClick={() => apply(t.id)}
          />
        ))}
      </div>

      {hasClip && currentType !== 'none' && (
        <div className={styles.durSection}>
          <div className={styles.durRow}>
            <span className={styles.durLabel}>Duration</span>
            <span className={styles.durValue}>{dur.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            className={styles.slider}
            min={0.1} max={3} step={0.1}
            value={dur}
            onChange={e => changeDur(parseFloat(e.target.value))}
          />
          <div className={styles.durHints}>
            <span>0.1s</span>
            <span>1.5s</span>
            <span>3s</span>
          </div>
        </div>
      )}
    </div>
  )
}
