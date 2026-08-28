let _ffLoad = null

export function ensureFFmpeg() {
  if (!_ffLoad) {
    _ffLoad = (async () => {
      // @ffmpeg/ffmpeg v0.12 requires SharedArrayBuffer (COOP+COEP headers)
      if (!self.crossOriginIsolated) {
        throw new Error(
          'Export requires Cross-Origin Isolation headers.\n' +
          'Stop the dev server (Ctrl+C), then restart it with: npm run dev\n' +
          '(The vite.config.js was updated with the required headers.)'
        )
      }

      const { FFmpeg }         = await import('@ffmpeg/ffmpeg')
      const { toBlobURL }      = await import('@ffmpeg/util')

      const ff = new FFmpeg()

      // toBlobURL fetches from localhost and returns a same-origin blob: URL.
      // @ffmpeg/ffmpeg v0.12 requires blob URLs — plain paths cause the worker to hang.
      const [coreBlob, wasmBlob] = await Promise.all([
        toBlobURL('/ffmpeg/ffmpeg-core.js',   'text/javascript'),
        toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
      ])

      const loadTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(
          'FFmpeg timed out (60 s). Refresh the page and try again.'
        )), 60_000)
      )

      await Promise.race([
        ff.load({ coreURL: coreBlob, wasmURL: wasmBlob }),
        loadTimeout,
      ])

      return ff
    })()
  }
  return _ffLoad
}

export function resetFFmpeg() {
  _ffLoad = null
}
