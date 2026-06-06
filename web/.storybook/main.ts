import type { StorybookConfig } from '@storybook/react-vite'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { IncomingMessage, ServerResponse } from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const MAP_PATHS: Record<string, string> = {
  hub:    resolve(__dirname, '../src/data/hub/config.json'),
  town2:  resolve(__dirname, '../src/data/town2/config.json'),
  castle: resolve(__dirname, '../src/data/castle/config.json'),
}

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-onboarding',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/react-vite',

  viteFinal: async (viteConfig) => {
    viteConfig.plugins = viteConfig.plugins ?? []
    viteConfig.plugins.push({
      name: 'map-editor-save',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use(
          '/api/map-editor/save',
          (req: IncomingMessage, res: ServerResponse) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end('Method Not Allowed')
              return
            }
            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', () => {
              try {
                const { mapId, data } = JSON.parse(body) as { mapId: string; data: unknown }
                const filePath = MAP_PATHS[mapId]
                if (!filePath) {
                  res.statusCode = 400
                  res.end(JSON.stringify({ error: `Unknown mapId: ${mapId}` }))
                  return
                }
                writeFileSync(filePath, JSON.stringify(data, null, 2))
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true }))
              } catch (e) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: String(e) }))
              }
            })
          },
        )
      },
    })
    return viteConfig
  },
}

export default config
