/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { browserSkipBanner } from './vitestBrowserSkipReporter';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString())
  },
  plugins: [react(), VitePWA({
    // A Capacitor build (#2085) already ships every asset inside the binary —
    // the service worker would add nothing but a stale-cache layer and a
    // reload path, on top of the black-screen-on-resume risk documented below.
    disable: process.env.VITE_TARGET === 'native',
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
      globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,webp,svg,woff,woff2}'],
      // The arcade pages are not precached. This app never activates a new
      // service worker on its own (see registerType above), so a precached
      // /retro or /shmup stayed on the old build until the player accepted the
      // main app's update prompt — which the arcade pages don't have. Left
      // out, their HTML always comes from the network and names the latest
      // hashed scripts; src/arcade/page.ts watches for new deploys.
      globIgnores: ['**/node_modules/**/*', 'retro.html', 'shmup.html'],
      // /retro and /shmup are separate games (retro.html, shmup.html), not
      // routes of this app — never let an unmatched navigation there fall
      // back to index.html. Case-insensitive so /Retro reaches the network and
      // public/404.html can redirect it.
      navigateFallbackDenylist: [/^\/(retro|shmup)/i],
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
      // Entry points: the game, the standalone /chronicle-status endpoint
      // (see src/chronicleStatus.ts), and the separate arcade games at
      // /retro and /shmup (see src/retro/main.ts, src/shmup/main.ts).
      input: {
        main: path.resolve(dirname, 'index.html'),
        chronicleStatus: path.resolve(dirname, 'chronicle-status.html'),
        retro: path.resolve(dirname, 'retro.html'),
        shmup: path.resolve(dirname, 'shmup.html'),
      },
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
    reporters: ['default', browserSkipBanner()],
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