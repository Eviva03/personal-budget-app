import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
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
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      cleanupOutdatedCaches: true,
      // Auth and data calls must always reach the network, even for direct navigations.
      navigateFallbackDenylist: [/^\/api\//, /^\/neon-auth\//],
      // Heavy import-only modules are cached on first use instead of on every install.
      globIgnores: ['**/pdf-*.js', '**/pdf.worker*', '**/ocr/**'],
      runtimeCaching: [{
        urlPattern: ({ url }: { url: URL }) => /\/assets\/(pdf-|pdf\.worker)/.test(url.pathname) || url.pathname.startsWith('/ocr/'),
        handler: 'CacheFirst',
        options: { cacheName: 'import-tools', expiration: { maxEntries: 6 } },
      }],
    },
  })],
})
