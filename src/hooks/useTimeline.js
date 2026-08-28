import { useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'

export function useTimeline() {
  const { currentTime, duration, zoom, setCurrentTime, setZoom } = useEditorStore()

  const seek = useCallback((time) => {
    setCurrentTime(Math.max(0, Math.min(time, duration)))
  }, [duration, setCurrentTime])

  const seekByPercent = useCallback((pct) => {
    seek(pct * duration)
  }, [duration, seek])

  const zoomIn  = useCallback(() => setZoom(Math.min(100, zoom + 10)), [zoom, setZoom])
  const zoomOut = useCallback(() => setZoom(Math.max(0, zoom - 10)), [zoom, setZoom])

  return { currentTime, duration, zoom, seek, seekByPercent, zoomIn, zoomOut }
}
