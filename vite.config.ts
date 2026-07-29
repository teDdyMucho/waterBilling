import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Sariling SW (src/sw.ts) para kasama ang Web Push, hindi lang offline.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 'prompt' — hindi basta-basta magre-reload; tatanungin muna ang user.
      registerType: 'prompt',
      // Kami mismo ang magre-register via virtual:pwa-register/react.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'SCS Billing Portal — Santa Cicilia Subdivision',
        short_name: 'SCS Billing',
        description:
          'Opisyal na portal ng Santa Cicilia Subdivision para sa water at electricity billing. Tingnan ang bill, konsumo, at magbayad online.',
        lang: 'tl',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        categories: ['finance', 'utilities', 'productivity'],
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Mga Bill', short_name: 'Bills', url: '/dashboard/bills' },
          { name: 'Magbayad', short_name: 'Pay', url: '/dashboard/payments' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Ang charts chunk (recharts) ay medyo mabigat — taasan ang limit.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        // I-on kung gusto mong subukan ang SW sa `npm run dev` (http://localhost).
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Hatiin ang vendor para mas mabilis ang cache sa mga susunod na bisita
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
          charts: ['recharts'],
        },
      },
    },
  },
})
