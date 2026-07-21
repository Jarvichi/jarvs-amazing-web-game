import type { StorybookConfig } from '@storybook/react-vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => res(body))
    req.on('error', rej)
  })
}

function jsonOk(res: ServerResponse, data: unknown) {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function jsonErr(res: ServerResponse, code: number, msg: string) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: msg }))
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

  viteFinal: (config) => {
    config.plugins = config.plugins ?? []
    config.plugins.push({
      name: 'dev-api-routes',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== 'POST') { next(); return }

          if (req.url === '/api/bundle-editor/save') {
            try {
              const { data } = JSON.parse(await readBody(req))
              writeFileSync(resolve(SRC, 'data/bundles/bundles.json'), JSON.stringify(data, null, 2))
              jsonOk(res, { ok: true })
            } catch (e) { jsonErr(res, 500, `bundle save failed: ${String(e)}`) }
            return
          }

          if (req.url === '/api/bundle-editor/append') {
            try {
              const { bundleId, tiles } = JSON.parse(await readBody(req))
              const filePath = resolve(SRC, 'data/bundles/bundles.json')
              const current = JSON.parse(readFileSync(filePath, 'utf8'))
              const updated = (current as { bundleID: string }[]).filter(b => b.bundleID !== bundleId)
              updated.push({ bundleID: bundleId, tiles })
              writeFileSync(filePath, JSON.stringify(updated, null, 2))
              jsonOk(res, { ok: true })
            } catch (e) { jsonErr(res, 500, `bundle append failed: ${String(e)}`) }
            return
          }

          if (req.url === '/api/map-editor/save') {
            try {
              const { mapId, data } = JSON.parse(await readBody(req))
              writeFileSync(resolve(SRC, `data/hub/${mapId}/config.json`), JSON.stringify(data, null, 2))
              jsonOk(res, { ok: true })
            } catch (e) { jsonErr(res, 500, `map save failed: ${String(e)}`) }
            return
          }

          if (req.url === '/api/map-editor/save-questdefs') {
            try {
              const { mapId, data } = JSON.parse(await readBody(req))
              writeFileSync(resolve(SRC, `data/hub/${mapId}/questDefs.json`), JSON.stringify(data, null, 2))
              jsonOk(res, { ok: true })
            } catch (e) { jsonErr(res, 500, `questDefs save failed: ${String(e)}`) }
            return
          }

          if (req.url === '/api/battlefield-editor/save') {
            try {
              const { actId, data } = JSON.parse(await readBody(req))
              writeFileSync(resolve(SRC, `data/acts/${actId}.json`), JSON.stringify(data, null, 2))
              jsonOk(res, { ok: true })
            } catch (e) { jsonErr(res, 500, `battlefield act save failed: ${String(e)}`) }
            return
          }

          next()
        })
      },
    })
    return config
  },
}

export default config
