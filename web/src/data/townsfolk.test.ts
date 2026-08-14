import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  TOWNSFOLK_BODIES, TOWNSFOLK_HAIR, TOWNSFOLK_HATS,
  SKIN_TONES, HAIR_COLOURS, OUTFIT_COLOURS, ACCENT_COLOURS, HAT_COLOURS,
  townsfolkLayers, allTownsfolkSlugs, type TownsfolkLook,
} from './townsfolk'

const SPRITES = join(dirname(fileURLToPath(import.meta.url)), '../../public/sprites')

const LOOK: TownsfolkLook = {
  body: 'tunic', hair: 'short', hat: 'cap',
  skin: 0xf0c9a0, outfit: 0x4a6fa5, accent: 0xd4af37, hairColour: 0x2a1a0a, hatColour: 0x8b5e3c,
}

describe('townsfolkLayers', () => {
  it('uses the outfit as the base sprite, since it owns the hit area', () => {
    expect(townsfolkLayers(LOOK).base).toEqual({
      slug: 'townsfolk-tunic-outfit', tint: 0x4a6fa5, animated: true, z: 0,
    })
  })

  it('draws the shadow behind the base and every other layer in front of it', () => {
    const { overlays } = townsfolkLayers(LOOK)
    const shadow = overlays.find(l => l.slug === 'townsfolk-shadow')!
    expect(shadow.z).toBeLessThan(0)
    for (const l of overlays.filter(o => o !== shadow)) expect(l.z).toBeGreaterThan(0)
  })

  it('orders head layers skin → face → hair → hat', () => {
    const z = Object.fromEntries(townsfolkLayers(LOOK).overlays.map(l => [l.slug, l.z]))
    expect(z['townsfolk-skin']).toBeLessThan(z['townsfolk-face'])
    expect(z['townsfolk-face']).toBeLessThan(z['townsfolk-hair-short'])
    expect(z['townsfolk-hair-short']).toBeLessThan(z['townsfolk-hat-cap'])
  })

  it('omits the hat layer entirely when bare-headed', () => {
    const { overlays } = townsfolkLayers({ ...LOOK, hat: undefined })
    expect(overlays.some(l => l.slug.startsWith('townsfolk-hat-'))).toBe(false)
  })

  it('animates only the body layers — head layers are frameless by design', () => {
    const { base, overlays } = townsfolkLayers(LOOK)
    expect(base.animated).toBe(true)
    const animated = overlays.filter(l => l.animated).map(l => l.slug)
    expect(animated).toEqual(['townsfolk-tunic-accent'])
  })

  it('leaves the shadow and eyes untinted so they keep their own colours', () => {
    const { overlays } = townsfolkLayers(LOOK)
    for (const slug of ['townsfolk-shadow', 'townsfolk-face']) {
      expect(overlays.find(l => l.slug === slug)!.tint).toBe(0xffffff)
    }
  })

  it('never emits two layers at the same depth', () => {
    const { base, overlays } = townsfolkLayers(LOOK)
    const zs = [base.z, ...overlays.map(l => l.z)]
    expect(new Set(zs).size).toBe(zs.length)
  })
})

describe('townsfolk art on disk', () => {
  it('ships every sprite the catalog can reference', () => {
    const missing = allTownsfolkSlugs().filter(s => !existsSync(join(SPRITES, `${s}.svg`)))
    expect(missing).toEqual([])
  })

  it('ships -1/-2/-3 walk frames for exactly the animated layers', () => {
    for (const body of TOWNSFOLK_BODIES) {
      for (const part of ['outfit', 'accent']) {
        for (const frame of [1, 2, 3]) {
          expect(existsSync(join(SPRITES, `townsfolk-${body}-${part}-${frame}.svg`))).toBe(true)
        }
      }
    }
    // Head-attached layers must NOT have frames — the head never moves, and a
    // stray frame file would silently start animating it out of sync.
    for (const slug of ['townsfolk-skin', 'townsfolk-face', 'townsfolk-hair-short', 'townsfolk-hat-cap']) {
      expect(existsSync(join(SPRITES, `${slug}-1.svg`))).toBe(false)
    }
  })

  it('fills tinted layers with plain white so sprite.tint can colour them', () => {
    const tinted = allTownsfolkSlugs().filter(s => s !== 'townsfolk-shadow' && s !== 'townsfolk-face')
    for (const slug of tinted) {
      const svg = readFileSync(join(SPRITES, `${slug}.svg`), 'utf8')
      const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map(m => m[1])
      expect(fills.length).toBeGreaterThan(0)
      expect(fills.every(f => f === '#ffffff')).toBe(true)
    }
  })

  it('keeps the head in the same place across every body and walk frame', () => {
    // The whole shared-head-layer scheme rests on this: if a body ever moves
    // its shoulders, the frameless skin/hair/hat layers detach from it.
    const shoulderY = (svg: string) =>
      [...svg.matchAll(/<rect[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/g)]
        .map(m => Number(m[1])).filter(y => y >= 13 && y <= 15)
    for (const body of TOWNSFOLK_BODIES) {
      const frames = ['', '-1', '-2', '-3'].map(f =>
        shoulderY(readFileSync(join(SPRITES, `townsfolk-${body}-outfit${f}.svg`), 'utf8')))
      // The torso rect starts at y=14 in every frame of every body.
      for (const ys of frames) expect(ys).toContain(14)
    }
  })
})

describe('townsfolk palettes', () => {
  it('offers enough of each colour that a town of a dozen rarely repeats', () => {
    for (const palette of [SKIN_TONES, HAIR_COLOURS, OUTFIT_COLOURS, ACCENT_COLOURS, HAT_COLOURS]) {
      expect(palette.length).toBeGreaterThanOrEqual(7)
      expect(new Set(palette).size).toBe(palette.length)
    }
  })

  it('yields millions of distinct looks from a few dozen files', () => {
    // Bare-headed is one option; each hat style multiplies by its colours too.
    const headwear = 1 + TOWNSFOLK_HATS.length * HAT_COLOURS.length
    const combos = TOWNSFOLK_BODIES.length * TOWNSFOLK_HAIR.length * headwear
      * SKIN_TONES.length * OUTFIT_COLOURS.length * ACCENT_COLOURS.length * HAIR_COLOURS.length
    expect(combos).toBeGreaterThan(1_000_000)
  })
})
