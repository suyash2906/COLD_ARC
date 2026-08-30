import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// GitHub Pages serves project sites from /<repo>/, but the dev server serves from root.
// Override with VITE_BASE if you rename the repo or move to a custom domain.
const BASE = process.env.VITE_BASE ?? '/cold-arc/'

export default defineConfig(({ command, isPreview }) => ({
  // `vite preview` also runs as the "serve" command, but it serves the built output and
  // should mirror production exactly — otherwise every asset 404s into the SPA fallback.
  base: command === 'serve' && !isPreview ? '/' : BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // .webmanifest is missing from some static servers' MIME tables (vite preview
      // included), which makes them fall through to the SPA handler and return HTML.
      // .json is understood everywhere.
      manifestFilename: 'manifest.json',
      includeAssets: ['icon-180.png', 'favicon.svg'],
      manifest: {
        name: 'Cold Arc',
        short_name: 'Cold Arc',
        description: 'Lock in. Track your winter arc.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#08090B',
        background_color: '#08090B',
        categories: ['health', 'lifestyle', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Hash routing means every route resolves to index.html.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
