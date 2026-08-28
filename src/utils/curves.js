export const DEFAULT_CURVE = [[0, 0], [255, 255]]

export function evalCurve(pts, x) {
  if (!pts || pts.length === 0) return x
  const s = pts.slice().sort((a, b) => a[0] - b[0])
  if (x <= s[0][0]) return s[0][1]
  if (x >= s[s.length - 1][0]) return s[s.length - 1][1]
  for (let i = 0; i < s.length - 1; i++) {
    if (x >= s[i][0] && x < s[i + 1][0]) {
      const t = (x - s[i][0]) / (s[i + 1][0] - s[i][0])
      return s[i][1] + t * (s[i + 1][1] - s[i][1])
    }
  }
  return x
}

export function isIdentityCurve(pts) {
  if (!pts || pts.length < 2) return true
  const s = pts.slice().sort((a, b) => a[0] - b[0])
  return s[0][0] === 0 && s[0][1] === 0 &&
         s[s.length - 1][0] === 255 && s[s.length - 1][1] === 255 &&
         s.length === 2
}

// Returns space-separated SVG tableValues string, or null if curve is identity
export function curveToTableValues(pts, steps = 17) {
  if (isIdentityCurve(pts)) return null
  return Array.from({ length: steps }, (_, i) => {
    const x = (i / (steps - 1)) * 255
    return Math.max(0, Math.min(1, evalCurve(pts, x) / 255)).toFixed(4)
  }).join(' ')
}
