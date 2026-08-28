import React, { useRef, useEffect, useState, useCallback } from 'react'
import styles from './CurvesEditor.module.css'
import { evalCurve, isIdentityCurve, DEFAULT_CURVE } from '../../utils/curves'

const CH_COLOR = { rgb: '#e8d44d', r: '#f87171', g: '#4ade80', b: '#60a5fa' }
const CH_LABEL = { rgb: 'RGB', r: 'R', g: 'G', b: 'B' }
const SIZE = 176

export default function CurvesEditor({ curves, onChange }) {
  const [ch, setCh] = useState('rgb')
  const canvasRef    = useRef(null)
  const dragIdx      = useRef(null)

  const pts = curves?.[ch] ?? DEFAULT_CURVE

  const draw = useCallback(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    const W = cvs.width, H = cvs.height
    ctx.clearRect(0, 0, W, H)

    // bg
    ctx.fillStyle = '#0d0f1a'
    ctx.fillRect(0, 0, W, H)

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const v = (i / 4) * W
      ctx.beginPath(); ctx.moveTo(v, 0);    ctx.lineTo(v, H);    ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, v);    ctx.lineTo(W, v);    ctx.stroke()
    }

    // identity diagonal
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, 0); ctx.stroke()
    ctx.setLineDash([])

    // curve line
    ctx.strokeStyle = CH_COLOR[ch]
    ctx.lineWidth = 1.8
    ctx.shadowColor = CH_COLOR[ch]
    ctx.shadowBlur  = 4
    ctx.beginPath()
    for (let px = 0; px <= W; px++) {
      const y = H - (evalCurve(pts, (px / W) * 255) / 255) * H
      px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y)
    }
    ctx.stroke()
    ctx.shadowBlur = 0

    // control points
    const col = CH_COLOR[ch]
    pts.forEach(([ix, iy]) => {
      const px = (ix / 255) * W
      const py = H - (iy / 255) * H
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2)
      ctx.fillStyle   = '#0d0f1a'
      ctx.fill()
      ctx.strokeStyle = col
      ctx.lineWidth   = 1.5
      ctx.stroke()
    })
  }, [pts, ch])

  useEffect(() => { draw() }, [draw])

  const toXY = e => {
    const r = canvasRef.current.getBoundingClientRect()
    return [
      Math.max(0, Math.min(255, Math.round(((e.clientX - r.left) / r.width) * 255))),
      Math.max(0, Math.min(255, Math.round((1 - (e.clientY - r.top) / r.height) * 255))),
    ]
  }

  const nearPt = e => {
    const r = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    for (let i = 0; i < pts.length; i++) {
      const px = (pts[i][0] / 255) * r.width
      const py = (1 - pts[i][1] / 255) * r.height
      if (Math.hypot(mx - px, my - py) < 9) return i
    }
    return -1
  }

  const onMouseDown = e => {
    e.preventDefault()
    const idx = nearPt(e)
    if (idx >= 0) {
      dragIdx.current = idx
    } else {
      const [x, y] = toXY(e)
      dragIdx.current = pts.length
      onChange(ch, [...pts, [x, y]])
    }
  }

  const onMouseMove = e => {
    if (dragIdx.current === null) return
    const [x, y] = toXY(e)
    const next = pts.map((p, i) => i === dragIdx.current ? [x, y] : p)
    onChange(ch, next)
  }

  const onMouseUp = () => { dragIdx.current = null }

  const onContextMenu = e => {
    e.preventDefault()
    const idx = nearPt(e)
    if (idx < 0) return
    const sorted = pts.slice().sort((a, b) => a[0] - b[0])
    const [ix] = pts[idx]
    if (ix === sorted[0][0] || ix === sorted[sorted.length - 1][0]) return
    onChange(ch, pts.filter((_, i) => i !== idx))
  }

  const reset = () => onChange(ch, DEFAULT_CURVE)

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <div className={styles.chBtns}>
          {['rgb', 'r', 'g', 'b'].map(c => (
            <button
              key={c}
              className={`${styles.chBtn} ${ch === c ? styles.chActive : ''}`}
              style={{ '--cc': CH_COLOR[c] }}
              onClick={() => setCh(c)}
            >{CH_LABEL[c]}</button>
          ))}
        </div>
        <button
          className={styles.resetBtn}
          onClick={reset}
          disabled={isIdentityCurve(pts)}
          title="Reset to linear"
        >↺</button>
      </div>

      <canvas
        ref={canvasRef}
        width={SIZE} height={SIZE}
        className={styles.canvas}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onContextMenu={onContextMenu}
      />

      <div className={styles.hint}>Click to add · Drag to move · Right-click to delete</div>
    </div>
  )
}
