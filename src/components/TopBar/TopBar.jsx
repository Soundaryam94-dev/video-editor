import React, { useRef, useState, useEffect } from 'react'
import styles from './TopBar.module.css'
import { useEditorStore } from '../../store/editorStore'

const UndoIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M3 7.5A5 5 0 1 1 5.5 12"/>
    <polyline points="3,4.5 3,7.5 6,7.5"/>
  </svg>
)

const RedoIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M13 7.5A5 5 0 1 0 10.5 12"/>
    <polyline points="13,4.5 13,7.5 10,7.5"/>
  </svg>
)

const SaveIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M13 13H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h7.5L14 5.5V12a1 1 0 0 1-1 1z"/>
    <rect x="5" y="9" width="6" height="5" rx="0.5"/>
    <rect x="5.5" y="2" width="4" height="3.5" rx="0.5"/>
  </svg>
)

const LoadIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M2 5.5V13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5.5L11.5 2H3a1 1 0 0 0-1 1v2.5z"/>
    <line x1="8" y1="6" x2="8" y2="11"/>
    <polyline points="5.5,8.5 8,11 10.5,8.5"/>
  </svg>
)

export default function TopBar({ onResize, onExport, onSave, onLoad, autosaveBadge }) {
  const past           = useEditorStore(s => s.past)
  const future         = useEditorStore(s => s.future)
  const undo           = useEditorStore(s => s.undo)
  const redo           = useEditorStore(s => s.redo)
  const projectName    = useEditorStore(s => s.projectName)
  const setProjectName = useEditorStore(s => s.setProjectName)
  const loadProject    = useEditorStore(s => s.loadProject)

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  const fileRef          = useRef(null)
  const menuNavRef       = useRef(null)
  const [openMenu,          setOpenMenu]         = useState(null) // 'File' | 'Edit' | null
  const [editingName,       setEditingName]      = useState(false)
  const [nameInput,         setNameInput]        = useState('')
  const [confirmNewProject, setConfirmNewProject] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenu) return
    const handler = e => {
      if (menuNavRef.current && !menuNavRef.current.contains(e.target)) setOpenMenu(null)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [openMenu])

  // Dispatch a keyboard shortcut to the window so Timeline.jsx's handler picks it up
  const dispatchKey = (key, ctrl = false, shift = false) => {
    setOpenMenu(null)
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key, ctrlKey: ctrl, metaKey: ctrl, shiftKey: shift, bubbles: true,
    }))
  }

  const handleNewProject = () => {
    setOpenMenu(null)
    setConfirmNewProject(true)
  }

  const confirmNew = () => {
    setConfirmNewProject(false)
    loadProject({ clips: [], markers: [], projectName: 'Untitled Project' })
  }

  const FILE_ITEMS = [
    { label: 'New Project',  shortcut: '',        action: handleNewProject },
    { sep: true },
    { label: 'Open…',        shortcut: '',        action: () => { setOpenMenu(null); fileRef.current?.click() } },
    { label: 'Save',         shortcut: 'Ctrl S',  action: () => { setOpenMenu(null); onSave() } },
    { sep: true },
    { label: 'Export…',      shortcut: '',        action: () => { setOpenMenu(null); onExport() } },
  ]

  const EDIT_ITEMS = [
    { label: 'Undo',          shortcut: 'Ctrl Z',   disabled: !canUndo, action: () => { setOpenMenu(null); undo() } },
    { label: 'Redo',          shortcut: 'Ctrl Y',   disabled: !canRedo, action: () => { setOpenMenu(null); redo() } },
    { sep: true },
    { label: 'Cut',           shortcut: 'Ctrl X',   action: () => dispatchKey('x', true) },
    { label: 'Copy',          shortcut: 'Ctrl C',   action: () => dispatchKey('c', true) },
    { label: 'Paste',         shortcut: 'Ctrl V',   action: () => dispatchKey('v', true) },
    { label: 'Duplicate',     shortcut: 'Ctrl D',   action: () => dispatchKey('d', true) },
    { sep: true },
    { label: 'Select All',    shortcut: 'Ctrl A',   action: () => dispatchKey('a', true) },
    { label: 'Delete',        shortcut: 'Del',      action: () => dispatchKey('Delete') },
    { label: 'Ripple Delete', shortcut: '⇧ Del',    action: () => dispatchKey('Delete', false, true) },
  ]

  const MENUS = { File: FILE_ITEMS, Edit: EDIT_ITEMS }

  return (
    <header className={styles.topbar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>▶</div>
        <span className={styles.logoText}>VideoEditor</span>
      </div>

      <nav className={styles.menu} ref={menuNavRef}>
        {Object.entries(MENUS).map(([name, items]) => (
          <div key={name} className={styles.menuWrapper}>
            <button
              className={`${styles.menuItem} ${openMenu === name ? styles.menuItemOpen : ''}`}
              onClick={() => setOpenMenu(openMenu === name ? null : name)}
            >
              {name}
            </button>

            {openMenu === name && (
              <div className={styles.dropdown}>
                {items.map((item, i) =>
                  item.sep ? (
                    <div key={i} className={styles.dropSep} />
                  ) : (
                    <button
                      key={item.label}
                      className={styles.dropItem}
                      disabled={!!item.disabled}
                      onClick={item.action}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className={styles.dropShortcut}>{item.shortcut}</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className={styles.center}>
        {editingName ? (
          <input
            className={styles.projectNameInput}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={() => {
              if (nameInput.trim()) setProjectName(nameInput.trim())
              setEditingName(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditingName(false)
              e.stopPropagation()
            }}
            autoFocus
          />
        ) : (
          <span
            className={styles.projectName}
            onDoubleClick={() => { setNameInput(projectName); setEditingName(true) }}
            title="Double-click to rename"
          >
            {projectName}
          </span>
        )}
        {autosaveBadge === 'saved' && (
          <span className={styles.saveBadge}>Auto-saved</span>
        )}
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn} title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} style={{ opacity: canUndo ? 1 : 0.3 }}>
          <UndoIcon />
        </button>
        <button className={styles.iconBtn} title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo} style={{ opacity: canRedo ? 1 : 0.3 }}>
          <RedoIcon />
        </button>

        <div className={styles.divider} />

        <button className={styles.iconBtn} onClick={onSave} title="Save project (Ctrl+S)">
          <SaveIcon />
        </button>
        <button className={styles.iconBtn} onClick={() => fileRef.current?.click()} title="Load project">
          <LoadIcon />
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onLoad} />

        <div className={styles.divider} />

        <button className={styles.resizeBtn} onClick={onResize} title="Resize canvas">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M2 6V3h3M12 3h3v3M16 12v3h-3M6 16H3v-3"/>
          </svg>
          Resize
        </button>
        <div className={styles.divider} />
        <button className={styles.upgradeBtn}>★ Upgrade</button>
        <button className={styles.exportBtn} onClick={onExport}>↑ Export</button>
      </div>

      {/* New Project confirmation modal */}
      {confirmNewProject && (
        <div className={styles.confirmBackdrop} onMouseDown={() => setConfirmNewProject(false)}>
          <div className={styles.confirmModal} onMouseDown={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </div>
            <div className={styles.confirmTitle}>New Project</div>
            <div className={styles.confirmMsg}>Start a new project? Any unsaved changes will be lost.</div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setConfirmNewProject(false)}>Cancel</button>
              <button className={styles.confirmOk} onClick={confirmNew} autoFocus>New Project</button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
