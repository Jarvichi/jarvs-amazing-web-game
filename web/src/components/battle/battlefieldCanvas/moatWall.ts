import * as PIXI from 'pixi.js'

// ─── Moat graphic ────────────────────────────────────────────────────────────
// Port of Battlefield.tsx's MoatSvg — a full-width horizontal strip, one
// variant per moat unit name. The original SVG used viewBox="0 0 360 16" with
// preserveAspectRatio="none" (width stretches to the lane, height fixed at
// 16px) — every x-coordinate below is scaled by `sx = w / 360`; y-coordinates
// are used as-is (1:1, since the SVG height was never rescaled).

export const MOAT_H = 16
const MOAT_RIPPLE_XS = [20, 65, 110, 155, 200, 245, 290, 335]
const EDGE_ALPHA_COLOR = 0x000000

function edges(g: PIXI.Graphics, w: number) {
  g.rect(0, 0, w, 2).fill({ color: EDGE_ALPHA_COLOR, alpha: 0.55 })
  g.rect(0, MOAT_H - 2, w, 2).fill({ color: EDGE_ALPHA_COLOR, alpha: 0.55 })
}

function ripples(g: PIXI.Graphics, sx: number, color: number, alpha: number, width = 1) {
  for (const x of MOAT_RIPPLE_XS) {
    g.ellipse(x * sx, 8, 20 * sx, 3).stroke({ color, width, alpha })
  }
}

export function drawMoat(g: PIXI.Graphics, owner: 'player' | 'opponent', name: string, w: number): void {
  g.clear()
  const sx = w / 360

  if (name === 'Lava Moat') {
    g.rect(0, 0, w, MOAT_H).fill(0x6a1000)
    g.rect(0, 2, w, 12).fill({ color: 0xc83000, alpha: 0.7 })
    ripples(g, sx, 0xffb400, 0.45)
    for (const x of [40, 120, 200, 280]) g.ellipse(x * sx, 8, 8 * sx, 4).fill({ color: 0xff6a00, alpha: 0.5 })
  } else if (name === 'Acid Moat') {
    g.rect(0, 0, w, MOAT_H).fill(0x1a3a00)
    g.rect(0, 2, w, 12).fill({ color: 0x4aaa00, alpha: 0.6 })
    ripples(g, sx, 0x96ff32, 0.4, 0.9)
    for (const x of [55, 135, 215, 300]) g.circle(x * sx, 6, 3).fill({ color: 0xb4ff00, alpha: 0.5 })
  } else if (name === 'Spike Pit') {
    g.rect(0, 0, w, MOAT_H).fill(0x2a1a0a)
    g.rect(0, 10, w, 6).fill({ color: 0x3a2a18, alpha: 0.9 })
    for (const cx of [30, 75, 120, 165, 210, 255, 300, 345]) {
      const x = cx * sx
      g.poly([x, 2, x - 4 * sx, 14, x, 10, x + 4 * sx, 14]).fill(0x8a8a8a).stroke({ color: 0x4a4a4a, width: 0.5 })
    }
  } else if (name === 'Tar Pit') {
    g.rect(0, 0, w, MOAT_H).fill(0x0a0808)
    g.rect(0, 2, w, 12).fill({ color: 0x1a1212, alpha: 0.85 })
    ripples(g, sx, 0x503c28, 0.5, 0.8)
    for (const x of [90, 180, 270]) g.circle(x * sx, 7, 4).fill({ color: 0x1e140a, alpha: 0.8 }).stroke({ color: 0x3c2814, width: 0.5, alpha: 0.4 })
  } else if (name === 'Frost Moat') {
    g.rect(0, 0, w, MOAT_H).fill(0x0a2040)
    g.rect(0, 2, w, 12).fill({ color: 0x3080b0, alpha: 0.55 })
    g.rect(0, 0, w, 5).fill({ color: 0xc8e8ff, alpha: 0.3 })
    ripples(g, sx, 0xc8f0ff, 0.45)
    for (const cx of [50, 150, 250, 350]) {
      const x = cx * sx
      g.poly([x, 4, x - 3 * sx, 9, x, 7, x + 3 * sx, 9]).fill({ color: 0xc8f0ff, alpha: 0.55 })
    }
  } else if (name === 'Poison Bog') {
    g.rect(0, 0, w, MOAT_H).fill(0x0e200e)
    g.rect(0, 2, w, 12).fill({ color: 0x2a5020, alpha: 0.7 })
    ripples(g, sx, 0x64c832, 0.3, 0.8)
    for (const x of [45, 130, 210, 295]) g.ellipse(x * sx, 7, 6 * sx, 3).fill({ color: 0x3c9614, alpha: 0.45 })
    for (const x of [80, 185, 275]) g.circle(x * sx, 9, 2).fill({ color: 0xa0ff50, alpha: 0.35 })
  } else if (name === 'Lightning Rift') {
    g.rect(0, 0, w, MOAT_H).fill(0x0a0a30)
    g.rect(0, 2, w, 12).fill({ color: 0x1a1a60, alpha: 0.7 })
    for (const cx of [40, 120, 200, 280]) {
      const x = cx * sx
      g.moveTo(x, 2).lineTo(x - 5 * sx, 7).lineTo(x + 3 * sx, 7).lineTo(x - 3 * sx, 14)
        .stroke({ color: 0xb4c8ff, width: 1.2, alpha: 0.7 })
    }
    ripples(g, sx, 0x6478ff, 0.35, 0.8)
  } else if (name === 'Quicksand') {
    g.rect(0, 0, w, MOAT_H).fill(0xa08040)
    g.rect(0, 2, w, 12).fill({ color: 0xc8a850, alpha: 0.6 })
    ripples(g, sx, 0xc8a050, 0.4)
    for (const x of [60, 160, 260]) g.ellipse(x * sx, 9, 9 * sx, 4).fill({ color: 0x8c641e, alpha: 0.45 })
  } else if (name === 'Blood Pool') {
    g.rect(0, 0, w, MOAT_H).fill(0x3a0010)
    g.rect(0, 2, w, 12).fill({ color: 0x800020, alpha: 0.75 })
    ripples(g, sx, 0xc80028, 0.35, 0.8)
    for (const x of [70, 170, 270]) g.ellipse(x * sx, 8, 7 * sx, 3.5).fill({ color: 0xb4001e, alpha: 0.45 })
  } else if (name === 'Shadow Mire') {
    g.rect(0, 0, w, MOAT_H).fill(0x0a0018)
    g.rect(0, 2, w, 12).fill({ color: 0x280050, alpha: 0.7 })
    ripples(g, sx, 0xa050ff, 0.35, 0.9)
    for (const x of [50, 150, 250, 320]) g.circle(x * sx, 7, 3).fill({ color: 0x7800c8, alpha: 0.4 })
  } else {
    // Default water moat
    const deep = owner === 'player' ? 0x1a4a68 : 0x1a3050
    const mid = owner === 'player' ? 0x2a6888 : 0x243858
    g.rect(0, 0, w, MOAT_H).fill({ color: deep, alpha: 0.9 })
    g.rect(0, 2, w, 12).fill({ color: mid, alpha: 0.6 })
    ripples(g, sx, 0x78d2ff, 0.35)
  }
  edges(g, w)
}

// ─── Wall graphic ─────────────────────────────────────────────────────────────
// Port of Battlefield.tsx's WallSvg — full-width strip of staggered stone
// blocks, battlements, and progressive damage cracks. viewBox="0 0 360 30",
// same non-uniform scale-x-only convention as the moat strip.

export const WALL_H = 30

export function drawWall(
  g: PIXI.Graphics,
  hp: number, maxHp: number,
  owner: 'player' | 'opponent',
  wallNames: string[],
  w: number,
): void {
  g.clear()
  const sx = w / 360
  const dmgPct = 1 - hp / maxHp
  const [stone, hiStone, merlon] = owner === 'player'
    ? [0x606878, 0x70788a, 0x707888]
    : [0x7a5838, 0x8a6848, 0x906a40]
  const op = 1 - dmgPct * 0.4

  // Bottom stone row — 12 blocks
  for (let i = 0; i < 12; i++) {
    g.rect((i * 30 + 1) * sx, 17, 28 * sx, 12).fill({ color: stone, alpha: op }).stroke({ color: 0x18100a, width: 0.8, alpha: op })
  }
  // Upper row (staggered)
  for (let i = 0; i < 13; i++) {
    g.rect((i * 30 - 14) * sx, 8, 28 * sx, 10).fill({ color: hiStone, alpha: op }).stroke({ color: 0x18100a, width: 0.8, alpha: op })
  }
  // Battlements (merlons)
  for (let i = 0; i < 7; i++) {
    g.rect((i * 52 + 2) * sx, 1, 22 * sx, 9).fill({ color: merlon, alpha: op }).stroke({ color: 0x18100a, width: 0.8, alpha: op })
  }
  // Base shadow strip
  g.rect(0, 28, w, 2).fill({ color: 0x0a0500, alpha: 0.4 })

  const hasBone = wallNames.includes('Bone Wall')
  const hasThorn = wallNames.includes('Thornwall')

  if (hasBone) {
    const a = op * 0.88
    for (const cx of [45, 135, 225, 315]) {
      const x = cx * sx
      g.ellipse(x, 17, 4 * sx, 3.5).fill({ color: 0xd4c49a, alpha: a }).stroke({ color: 0x8a7a50, width: 0.5, alpha: a })
      g.circle(x - 1.5 * sx, 16.5, 1).fill({ color: 0x3a2a10, alpha: a })
      g.circle(x + 1.5 * sx, 16.5, 1).fill({ color: 0x3a2a10, alpha: a })
      g.roundRect(x - 3 * sx, 20.5, 6 * sx, 1.8, 0.8).fill({ color: 0xc8b480, alpha: a }).stroke({ color: 0x8a7a50, width: 0.4, alpha: a })
    }
    for (const cx of [75, 165, 255]) {
      const x = cx * sx
      g.moveTo(x - 7 * sx, 13).lineTo(x + 7 * sx, 13).stroke({ color: 0xd0c090, width: 2.5, alpha: a, cap: 'round' })
      g.circle(x - 7 * sx, 13, 2.2).fill({ color: 0xc8b480, alpha: a }).stroke({ color: 0x9a8a60, width: 0.5, alpha: a })
      g.circle(x + 7 * sx, 13, 2.2).fill({ color: 0xc8b480, alpha: a }).stroke({ color: 0x9a8a60, width: 0.5, alpha: a })
    }
  }

  if (hasThorn) {
    const a = op * 0.92
    g.moveTo(0, 13)
      .quadraticCurveTo(45 * sx, 7, 90 * sx, 12)
      .quadraticCurveTo(135 * sx, 17, 180 * sx, 10)
      .quadraticCurveTo(225 * sx, 5, 270 * sx, 11)
      .quadraticCurveTo(315 * sx, 16, w, 10)
      .stroke({ color: 0x3a6a1a, width: 2.5, alpha: a, cap: 'round' })
    for (const cx of [18, 52, 88, 122, 158, 192, 228, 262, 298, 332]) {
      const x = cx * sx
      g.moveTo(x, 11).lineTo(x - 3 * sx, 5).stroke({ color: 0x1e4008, width: 1.2, alpha: a, cap: 'round' })
      g.moveTo(x, 11).lineTo(x + 3 * sx, 4).stroke({ color: 0x1e4008, width: 1.2, alpha: a, cap: 'round' })
    }
    for (const cx of [35, 105, 180, 255, 325]) {
      const x = cx * sx
      g.ellipse(x, 9, 5 * sx, 2.8).fill({ color: 0x4a8a22, alpha: a }).stroke({ color: 0x2a5a10, width: 0.6, alpha: a })
    }
  }

  // Progressive damage cracks
  if (dmgPct > 0.25) g.moveTo(86 * sx, 8).lineTo(83 * sx, 29).stroke({ color: 0x050200, width: 1.5, alpha: 0.7 })
  if (dmgPct > 0.45) g.moveTo(200 * sx, 1).lineTo(197 * sx, 29).stroke({ color: 0x050200, width: 2, alpha: 0.8 })
  if (dmgPct > 0.65) {
    g.moveTo(145 * sx, 8).lineTo(148 * sx, 29).stroke({ color: 0x050200, width: 1.2, alpha: 0.7 })
    g.moveTo(290 * sx, 1).lineTo(286 * sx, 29).stroke({ color: 0x050200, width: 1.5, alpha: 0.8 })
  }
  // Crumbled battlements at heavy damage
  if (dmgPct > 0.5) g.rect(106 * sx, 1, 22 * sx, 9).fill({ color: 0x050200, alpha: 0.55 })
  if (dmgPct > 0.75) g.rect(264 * sx, 1, 22 * sx, 9).fill({ color: 0x050200, alpha: 0.7 })
}
