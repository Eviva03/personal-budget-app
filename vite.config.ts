import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    selfDestroying: true,
    manifest: {
      name: 'Horizon',
      short_name: 'Horizon',
      description: 'Suivi personnel de budget, transactions et engagements.',
      lang: 'fr',
      start_url: '/',
      display: 'standalone',
      background_color: '#f4f7fb',
      theme_color: '#18212b',
      icons: [
        { src: 'pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
        { src: 'pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
      ],
    },
  })],
})
