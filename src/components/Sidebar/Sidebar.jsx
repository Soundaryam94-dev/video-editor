import React from 'react'
import styles from './Sidebar.module.css'

const TOOLS = [
  {
    id: 'media',
    label: 'Media',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* Film strip outer frame */}
        <rect x="2" y="3" width="20" height="18" rx="2.5"/>
        {/* Top sprocket bar */}
        <line x1="2" y1="7.5" x2="22" y2="7.5"/>
        <circle cx="5.5" cy="5.25" r="1" fill="currentColor" stroke="none"/>
        <circle cx="10"  cy="5.25" r="1" fill="currentColor" stroke="none"/>
        <circle cx="14.5" cy="5.25" r="1" fill="currentColor" stroke="none"/>
        <circle cx="19"  cy="5.25" r="1" fill="currentColor" stroke="none"/>
        {/* Bottom sprocket bar */}
        <line x1="2" y1="16.5" x2="22" y2="16.5"/>
        <circle cx="5.5"  cy="18.75" r="1" fill="currentColor" stroke="none"/>
        <circle cx="10"   cy="18.75" r="1" fill="currentColor" stroke="none"/>
        <circle cx="14.5" cy="18.75" r="1" fill="currentColor" stroke="none"/>
        <circle cx="19"   cy="18.75" r="1" fill="currentColor" stroke="none"/>
        {/* Play triangle in the frame area */}
        <polygon points="9.5,9.5 9.5,14.5 16,12" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor">
        <polyline points="4 7 4 4 20 4 20 7"/>
        <line x1="9" y1="20" x2="15" y2="20"/>
        <line x1="12" y1="4" x2="12" y2="20"/>
      </svg>
    ),
  },
  {
    id: 'elements',
    label: 'Elements',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* Heart — top-left (x:1-9, y:1-9) */}
        <path d="M5,9 C2,7 1,5 1,3.5 C1,2 2.5,1 4,1.5 C4.5,1.7 5,2.5 5,2.5 C5,2.5 5.5,1.7 6,1.5 C7.5,1 9,2 9,3.5 C9,5 8,7 5,9 Z"/>
        {/* Play triangle — top-right (x:15-23, y:1-9) */}
        <polygon points="15.5,2 15.5,9.5 22.5,5.75" fill="currentColor" fillOpacity="0.15"/>
        {/* Music note — bottom-left (x:1-9, y:15-23) */}
        <circle cx="3.5" cy="21.5" r="1.5" fill="currentColor" stroke="none"/>
        <line x1="5" y1="21.5" x2="5" y2="15"/>
        <path d="M5 15 C7 14.2 8.5 15.5 8 18" fill="none"/>
        {/* Circle ring — bottom-right (x:15-23, y:15-23) */}
        <circle cx="19" cy="19" r="4"/>
        <circle cx="19" cy="19" r="1.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id: 'transitions',
    label: 'Transitions',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor">
        <rect x="2" y="4" width="8" height="16" rx="1.5"/>
        <rect x="14" y="4" width="8" height="16" rx="1.5"/>
        <path d="M10 12h4M13 9l3 3-3 3"/>
      </svg>
    ),
  },
]

export default function Sidebar({ activeTool = 'media', onToolChange }) {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`${styles.item} ${activeTool === tool.id ? styles.active : ''}`}
            onClick={() => onToolChange?.(tool.id)}
            title={tool.label}
          >
            <span className={styles.iconWrap}>{tool.svg}</span>
            <span className={styles.label}>{tool.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
