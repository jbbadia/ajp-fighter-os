import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // "/" for the Java server; GitHub Pages builds set VITE_BASE=/ajp-fighter-os/
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  // The main bundle (~290 kB gzip, mostly the chart library) is fine for this app.
  build: { chunkSizeWarningLimit: 1200 },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    // Phase 5: el backend Spring Boot se expondrá bajo /api
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
})
