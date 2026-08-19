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
    // 'prompt' (not 'autoUpdate') so a newly-installed SW never applies itself:
    // the app surfaces a "new version" prompt and only reloads when the player
    // accepts. Combined with removing skipWaiting/clientsClaim below, this stops
    // the force-reload-on-resume that black-screened memory-pressured devices.
    registerType: 'prompt',
    workbox: {
      // No skipWaiting/clientsClaim: the new SW waits in the background until
      // the app calls updateServiceWorker(true) on the player's tap. Until then
      // the old SW keeps serving a consistent asset set (no stale-chunk risk).
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
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
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
        configDir: path.join(dirname, '.storybook'),
        // Only stories tagged 'ci' become vitest tests (#2212). Previously
        // set via `test.env.__VITEST_INCLUDE_TAGS__` below, which does
        // nothing — that env var is written by this plugin (computed from
        // *this* tags option), never read from the outside. Its real
        // default is Storybook's own automatic 'test' tag, so every story
        // was actually running here regardless of the 'ci' tag anyone
        // added — including the two pre-existing 'ci'-tagged reference
        // stories (SynergyBadges, Battlefield), which is what surfaced
        // this: verifying newly-tagged DeckBuilder stories against a real
        // webkit run showed zero of the 'ci'-tagged files executing at
        // all, tagged or not.
        tags: { include: ['ci'] },
      })],
      test: {
        name: 'storybook',
        testTimeout: 30000,
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          // webkit alongside chromium (#2212) — added after a WebKit-only
          // layout bug (a percentage max-height against an auto-height flex
          // parent, #2210) reached a real device with every check in this
          // repo, local and CI, having run against chromium only.
          instances: [
            { browser: 'chromium' },
            { browser: 'webkit' },
          ]
        },
      }
    }]
  }
});