import React, { useState, useEffect, useCallback, useRef } from 'react'
import TopBar from '../components/TopBar/TopBar'
import Sidebar from '../components/Sidebar/Sidebar'
import MediaPanel from '../components/MediaPanel/MediaPanel'
import TextPanel from '../components/TextPanel/TextPanel'
import ElementsPanel from '../components/ElementsPanel/ElementsPanel'
import ShapePropertiesPanel from '../components/ShapePropertiesPanel/ShapePropertiesPanel'
import TransitionsPanel from '../components/TransitionsPanel/TransitionsPanel'
import PropertiesPanel from '../components/PropertiesPanel/PropertiesPanel'
import Preview from '../components/Preview/Preview'
import Timeline from '../components/Timeline/Timeline'
import ResizeModal from '../components/ResizeModal/ResizeModal'
import ExportModal from '../components/ExportModal/ExportModal'
import { useEditorStore } from '../store/editorStore'
import { ensureFFmpeg, resetFFmpeg } from '../lib/ffmpegSingleton'
import styles from './EditorPage.module.css'

const AUTOSAVE_KEY = 've_autosave_v1'

export default function EditorPage() {
  const [activeTool, setActiveTool]           = useState('media')
  const [showResize, setShowResize]           = useState(false)
  const [showExport, setShowExport]           = useState(false)
  const [autosavePrompt, setAutosavePrompt]   = useState(null) // {clips, canvasRatio, projectName, savedAt}
  const [autosaveBadge, setAutosaveBadge]     = useState(null) // 'saving' | 'saved'
  const [timelineH, setTimelineH]             = useState(258)  // matches --timeline-h default
  const centerColRef = useRef(null)

  // Kick off FFmpeg WASM load in background as soon as the editor opens
  useEffect(() => {
    ensureFFmpeg().catch(resetFFmpeg)
  }, [])

  // Check for autosave on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data?.clips?.length > 0) setAutosavePrompt(data)
      }
    } catch {}
  }, [])

  const selectedClipId = useEditorStore(s => s.selectedClipId)
  const clips          = useEditorStore(s => s.clips)
  const canvasRatio    = useEditorStore(s => s.canvasRatio)
  const projectName    = useEditorStore(s => s.projectName)
  const loadProject    = useEditorStore(s => s.loadProject)
  const markers        = useEditorStore(s => s.markers)

  const handleSave = useCallback(() => {
    const data = { version: 1, projectName, canvasRatio, clips, markers }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${projectName.replace(/[^a-z0-9]/gi, '_') || 'project'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [clips, markers, canvasRatio, projectName])

  const handleLoad = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        loadProject(data)
      } catch {
        alert('Could not read project file — make sure it is a valid .json file saved from this editor.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [loadProject])

  // Auto-save to localStorage every 30 s
  useEffect(() => {
    const interval = setInterval(() => {
      const st = useEditorStore.getState()
      if (st.clips.length === 0) return
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          version: 1,
          projectName: st.projectName,
          canvasRatio: st.canvasRatio,
          clips: st.clips,
          markers: st.markers,
          savedAt: Date.now(),
        }))
        setAutosaveBadge('saved')
        setTimeout(() => setAutosaveBadge(null), 2000)
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Ctrl+S save shortcut
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const handleTLResizeStart = useCallback((e) => {
    e.preventDefault()
    document.body.style.cursor    = 'row-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev) => {
      if (!centerColRef.current) return
      const rect = centerColRef.current.getBoundingClientRect()
      const newH = Math.round(rect.bottom - ev.clientY)
      setTimelineH(Math.max(120, Math.min(rect.height - 80, newH)))
    }
    const onUp = () => {
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [])

  const isTextTool        = activeTool === 'text'
  const isElementsTool    = activeTool === 'elements'
  const isTransitionsTool = activeTool === 'transitions'

  const selectedClip    = clips.find(c => c.id === selectedClipId)
  const selectedIsShape = selectedClip?.type === 'shape'
  const selectedIsVideo = selectedClip && (selectedClip.type === 'video' || selectedClip.type === 'image')

  return (
    <div className={styles.page}>
      <TopBar
        onResize={() => setShowResize(true)}
        onExport={() => setShowExport(true)}
        onSave={handleSave}
        onLoad={handleLoad}
        autosaveBadge={autosaveBadge}
      />
      {showResize && <ResizeModal onClose={() => setShowResize(false)} />}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      {autosavePrompt && (
        <div className={styles.autosaveBanner}>
          <span>Unsaved session found from {new Date(autosavePrompt.savedAt).toLocaleTimeString()} — restore it?</span>
          <button className={styles.autosaveRestore} onClick={() => { loadProject(autosavePrompt); setAutosavePrompt(null) }}>Restore</button>
          <button className={styles.autosaveDismiss} onClick={() => setAutosavePrompt(null)}>Dismiss</button>
        </div>
      )}

      <div className={styles.main}>
        <Sidebar activeTool={activeTool} onToolChange={setActiveTool} />

        <div className={styles.leftPanel}>
          {isTextTool ? (
            <TextPanel />
          ) : isElementsTool ? (
            <ElementsPanel />
          ) : isTransitionsTool ? (
            <TransitionsPanel />
          ) : (
            <>
              <MediaPanel />
              {selectedIsVideo && (
                <div className={styles.propertiesSlot}>
                  <PropertiesPanel />
                </div>
              )}
            </>
          )}
          {selectedIsShape && (
            <div className={styles.propertiesSlot}>
              <ShapePropertiesPanel />
            </div>
          )}
        </div>

        <div
          className={styles.centerColumn}
          ref={centerColRef}
          style={{ '--timeline-h': `${timelineH}px` }}
        >
          <Preview onOpenResize={() => setShowResize(true)} />
          <div
            className={styles.tlResizeHandle}
            onMouseDown={handleTLResizeStart}
            onDoubleClick={() => setTimelineH(258)}
            title="Drag to resize timeline · Double-click to reset"
          />
          <Timeline />
        </div>
      </div>
    </div>
  )
}
