export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

// M:SS format used for mark in/out display and clip timing
export function formatMSS(s) {
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function parseTime(str) {
  const [h, m, s] = str.split(':').map(Number)
  return h * 3600 + m * 60 + s
}
