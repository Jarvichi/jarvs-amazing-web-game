import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        clientsClaim: true,
        // Cache all static assets with cache-first strategy
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/jarvs-amazing-web-game\/sprites\/.+\.svg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sprites-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      manifest: {
        name: "Jarv's Amazing Web Game",
        short_name: 'JarvGame',
        description: 'A browser-based strategy card game',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/jarvs-amazing-web-game/',
        icons: [
          {
            src: '/jarvs-amazing-web-game/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: '/jarvs-amazing-web-game/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/jarvs-amazing-web-game/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/jarvs-amazing-web-game/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  base: '/jarvs-amazing-web-game/',
  build: {
    sourcemap: true,
  },
})
