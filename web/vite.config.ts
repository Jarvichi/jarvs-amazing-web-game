/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString())
  },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    workbox: {
      skipWaiting: true,
      clientsClaim: true,
      // Cache all static assets with cache-first strategy
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      runtimeCaching: [{
        urlPattern: /\/sprites\/.+\.svg$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'sprites-cache',
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
          }
        }
      }]
    },
    manifest: {
      name: "Jarv's Amazing Web Game",
      short_name: 'JarvGame',
      description: 'A browser-based strategy card game',
      theme_color: '#0a0a0a',
      background_color: '#0a0a0a',
      display: 'standalone',
      start_url: '/',
      icons: [{
        src: '/pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png'
      }, {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      }, {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }, {
        src: '/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }]
    }
  })],
  base: '/',
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
          if (id.includes('/src/game/')) {
            return 'game-logic';
          }
        }
      }
    }
  },
  test: {
    projects: [{
      extends: true,
      test: {
        globals: true,
        environment: 'node'
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});