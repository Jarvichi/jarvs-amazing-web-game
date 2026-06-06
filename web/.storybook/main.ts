import type { StorybookConfig } from '@storybook/react-vite'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

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
    const root = viteConfig.root ?? process.cwd()
    const MAP_PATHS: Record<string, string> = {
      hub:    resolve(root, 'src/data/hub/config.json'),
      town2:  resolve(root, 'src/data/town2/config.json'),
      castle: resolve(root, 'src/data/castle/config.json'),
    }
    const QUEST_DEFS_PATHS: Record<string, string> = {
      hub: resolve(root, 'src/data/hub/questDefs.json'),
    }

    const handleSaveRequest = (
      body: string, pathMap: Record<string, string>,
      res: ServerResponse, errorPrefix: string,
    ) => {
      try {
        const { mapId, data } = JSON.parse(body) as { mapId: string; data: unknown }
        const filePath = pathMap[mapId]
        if (!filePath) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `Unknown mapId: ${mapId}` }))
          return
        }
        writeFileSync(filePath, JSON.stringify(data, null, 2))
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: `${errorPrefix}: ${String(e)}` }))
      }
    }

    viteConfig.plugins = viteConfig.plugins ?? []
    viteConfig.plugins.unshift({
      name: 'map-editor-save',
      enforce: 'pre',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use(
          (req: IncomingMessage, res: ServerResponse, next: () => void) => {
            if (req.method !== 'POST' ||
                (req.url !== '/api/map-editor/save' && req.url !== '/api/map-editor/save-questdefs')) {
              next()
              return
            }
            const isQuestDefs = req.url === '/api/map-editor/save-questdefs'
            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', () => {
              handleSaveRequest(
                body,
                isQuestDefs ? QUEST_DEFS_PATHS : MAP_PATHS,
                res,
                isQuestDefs ? 'questDefs save failed' : 'map save failed',
              )
            })
          },
        )
      },
    })
    return viteConfig
  },
}

export default config
