import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  // credentialless: enables SharedArrayBuffer (needed by @ffmpeg/ffmpeg v0.12)
  // while still allowing cross-origin media URLs to load (unlike require-corp)
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

export default defineConfig({
  plugins: [react()],
  server: {
    headers: crossOriginHeaders,
    proxy: {
      '/hf-api': {
        target: 'https://api-inference.huggingface.co',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/hf-api/, ''),
      },
    },
  },
  preview: { headers: crossOriginHeaders },
  // Exclude from pre-bundling so Vite serves them directly from node_modules.
  // @ffmpeg/ffmpeg creates its worker via new Worker(new URL('./worker.js', import.meta.url))
  // — if Vite bundles it, import.meta.url points to the deps cache and the worker URL breaks.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
})
