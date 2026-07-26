import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')

function readBody(req) {
  return new Promise((res, rej) => {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => res(body))
    req.on('error', rej)
  })
}

function jsonOk(res, data) {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function jsonErr(res, code, msg) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: msg }))
}

export default function middleware(app) {
  app.post('/api/bundle-editor/save', async (req, res) => {
    try {
      const { data } = JSON.parse(await readBody(req))
      writeFileSync(resolve(SRC, 'data/bundles/bundles.json'), JSON.stringify(data, null, 2))
      jsonOk(res, { ok: true })
    } catch (e) {
      jsonErr(res, 500, `bundle save failed: ${String(e)}`)
    }
  })

  app.post('/api/bundle-editor/append', async (req, res) => {
    try {
      const { bundleId, tiles } = JSON.parse(await readBody(req))
      const filePath = resolve(SRC, 'data/bundles/bundles.json')
      const current = JSON.parse(readFileSync(filePath, 'utf8'))
      const updated = current.filter(b => b.bundleID !== bundleId)
      updated.push({ bundleID: bundleId, tiles })
      writeFileSync(filePath, JSON.stringify(updated, null, 2))
      jsonOk(res, { ok: true })
    } catch (e) {
      jsonErr(res, 500, `bundle append failed: ${String(e)}`)
    }
  })

  app.post('/api/battlefield-bundle-editor/save', async (req, res) => {
    try {
      const { data } = JSON.parse(await readBody(req))
      writeFileSync(resolve(SRC, 'data/bundles/battlefieldBundles.json'), JSON.stringify(data, null, 2))
      jsonOk(res, { ok: true })
    } catch (e) {
      jsonErr(res, 500, `battlefield bundle save failed: ${String(e)}`)
    }
  })

  app.post('/api/map-editor/save', async (req, res) => {
    try {
      const { mapId, data } = JSON.parse(await readBody(req))
      writeFileSync(resolve(SRC, `data/hub/${mapId}/config.json`), JSON.stringify(data, null, 2))
      jsonOk(res, { ok: true })
    } catch (e) {
      jsonErr(res, 500, `map save failed: ${String(e)}`)
    }
  })

  app.post('/api/map-editor/save-questdefs', async (req, res) => {
    try {
      const { mapId, data } = JSON.parse(await readBody(req))
      writeFileSync(resolve(SRC, `data/hub/${mapId}/questDefs.json`), JSON.stringify(data, null, 2))
      jsonOk(res, { ok: true })
    } catch (e) {
      jsonErr(res, 500, `questDefs save failed: ${String(e)}`)
    }
  })
}
