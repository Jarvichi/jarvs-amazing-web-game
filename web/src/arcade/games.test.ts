import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GAMES, step } from './games'

const web = resolve(__dirname, '../..')
const read = (f: string) => readFileSync(resolve(web, f), 'utf8')

// A page missing from any of these leaves players on a stale or wrong page.
describe('every arcade page is registered', () => {
  const vite = read('vite.config.ts')
  const notFound = read('public/404.html')
  const pages = [...GAMES.map(g => g.path.slice(1)), 'arcade']
  // The service worker's fallback rule; Workbox tests it against path + query.
  const allow = new RegExp(vite.match(/navigateFallbackAllowlist: \[\/(.*)\/\]/)![1])
  const fallsBackToApp = (url: string) => allow.test(url)

  it("only the main app's own URL falls back to it", () => {
    for (const url of ['/', '/index.html', '/?invite=abc']) expect(fallsBackToApp(url), url).toBe(true)
    for (const url of ['/privacy', '/chronicle-status', '/some-future-game']) expect(fallsBackToApp(url), url).toBe(false)
  })

  it.each(pages)('%s', name => {
    // Its own HTML entry, built by Vite...
    expect(read(`${name}.html`)).toContain('<script type="module"')
    expect(vite).toMatch(new RegExp(`${name}: path\\.resolve\\(dirname, '${name}\\.html'\\)`))
    // ...kept out of the main app's service worker...
    expect(vite).toContain(`'${name}.html'`)
    for (const url of [`/${name}`, `/${name}/`, `/${name.toUpperCase()}`, `/${name}?x=1`]) {
      expect(fallsBackToApp(url), url).toBe(false)
    }
    // ...and reachable from near-miss URLs like /Chase or /chase/.
    expect(notFound).toMatch(new RegExp(`var games = \\[[^\\]]*'${name}'`))
  })
})

describe('GAMES', () => {
  it('has unique paths and hi-score keys', () => {
    expect(new Set(GAMES.map(g => g.path)).size).toBe(GAMES.length)
    expect(new Set(GAMES.map(g => g.hiscoreKey)).size).toBe(GAMES.length)
  })

  it('names the key each game really saves its hi-score under', () => {
    for (const g of GAMES) expect(read(`src${g.path}/main.ts`)).toContain(`'${g.hiscoreKey}'`)
  })

  // iOS Safari ignores user-scalable=no, so a page without this zooms on a double tap.
  it('every game stops phones zooming the page', () => {
    for (const g of GAMES) expect(read(`src${g.path}/main.ts`)).toMatch(/^preventZoom\(\)/m)
  })

  it('arrow navigation wraps round', () => {
    expect(step(0, -1)).toBe(GAMES.length - 1)
    expect(step(GAMES.length - 1, 1)).toBe(0)
  })
})
