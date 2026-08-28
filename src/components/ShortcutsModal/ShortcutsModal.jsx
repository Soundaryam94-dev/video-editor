import styles from './ShortcutsModal.module.css'

const GROUPS = [
  {
    title: 'Transport',
    rows: [
      ['Space', 'Play / Pause'],
      ['L', 'Play forward'],
      ['K', 'Pause'],
      ['J', 'Step back 1 frame'],
      ['← →', 'Step 1 frame (Shift = 1 s)'],
    ],
  },
  {
    title: 'Editing',
    rows: [
      ['Ctrl+Z', 'Undo'],
      ['Ctrl+Y / Ctrl+Shift+Z', 'Redo'],
      ['Delete / Backspace', 'Delete selected'],
      ['Shift+Delete', 'Ripple delete'],
      ['Ctrl+C', 'Copy'],
      ['Ctrl+V', 'Paste at playhead'],
      ['Ctrl+D', 'Duplicate'],
      ['Ctrl+A', 'Select all'],
      ['Escape', 'Deselect all'],
    ],
  },
  {
    title: 'Tools',
    rows: [
      ['V', 'Select'],
      ['C', 'Razor'],
      ['B', 'Ripple'],
      ['N', 'Rolling'],
      ['Y', 'Slip'],
      ['U', 'Slide'],
    ],
  },
  {
    title: 'Timeline',
    rows: [
      ['I', 'Mark In'],
      ['O', 'Mark Out'],
      ['G', 'Clear In / Out'],
      ['M', 'Add marker'],
      ['S', 'Toggle snap'],
    ],
  },
  {
    title: 'Zoom',
    rows: [
      ['=  /  +', 'Zoom in'],
      ['-', 'Zoom out'],
      ['\\', 'Zoom to fit'],
    ],
  },
]

export default function ShortcutsModal({ onClose }) {
  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Keyboard Shortcuts</span>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="14" height="14">
              <line x1="3" y1="3" x2="13" y2="13"/>
              <line x1="13" y1="3" x2="3" y2="13"/>
            </svg>
          </button>
        </div>
        <div className={styles.grid}>
          {GROUPS.map(g => (
            <div key={g.title} className={styles.group}>
              <div className={styles.groupTitle}>{g.title}</div>
              {g.rows.map(([key, desc]) => (
                <div key={key} className={styles.row}>
                  <span className={styles.key}>{key}</span>
                  <span className={styles.desc}>{desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.footer}>Press <kbd className={styles.kbdInline}>?</kbd> to show this panel</div>
      </div>
    </div>
  )
}
