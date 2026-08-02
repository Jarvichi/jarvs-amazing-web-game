import * as PIXI from 'pixi.js'
import { TILE_SIZE } from '../data/tiles/tileIndex'
import { seededRand, hashStr } from './mapUtils'
import type { SkyHole } from './terrainPatchPlan'

// ─── The 'cloud' surface (EnvTileDef.surface) ────────────────────────────────
//
// The sky environment has no tileset — there are no cloud tiles anywhere under
// web/public — so its floor and its obstacles are drawn procedurally here, the
// same way utils/terrainGfx.ts draws scatter props. buildTerrainGfx calls
// drawCloudField for the ground and buildTerrainDecorGfx calls drawCloudHoles
// for the obstacles (both in utils/terrainLayer.ts).
//
// Everything is deterministic off the caller's id, and drawn once at build
// time: like every other environment, the terrain layer is never redrawn, so
// none of this costs anything per frame.

// Cloud floor palette — the shadowed troughs between billows through to the lit
// crests. Extends the `cloud` prop colours in utils/terrainGfx.ts.
const CLOUD_DEEP   = 0x89A5C6
const CLOUD_SHADOW = 0xAFC6DF
const CLOUD_MID    = 0xDCE8F6
const CLOUD_LIGHT  = 0xF1F7FF
const CLOUD_CREST  = 0xFFFFFF

// Hole palette — the drop through the cloud layer, and the lip around it.
const HOLE_VOID      = 0x33465F
const HOLE_LIP_SHADE = 0xB6CCE4

// Landscape-far-below palette. Desaturated and low-contrast on purpose: it is
// meant to read as ground seen through a lot of atmosphere, not as a second
// battlefield competing with the units on top of it.
const LAND_BASE   = 0x6C8557
const LAND_FIELDS = [0x7E9A62, 0x8C7E52, 0x5F7A4A, 0x94854F, 0x6E8A55]
const LAND_FOREST = 0x40593A
const LAND_HILL   = 0x54694C
const LAND_RIVER  = 0x7EA0C4
/** Aerial perspective: the blue an entire sky's worth of air puts over it. */
const LAND_DISTANCE = 0x8098B4

interface Billow { x: number; y: number; rx: number; ry: number; crest: boolean }

/**
 * Billow centres on a jittered grid rather than a free scatter: the cloud floor
 * has to cover every pixel of the canvas, and random placement reliably leaves
 * bald patches that would read as holes nobody authored. Called twice at
 * different cell sizes, so the surface has big masses with smaller puffs riding
 * on them instead of one uniform bubble-wrap texture.
 */
function planBillows(rand: () => number, w: number, h: number, cell: number, density = 1): Billow[] {
  const out: Billow[] = []
  const cols = Math.ceil(w / cell)
  const rows = Math.ceil(h / cell)
  // Starts one cell outside the canvas so the edges are covered by whole
  // billows, not by the flat base fill.
  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) {
      if (rand() > density) continue
      const rx = cell * (0.45 + rand() * 0.55)
      out.push({
        x:  c * cell + cell / 2 + (rand() - 0.5) * cell * 0.9,
        y:  r * cell + cell / 2 + (rand() - 0.5) * cell * 0.9,
        rx,
        ry: rx * (0.55 + rand() * 0.32),
        crest: rand() < 0.55,
      })
    }
  }
  return out
}

/** One pass of billows: trough, body, lit top, and a crest on some of them. */
function paintBillows(g: PIXI.Graphics, billows: Billow[], rand: () => number, bodyAlpha: number): void {
  // Pass order matters, and is why the billows are planned up front: every
  // trough has to sit under every body, or clusters shadow each other.
  for (const b of billows)
    g.ellipse(b.x, b.y + b.ry * 0.42, b.rx * 1.04, b.ry * 0.95).fill({ color: CLOUD_DEEP, alpha: 0.38 })
  for (const b of billows)
    g.ellipse(b.x, b.y, b.rx, b.ry).fill({ color: CLOUD_MID, alpha: bodyAlpha })
  for (const b of billows)
    g.ellipse(b.x, b.y - b.ry * 0.30, b.rx * 0.74, b.ry * 0.58).fill({ color: CLOUD_LIGHT, alpha: 0.75 })
  for (const b of billows) {
    if (!b.crest) continue
    g.ellipse(b.x - b.rx * 0.14, b.y - b.ry * 0.48, b.rx * (0.26 + rand() * 0.24), b.ry * (0.20 + rand() * 0.18))
      .fill({ color: CLOUD_CREST, alpha: 0.85 })
  }
}

/**
 * The cloud floor: what you are standing on in a sky battle. Two scales of
 * billow over a base fill and a soft vertical light gradient, so the surface
 * reads as lumpy volume rather than a flat texture.
 */
export function drawCloudField(
  container: PIXI.Container,
  opts: { id?: string },
  w: number,
  h: number,
  tileScale: number = 1,
): void {
  const rand = seededRand(hashStr((opts.id ?? '') + 'cloudfield'))
  const g = new PIXI.Graphics()

  g.rect(0, 0, w, h).fill({ color: CLOUD_SHADOW })

  // Light falls from the top of the lane: bands of the mid tone, strongest at
  // the top, fading out toward the bottom.
  const BANDS = 12
  for (let i = 0; i < BANDS; i++) {
    const t = i / (BANDS - 1)
    g.rect(0, (i * h) / BANDS, w, h / BANDS + 1)
      .fill({ color: CLOUD_MID, alpha: 0.10 + 0.42 * (1 - t) })
  }

  // Big masses first, then a sparser pass of small puffs riding on them — full
  // density at both scales just buries the large shapes under uniform texture.
  const S = Math.max(0.5, tileScale)
  paintBillows(g, planBillows(rand, w, h, 96 * S), rand, 0.85)
  paintBillows(g, planBillows(rand, w, h, 40 * S, 0.6), rand, 0.7)

  container.addChild(g)
}

interface Lobe { x: number; y: number; r: number }

/**
 * A hole's outline, as overlapping discs: a core, plus a ring of lobes that
 * each reach a slightly different distance out.
 *
 * The footprint is the disc game/engine/terrainGrid.ts blocks — centre tile and
 * radius in tiles, both straight from planSkyHoles — so what a player walks
 * around is what they see. Drawing that footprint as a single circle looks
 * stamped rather than torn, which is what the ring is for: every lobe's reach
 * (`edge`) is a fraction of the radius, never the whole of it, so the outline
 * wanders without the opening ever growing past the ground it blocks.
 *
 * Overlapping obstacles contribute their lobes to the same list and merge into
 * one opening for free.
 */
function planLobes(holes: SkyHole[], T: number, rand: () => number): Lobe[] {
  const out: Lobe[] = []
  for (const hole of holes) {
    const cx = (hole.tcx + 0.5) * T
    const cy = (hole.tcy + 0.5) * T
    const r  = (hole.tileRadius + 0.5) * T
    out.push({ x: cx, y: cy, r: r * 0.7 })
    const count = 5 + Math.floor(rand() * 3)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.6
      const edge  = r * (0.80 + rand() * 0.20)
      const lobeR = r * (0.38 + rand() * 0.16)
      const dist  = edge - lobeR
      out.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, r: lobeR })
    }
  }
  return out
}

/**
 * One Graphics holding the hole silhouette, grown by `grow` pixels (negative
 * insets), filled flat.
 *
 * Silhouettes are always opaque. The lobes overlap, and pixi applies alpha per
 * shape — whether it comes from the fill or from Graphics.alpha — so any
 * translucent silhouette draws its own seams as a visible scribble of circles
 * inside the hole. Depth here comes from stacking opaque layers, not from
 * fading them: see drawCloudHoles.
 */
function silhouette(lobes: Lobe[], grow: number, color: number): PIXI.Graphics {
  const g = new PIXI.Graphics()
  for (const lobe of lobes) {
    const r = lobe.r + grow
    if (r > 0) g.circle(lobe.x, lobe.y, r)
  }
  g.fill({ color })
  return g
}

/**
 * The miniature landscape glimpsed through the holes — drawn across the WHOLE
 * canvas and then masked to the holes, so every hole in a battle is a window
 * onto one continuous world rather than each getting its own private vignette.
 * That shared, parallax-free ground is what sells the height.
 */
function drawFarBelow(rand: () => number, w: number, h: number, tileScale: number): PIXI.Graphics {
  const g = new PIXI.Graphics()
  const S = Math.max(0.5, tileScale)

  g.rect(0, 0, w, h).fill({ color: LAND_BASE })

  // Patchwork fields on a jittered grid. The scale is the whole trick: small
  // enough that a single hole frames several of them, which is what the eye
  // reads as distance.
  const cell = 13 * S
  for (let y = -cell; y < h + cell; y += cell) {
    for (let x = -cell; x < w + cell; x += cell) {
      g.rect(
        x + (rand() - 0.5) * cell * 0.9,
        y + (rand() - 0.5) * cell * 0.9,
        cell * (0.5 + rand() * 0.9),
        cell * (0.45 + rand() * 0.8),
      ).fill({ color: LAND_FIELDS[Math.floor(rand() * LAND_FIELDS.length)], alpha: 0.25 + rand() * 0.35 })
    }
  }

  // Hill ridges and woodland clumps, breaking up the field grid.
  for (let i = 0; i < 14; i++) {
    g.ellipse(rand() * w, rand() * h, 16 * S * (0.5 + rand()), 7 * S * (0.5 + rand()))
      .fill({ color: LAND_HILL, alpha: 0.6 })
  }
  for (let i = 0; i < 90; i++) {
    g.circle(rand() * w, rand() * h, S * (1.5 + rand() * 2.5)).fill({ color: LAND_FOREST, alpha: 0.55 })
  }

  // A river wandering the length of the map, wide enough to catch the eye
  // through a hole but never straight enough to read as a drawn line.
  let y = h * (0.15 + rand() * 0.3)
  g.moveTo(-20, y)
  for (let x = 0; x <= w + 20; x += w / 4) {
    const ny = y + (rand() - 0.45) * h * 0.28
    g.quadraticCurveTo(x - w / 8, y + (rand() - 0.5) * h * 0.2, x, ny)
    y = ny
  }
  g.stroke({ color: LAND_RIVER, width: 5 * S, alpha: 0.75, cap: 'round' })

  // Aerial perspective, last and over everything: ground this far down is seen
  // through the whole depth of the sky, which washes it blue and flattens its
  // contrast. Without this the patchwork reads as a green lake sitting just
  // under the clouds rather than countryside a very long way below.
  g.rect(0, 0, w, h).fill({ color: LAND_DISTANCE, alpha: 0.5 })

  return g
}

/**
 * Terrain obstacles on a cloud surface: holes torn clean through the floor,
 * with the world visible a very long way below.
 *
 * The lip is built from concentric filled silhouettes (largest first) rather
 * than a stroke: the silhouette is a pile of overlapping discs, and stroking it
 * would outline every one of them — drawing the interior seams as loudly as the
 * edge. Stacking flat fills and letting the smaller ones cover the larger leaves
 * exactly the outer ring visible. The same trick makes the inner shadow: the
 * landscape is masked a few pixels short of the opening, so the void shows
 * through as a dark ring — the thickness of the cloud you are looking through.
 */
export function drawCloudHoles(
  container: PIXI.Container,
  holes: SkyHole[],
  opts: { id?: string },
  w: number,
  h: number,
  tileScale: number = 1,
): void {
  if (holes.length === 0) return
  const T = TILE_SIZE * tileScale
  const S = Math.max(0.5, tileScale)
  const rand = seededRand(hashStr((opts.id ?? '') + 'skyholes'))
  const lobes = planLobes(holes, T, rand)

  // Raised cloud lip: a bright outer ring with a shaded one under it.
  const lipOuter = silhouette(lobes, 5 * S, CLOUD_CREST)
  const lipInner = silhouette(lobes, 2 * S, HOLE_LIP_SHADE)
  // The drop itself.
  const gap = silhouette(lobes, 0, HOLE_VOID)

  // Landscape, masked well short of the opening so the void rings it — that
  // ring is the thickness of the cloud layer you are looking down through.
  // Its faintness is painted into it (see drawFarBelow's aerial wash) rather
  // than applied as alpha here, which would seam.
  const land = drawFarBelow(rand, w, h, tileScale)
  const landMask = silhouette(lobes, -6 * S, CLOUD_CREST)
  land.mask = landMask

  container.addChild(lipOuter, lipInner, gap, landMask, land)
}
