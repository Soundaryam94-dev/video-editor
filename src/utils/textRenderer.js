// Shared text-overlay rendering logic used by Preview (canvas) and Export (PNG compositing)

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }
function easeInCubic(t)  { return t * t * t }
function easeOutBounce(t) {
  const n1 = 7.5625, d1 = 2.75
  if (t < 1/d1)     return n1 * t * t
  if (t < 2/d1)     return n1 * (t -= 1.5/d1) * t + 0.75
  if (t < 2.5/d1)   return n1 * (t -= 2.25/d1) * t + 0.9375
  return n1 * (t -= 2.625/d1) * t + 0.984375
}

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function wrapText(ctx, text, maxWidth) {
  const out = []
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue }
    const words = para.split(' ')
    let cur = ''
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && cur) {
        out.push(cur); cur = word
      } else {
        cur = test
      }
    }
    out.push(cur)
  }
  return out
}

export function drawShapeClips(ctx, clips, w, h) {
  clips.forEach(clip => {
    const cx          = (clip.posX / 100) * w
    const cy          = (clip.posY / 100) * h
    const sw          = ((clip.width  ?? 40) / 100) * w
    const sh          = ((clip.height ?? 25) / 100) * h
    const globalAlpha = clip.opacity  ?? 1
    const rotation    = ((clip.rotation ?? 0) * Math.PI) / 180
    const fillColor   = clip.fillColor  ?? '#6c63ff'
    const fillOpacity = clip.fillOpacity ?? 0.9
    const strokeColor = clip.strokeColor ?? 'transparent'
    const strokeWidth = clip.strokeWidth ?? 0
    const doFill   = fillOpacity > 0  && fillColor   !== 'transparent'
    const doStroke = strokeWidth > 0  && strokeColor !== 'transparent'

    ctx.save()
    ctx.translate(cx, cy)
    if (rotation !== 0) ctx.rotate(rotation)

    const applyStyle = () => {
      if (doFill) {
        ctx.globalAlpha = globalAlpha * fillOpacity
        ctx.fillStyle   = fillColor
        ctx.fill()
      }
      if (doStroke) {
        ctx.globalAlpha = globalAlpha
        ctx.strokeStyle = strokeColor
        ctx.lineWidth   = strokeWidth
        ctx.stroke()
      }
    }

    switch (clip.shapeType) {
      case 'rectangle':
        ctx.beginPath(); ctx.rect(-sw / 2, -sh / 2, sw, sh); applyStyle(); break

      case 'roundedRect': {
        const r = Math.min(sw, sh) * 0.15
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(-sw / 2, -sh / 2, sw, sh, r)
        else ctx.rect(-sw / 2, -sh / 2, sw, sh)
        applyStyle(); break
      }
      case 'circle':
        ctx.beginPath(); ctx.ellipse(0, 0, sw / 2, sh / 2, 0, 0, Math.PI * 2); applyStyle(); break

      case 'triangle':
        ctx.beginPath()
        ctx.moveTo(0, -sh / 2); ctx.lineTo(sw / 2, sh / 2); ctx.lineTo(-sw / 2, sh / 2)
        ctx.closePath(); applyStyle(); break

      case 'star': {
        const outerR = Math.min(sw, sh) / 2, innerR = outerR * 0.4
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI / 5) - Math.PI / 2
          const r = i % 2 === 0 ? outerR : innerR
          i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        }
        ctx.closePath(); applyStyle(); break
      }
      case 'pentagon': {
        const rp = Math.min(sw, sh) / 2
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const a = (i * 2 * Math.PI / 5) - Math.PI / 2
          i === 0 ? ctx.moveTo(Math.cos(a) * rp, Math.sin(a) * rp) : ctx.lineTo(Math.cos(a) * rp, Math.sin(a) * rp)
        }
        ctx.closePath(); applyStyle(); break
      }
      case 'diamond':
        ctx.beginPath()
        ctx.moveTo(0, -sh / 2); ctx.lineTo(sw / 2, 0); ctx.lineTo(0, sh / 2); ctx.lineTo(-sw / 2, 0)
        ctx.closePath(); applyStyle(); break

      case 'heart': {
        const W = sw / 2, H = sh / 2
        ctx.beginPath()
        ctx.moveTo(0, H)
        ctx.bezierCurveTo(-W*0.846,  H*0.294, -W,       -H*0.647, -W*0.692, -H*0.882)
        ctx.bezierCurveTo(-W*0.5,   -H,       -W*0.231, -H*0.647,  0,       -H*0.294)
        ctx.bezierCurveTo( W*0.231, -H*0.647,  W*0.5,   -H,        W*0.692, -H*0.882)
        ctx.bezierCurveTo( W,       -H*0.647,  W*0.846,  H*0.294,  0,        H)
        ctx.closePath(); applyStyle(); break
      }
      case 'hexagon': {
        const rh = Math.min(sw, sh) / 2
        ctx.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI / 3) - Math.PI / 6
          i === 0 ? ctx.moveTo(Math.cos(a) * rh, Math.sin(a) * rh) : ctx.lineTo(Math.cos(a) * rh, Math.sin(a) * rh)
        }
        ctx.closePath(); applyStyle(); break
      }
      case 'cross': {
        const aw = Math.min(sw, sh) / 2, bw = aw * 0.38
        ctx.beginPath()
        ctx.moveTo(-bw, -aw); ctx.lineTo(bw, -aw); ctx.lineTo(bw, -bw)
        ctx.lineTo(aw, -bw);  ctx.lineTo(aw, bw);  ctx.lineTo(bw, bw)
        ctx.lineTo(bw, aw);   ctx.lineTo(-bw, aw);  ctx.lineTo(-bw, bw)
        ctx.lineTo(-aw, bw);  ctx.lineTo(-aw, -bw); ctx.lineTo(-bw, -bw)
        ctx.closePath(); applyStyle(); break
      }
      case 'arrowShape': {
        const tipX = sw / 2, bodyW = sw * 0.65, headH = sh * 0.35
        ctx.beginPath()
        ctx.moveTo(-sw / 2, -sh * 0.28); ctx.lineTo(bodyW - sw / 2, -sh * 0.28)
        ctx.lineTo(bodyW - sw / 2, -tipX * headH / tipX)
        ctx.lineTo(tipX, 0)
        ctx.lineTo(bodyW - sw / 2, tipX * headH / tipX)
        ctx.lineTo(bodyW - sw / 2, sh * 0.28); ctx.lineTo(-sw / 2, sh * 0.28)
        ctx.closePath(); applyStyle(); break
      }
      case 'parallelogram': {
        const slant = sw * 0.15
        ctx.beginPath()
        ctx.moveTo(-sw / 2 + slant, -sh / 2); ctx.lineTo(sw / 2, -sh / 2)
        ctx.lineTo(sw / 2 - slant, sh / 2);   ctx.lineTo(-sw / 2, sh / 2)
        ctx.closePath(); applyStyle(); break
      }
      case 'line':
        if (!doStroke) break
        ctx.globalAlpha = globalAlpha; ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(-sw / 2, 0); ctx.lineTo(sw / 2, 0); ctx.stroke(); break

      case 'dashedLine':
        if (!doStroke) break
        ctx.globalAlpha = globalAlpha; ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.lineCap = 'round'
        ctx.setLineDash([sw * 0.07, sw * 0.04])
        ctx.beginPath(); ctx.moveTo(-sw / 2, 0); ctx.lineTo(sw / 2, 0); ctx.stroke()
        ctx.setLineDash([]); break

      case 'arrow': {
        if (!doStroke) break
        const aw = Math.min(sw * 0.12, strokeWidth * 4)
        ctx.globalAlpha = globalAlpha; ctx.strokeStyle = strokeColor; ctx.fillStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(-sw / 2, 0); ctx.lineTo(sw / 2 - aw * 0.8, 0); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(sw / 2, 0); ctx.lineTo(sw / 2 - aw, -aw * 0.55); ctx.lineTo(sw / 2 - aw, aw * 0.55); ctx.closePath(); ctx.fill()
        break
      }
      case 'doubleArrow': {
        if (!doStroke) break
        const aw2 = Math.min(sw * 0.12, strokeWidth * 4)
        ctx.globalAlpha = globalAlpha; ctx.strokeStyle = strokeColor; ctx.fillStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(-sw / 2 + aw2 * 0.8, 0); ctx.lineTo(sw / 2 - aw2 * 0.8, 0); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(sw / 2, 0); ctx.lineTo(sw / 2 - aw2, -aw2 * 0.55); ctx.lineTo(sw / 2 - aw2, aw2 * 0.55); ctx.closePath(); ctx.fill()
        ctx.beginPath(); ctx.moveTo(-sw / 2, 0); ctx.lineTo(-sw / 2 + aw2, -aw2 * 0.55); ctx.lineTo(-sw / 2 + aw2, aw2 * 0.55); ctx.closePath(); ctx.fill()
        break
      }
      case 'frameRect':
        if (!doStroke) break
        ctx.globalAlpha = globalAlpha; ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.lineJoin = 'round'
        ctx.beginPath(); ctx.rect(-sw / 2, -sh / 2, sw, sh); ctx.stroke(); break

      case 'frameRounded': {
        if (!doStroke) break
        const r2 = Math.min(sw, sh) * 0.15
        ctx.globalAlpha = globalAlpha; ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(-sw / 2, -sh / 2, sw, sh, r2)
        else ctx.rect(-sw / 2, -sh / 2, sw, sh)
        ctx.stroke(); break
      }
      case 'frameCircle':
        if (!doStroke) break
        ctx.globalAlpha = globalAlpha; ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth
        ctx.beginPath(); ctx.ellipse(0, 0, sw / 2, sh / 2, 0, 0, Math.PI * 2); ctx.stroke(); break

      case 'frameHeart': {
        if (!doStroke) break
        const W = sw / 2, H = sh / 2
        ctx.globalAlpha = globalAlpha; ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(0, H)
        ctx.bezierCurveTo(-W*0.846,  H*0.294, -W,       -H*0.647, -W*0.692, -H*0.882)
        ctx.bezierCurveTo(-W*0.5,   -H,       -W*0.231, -H*0.647,  0,       -H*0.294)
        ctx.bezierCurveTo( W*0.231, -H*0.647,  W*0.5,   -H,        W*0.692, -H*0.882)
        ctx.bezierCurveTo( W,       -H*0.647,  W*0.846,  H*0.294,  0,        H)
        ctx.closePath(); ctx.stroke(); break
      }
      case 'frameArch':
        if (!doStroke) break
        ctx.globalAlpha = globalAlpha; ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(-sw / 2, sh / 2); ctx.lineTo(-sw / 2, 0)
        ctx.bezierCurveTo(-sw / 2, -sh / 2, sw / 2, -sh / 2, sw / 2, 0)
        ctx.lineTo(sw / 2, sh / 2); ctx.closePath(); ctx.stroke(); break
    }

    // ── Text inside shape ────────────────────────────────────────────────
    if (clip.text && clip.text.trim()) {
      const textSize = clip.textSize ?? 20                  // % of shape height
      const fontSize = (textSize / 100) * sh
      const weight   = clip.textBold   ? 'bold'   : 'normal'
      const fStyle   = clip.textItalic ? 'italic' : 'normal'
      const align    = clip.textAlign  ?? 'center'
      ctx.font         = `${fStyle} ${weight} ${fontSize}px ${clip.textFont ?? 'Arial,sans-serif'}`
      ctx.fillStyle    = clip.textColor ?? '#ffffff'
      ctx.textAlign    = align
      ctx.textBaseline = 'middle'
      ctx.globalAlpha  = globalAlpha
      const textX = align === 'center' ? 0 : align === 'left' ? -(sw / 2) * 0.88 : (sw / 2) * 0.88
      const maxW  = sw * 0.88
      const lines = wrapText(ctx, clip.text, maxW)
      const lineH = fontSize * 1.3
      let   y     = -((lines.length - 1) * lineH) / 2
      for (const line of lines) {
        ctx.fillText(line, textX, y)
        y += lineH
      }
    }

    ctx.restore()
  })
}

export function drawTextClips(ctx, clips, w, h, currentTime, doClear = true) {
  if (doClear) ctx.clearRect(0, 0, w, h)
  clips.forEach(clip => {
    const x        = (clip.posX   / 100) * w
    const y        = (clip.posY   / 100) * h
    const scale    = (clip.scale  ?? 100) / 100
    const opacity  =  clip.opacity ?? 1
    const rotation = ((clip.rotation ?? 0) * Math.PI) / 180
    const fontSize = (clip.fontSize ?? 72) * scale
    const fontStr  = `${clip.fontStyle ?? 'normal'} ${clip.fontWeight ?? '700'} ${fontSize}px "${clip.fontFamily ?? 'Arial'}"`

    let motionOpacity = 1, motionTx = 0, motionTy = 0, motionScale = 1
    const ct = currentTime ?? 0
    const motionIn  = clip.motionIn  ?? 'none'
    const motionOut = clip.motionOut ?? 'none'
    const inDur  = Math.max(0.05, clip.motionInDur  ?? 0.5)
    const outDur = Math.max(0.05, clip.motionOutDur ?? 0.5)
    const tIn    = ct - (clip.startSec ?? 0)
    if (motionIn !== 'none' && tIn >= 0 && tIn < inDur) {
      const p = easeOutCubic(Math.min(1, tIn / inDur))
      switch (motionIn) {
        case 'fade':       motionOpacity = p;                        break
        case 'slideLeft':  motionTx = -(1 - p) * w;                 break
        case 'slideRight': motionTx =  (1 - p) * w;                 break
        case 'slideUp':    motionTy =  (1 - p) * h * 0.7;           break
        case 'slideDown':  motionTy = -(1 - p) * h * 0.7;           break
        case 'zoomIn':     motionScale = 0.1 + 0.9 * p;             break
        case 'bounceIn':   motionScale = easeOutBounce(p);           break
      }
    }
    const tOut = (clip.startSec ?? 0) + (clip.durSec ?? 5) - ct
    if (motionOut !== 'none' && tOut >= 0 && tOut < outDur) {
      const p = easeInCubic(Math.min(1, 1 - tOut / outDur))
      switch (motionOut) {
        case 'fade':       motionOpacity *= (1 - p);                 break
        case 'slideLeft':  motionTx = -p * w;                        break
        case 'slideRight': motionTx =  p * w;                        break
        case 'slideUp':    motionTy = -p * h * 0.7;                  break
        case 'slideDown':  motionTy =  p * h * 0.7;                  break
        case 'zoomOut':    motionScale *= (1 - p * 0.9);             break
      }
    }

    ctx.save()
    ctx.globalAlpha  = opacity * motionOpacity
    ctx.translate(x + motionTx, y + motionTy)
    ctx.rotate(rotation)
    if (motionScale !== 1) ctx.scale(motionScale, motionScale)
    ctx.font         = fontStr
    ctx.textAlign    = clip.textAlign ?? 'center'
    ctx.textBaseline = 'middle'

    const lines = (clip.textContent ?? '').split('\n')
    const lineH = fontSize * 1.25

    lines.forEach((line, i) => {
      const lx = 0
      const ly = -((lines.length - 1) * lineH) / 2 + i * lineH

      if (clip.bgEnabled) {
        const pad     = clip.bgPadding ?? 8
        const metrics = ctx.measureText(line)
        const tw      = metrics.width
        const bx      = clip.textAlign === 'center' ? lx - tw / 2 - pad
          : clip.textAlign === 'right'  ? lx - tw - pad : lx - pad
        ctx.fillStyle   = clip.bgColor ?? '#000000'
        ctx.globalAlpha = opacity * motionOpacity * (clip.bgOpacity ?? 0.6)
        const radius = 4
        const bw = tw + pad * 2, bh = fontSize + pad * 2, by = ly - fontSize / 2 - pad
        ctx.beginPath()
        ctx.roundRect?.(bx, by, bw, bh, radius) || ctx.rect(bx, by, bw, bh)
        ctx.fill()
        ctx.globalAlpha = opacity * motionOpacity
      }

      if (clip.shadowEnabled) {
        ctx.shadowColor   = hexToRgba(clip.shadowColor ?? '#000000', clip.shadowOpacity ?? 0.75)
        ctx.shadowOffsetX = clip.shadowX   ?? 2
        ctx.shadowOffsetY = clip.shadowY   ?? 4
        ctx.shadowBlur    = clip.shadowBlur ?? 8
      } else {
        ctx.shadowColor = 'transparent'
      }

      if (clip.strokeEnabled && (clip.strokeWidth ?? 0) > 0) {
        ctx.strokeStyle = clip.strokeColor ?? '#000000'
        ctx.lineWidth   = clip.strokeWidth
        ctx.lineJoin    = 'round'
        ctx.strokeText(line, lx, ly)
      }

      ctx.shadowColor = 'transparent'
      ctx.fillStyle   = clip.color ?? '#ffffff'
      if (clip.shadowEnabled) {
        ctx.shadowColor   = hexToRgba(clip.shadowColor ?? '#000000', clip.shadowOpacity ?? 0.75)
        ctx.shadowOffsetX = clip.shadowX   ?? 2
        ctx.shadowOffsetY = clip.shadowY   ?? 4
        ctx.shadowBlur    = clip.shadowBlur ?? 8
      }
      ctx.fillText(line, lx, ly)
      ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0

      if (clip.textDecoration === 'underline') {
        const metrics = ctx.measureText(line)
        const tw      = metrics.width
        const ux = clip.textAlign === 'center' ? lx - tw / 2 : clip.textAlign === 'right' ? lx - tw : lx
        const uy = ly + fontSize * 0.55
        ctx.strokeStyle = clip.color ?? '#ffffff'
        ctx.lineWidth   = Math.max(1, fontSize / 20)
        ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux + tw, uy); ctx.stroke()
      }
    })
    ctx.restore()
  })
}
