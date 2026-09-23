// ─── Retro platformer: canvas renderer ──────────────────────────────────────
//
// Draws at a fixed 320×180 internal resolution; the page scales the canvas up
// with nearest-neighbour filtering. All art is defined here as text — sprites
// are palette-indexed strings and the font is a 3×5 bitmap — so the game ships
// with no image assets at all. The palette, font and sprite helpers are shared
// with the other arcade games in ../arcade/gfx.ts.

import { TILE, type Enemy, type Player, type Theme, type World } from './physics'
import { PAL, drawSprite, drawText, hash, makeSprite, type Sprite } from '../arcade/gfx'

export { PAL, drawText }

export const VIEW_W = 320
export const VIEW_H = 180

// ── Sprites ─────────────────────────────────────────────────────────────────
const HEAD = [
  '............',
  '....3333....',
  '...3bbbb3...',
  '...333333333',
  '...4ff0f....',
  '...4ffff....',
  '....fff.....',
]

const PETE_ROWS = {
  stand: [...HEAD,
    '...88888....',
    '..8888888...',
    '..f88888f...',
    '..f88888f...',
    '...11111....',
    '...11111....',
    '...11.11....',
    '...11.11....',
    '..444.444...',
  ],
  run1: [...HEAD,
    '...88888....',
    '..8888888...',
    '..f888888f..',
    '...88888....',
    '...11111....',
    '..111.111...',
    '.111...11...',
    '.11.....11..',
    '444.....444.',
  ],
  run2: [...HEAD,
    '...88888....',
    '...888888...',
    '...f8888f...',
    '...88888....',
    '...11111....',
    '....111.....',
    '....111.....',
    '....11......',
    '...4444.....',
  ],
  jump: [...HEAD.slice(0, 6),
    '.f..fff..f..',
    '.f.88888.f..',
    '.f8888888f..',
    '...88888....',
    '...88888....',
    '...11111....',
    '..111.111...',
    '..11...11...',
    '.444...444..',
    '............',
  ],
}

const BLOB_TOP = [
  '................',
  '......2222......',
  '....22222222....',
  '...2222222222...',
  '..227722227722..',
  '..277022220772..',
  '.22770222207722.',
  '.22222222222222.',
  '.22222eeee22222.',
  '2222222222222222',
  '2222222222222222',
  '.22222222222222.',
]
const BLOB_ROWS = {
  walk1: [...BLOB_TOP, '.444......444...', '4444......4444..'],
  walk2: [...BLOB_TOP, '...444....444...', '..4444....4444..'],
  squash: [
    '..222222222222..',
    '.22770222207722.',
    '2222222222222222',
    '2222222222222222',
    '.44444....44444.',
  ],
}

interface Sprites {
  pete: Record<keyof typeof PETE_ROWS, Sprite>
  blob: Record<keyof typeof BLOB_ROWS, Sprite>
}

let sprites: Sprites | null = null
function getSprites(): Sprites {
  if (!sprites) {
    const map = <K extends string>(rows: Record<K, string[]>) =>
      Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, makeSprite(v as string[])])) as Record<K, Sprite>
    sprites = { pete: map(PETE_ROWS), blob: map(BLOB_ROWS) }
  }
  return sprites
}

// ── Themes ──────────────────────────────────────────────────────────────────
interface ThemeColours {
  sky: number[] // top-to-bottom bands
  ground: [top: number, highlight: number, body: number, speck: number]
  platform: [top: number, body: number]
}

const THEMES: Record<Theme, ThemeColours> = {
  hills: { sky: [12, 12, 12, 7], ground: [3, 11, 4, 2], platform: [15, 4] },
  cave: { sky: [0, 0, 1, 1], ground: [13, 14, 5, 1], platform: [6, 5] },
  sky: { sky: [1, 1, 2, 2], ground: [6, 7, 5, 13], platform: [7, 6] },
}

function drawBackground(ctx: CanvasRenderingContext2D, theme: Theme, camX: number, t: number) {
  const th = THEMES[theme]
  // Banded sky with a one-pixel checker dither between bands.
  const band = Math.ceil(VIEW_H / th.sky.length)
  th.sky.forEach((c, i) => {
    ctx.fillStyle = PAL[c]
    ctx.fillRect(0, i * band, VIEW_W, band)
    if (i > 0 && th.sky[i - 1] !== c) {
      ctx.fillStyle = PAL[th.sky[i - 1]]
      for (let x = 0; x < VIEW_W; x += 2) {
        ctx.fillRect(x, i * band, 1, 1)
        ctx.fillRect(x + 1, i * band + 2, 1, 1)
      }
    }
  })

  if (theme === 'hills') {
    ctx.fillStyle = PAL[7]
    for (let i = 0; i < 8; i++) {
      const x = ((i * 97 - camX * 0.15) % 420 + 420) % 420 - 50
      const y = 20 + hash(i) * 40
      ctx.fillRect(x, y, 30, 6)
      ctx.fillRect(x + 6, y - 4, 16, 4)
      ctx.fillRect(x + 4, y + 6, 24, 2)
    }
    silhouette(ctx, camX * 0.3, 120, 26, 0.021, PAL[3])
    silhouette(ctx, camX * 0.5, 140, 16, 0.037, PAL[11])
  } else if (theme === 'cave') {
    // Twinkling crystals and hanging stalactites.
    for (let i = 0; i < 40; i++) {
      const x = ((i * 53 - camX * 0.2) % 360 + 360) % 360 - 20
      const y = 40 + hash(i + 7) * 120
      ctx.fillStyle = PAL[(Math.floor(t * 3 + i) % 3 === 0) ? 14 : 13]
      ctx.fillRect(x, y, 1, 1)
    }
    ctx.fillStyle = PAL[5]
    for (let i = 0; i < 14; i++) {
      const x = ((i * 41 - camX * 0.4) % 360 + 360) % 360 - 20
      const len = 10 + hash(i) * 30
      for (let d = 0; d < len; d++) {
        const half = Math.max(0, Math.floor((len - d) / len * 5))
        ctx.fillRect(x - half, 30 + d, half * 2 + 1, 1)
      }
    }
  } else {
    for (let i = 0; i < 60; i++) {
      const x = ((i * 67 - camX * 0.05) % 340 + 340) % 340 - 10
      const y = hash(i + 3) * 150
      ctx.fillStyle = PAL[(Math.floor(t * 2 + i * 7) % 5 === 0) ? 10 : 7]
      ctx.fillRect(x, y, 1, 1)
    }
    // Moon
    ctx.fillStyle = PAL[15]
    ctx.beginPath()
    ctx.arc(250 - camX * 0.02, 40, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PAL[1]
    ctx.beginPath()
    ctx.arc(256 - camX * 0.02, 36, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PAL[13]
    for (let i = 0; i < 6; i++) {
      const x = ((i * 131 - camX * 0.35) % 460 + 460) % 460 - 70
      const y = 110 + hash(i + 11) * 50
      ctx.fillRect(x, y, 60, 8)
      ctx.fillRect(x + 10, y - 6, 34, 6)
    }
  }
}

function silhouette(ctx: CanvasRenderingContext2D, offset: number, base: number, amp: number, freq: number, colour: string) {
  ctx.fillStyle = colour
  for (let x = 0; x < VIEW_W; x += 2) {
    const wx = x + offset
    const h = Math.sin(wx * freq) * amp * 0.6 + Math.sin(wx * freq * 2.3 + 1) * amp * 0.4
    const top = Math.round(base - Math.abs(h))
    ctx.fillRect(x, top, 2, VIEW_H - top)
  }
}

// ── Tiles & pickups ─────────────────────────────────────────────────────────
function drawTile(ctx: CanvasRenderingContext2D, world: World, tx: number, ty: number, x: number, y: number) {
  const { level } = world
  const t = level.tiles[ty][tx]
  const th = THEMES[level.theme]
  if (t === '#') {
    const above = ty > 0 ? level.tiles[ty - 1][tx] : '.'
    ctx.fillStyle = PAL[th.ground[2]]
    ctx.fillRect(x, y, TILE, TILE)
    ctx.fillStyle = PAL[th.ground[3]]
    for (let i = 0; i < 3; i++) {
      const h = hash(tx * 31 + ty * 17 + i)
      ctx.fillRect(x + Math.floor(h * 14) + 1, y + Math.floor(hash(h * 99) * 12) + 3, 2, 1)
    }
    if (above !== '#' && above !== 'B') {
      ctx.fillStyle = PAL[th.ground[0]]
      ctx.fillRect(x, y, TILE, 5)
      ctx.fillStyle = PAL[th.ground[1]]
      ctx.fillRect(x, y, TILE, 1)
      ctx.fillStyle = PAL[th.ground[0]]
      for (let i = 0; i < TILE; i += 3) ctx.fillRect(x + i, y + 5, 2, (tx + i) % 2 + 1)
    }
  } else if (t === 'B') {
    ctx.fillStyle = PAL[9]
    ctx.fillRect(x, y, TILE, TILE)
    ctx.fillStyle = PAL[4]
    ctx.fillRect(x, y + 7, TILE, 1)
    ctx.fillRect(x, y + 15, TILE, 1)
    ctx.fillRect(x + 7, y, 1, 7)
    ctx.fillRect(x + 3, y + 8, 1, 7)
    ctx.fillRect(x + 11, y + 8, 1, 7)
    ctx.fillStyle = PAL[15]
    ctx.fillRect(x, y, TILE, 1)
  } else if (t === '=') {
    ctx.fillStyle = PAL[th.platform[1]]
    ctx.fillRect(x, y, TILE, 5)
    ctx.fillStyle = PAL[th.platform[0]]
    ctx.fillRect(x, y, TILE, 2)
    ctx.fillStyle = PAL[0]
    ctx.fillRect(x + 15, y + 2, 1, 3)
  } else if (t === '^') {
    for (let i = 0; i < 2; i++) {
      const sx = x + i * 8
      for (let r = 0; r < 8; r++) {
        const half = Math.floor(r / 2)
        ctx.fillStyle = PAL[r < 2 ? 7 : 6]
        ctx.fillRect(sx + 4 - half - 1, y + 8 + r, half * 2 + 2, 1)
      }
      ctx.fillStyle = PAL[5]
      ctx.fillRect(sx + 4, y + 11, 1, 5)
    }
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  // Spin by squashing the width through a 4-frame cycle.
  const w = [8, 6, 2, 6][Math.floor(t * 8) % 4]
  const cx = x + 8 - w / 2
  ctx.fillStyle = PAL[9]
  ctx.fillRect(cx, y + 3, w, 10)
  ctx.fillRect(cx + 1, y + 2, Math.max(0, w - 2), 12)
  ctx.fillStyle = PAL[10]
  ctx.fillRect(cx + 1, y + 4, Math.max(0, w - 2), 8)
  if (w > 2) {
    ctx.fillStyle = PAL[7]
    ctx.fillRect(cx + 2, y + 5, 1, 3)
  }
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, baseY: number, t: number) {
  const poleTop = baseY - TILE * 5
  ctx.fillStyle = PAL[6]
  ctx.fillRect(x + 7, poleTop, 2, baseY + TILE - poleTop)
  ctx.fillStyle = PAL[10]
  ctx.fillRect(x + 6, poleTop - 3, 4, 4)
  for (let col = 0; col < 14; col++) {
    const wave = Math.round(Math.sin(t * 6 - col * 0.6) * 1.5)
    for (let row = 0; row < 10; row++) {
      ctx.fillStyle = PAL[((Math.floor(col / 3) + Math.floor(row / 3)) % 2) ? 7 : 8]
      ctx.fillRect(x + 9 + col, poleTop + 2 + row + wave, 1, 1)
    }
  }
}

// ── Entities ────────────────────────────────────────────────────────────────
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, camX: number, camY: number, t: number) {
  const { pete } = getSprites()
  let frame = pete.stand
  if (!p.onGround) frame = pete.jump
  else if (Math.abs(p.vx) > 10) frame = Math.floor(t * 12) % 2 ? pete.run1 : pete.run2
  drawSprite(ctx, frame, p.x - 1 - camX, p.y - 2 - camY, p.facing < 0)
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, camX: number, camY: number, t: number) {
  const { blob } = getSprites()
  if (!e.alive) {
    if (e.squash > 0) drawSprite(ctx, blob.squash, e.x - 1 - camX, e.y + e.h - 5 - camY, false)
    return
  }
  const frame = Math.floor(t * 6) % 2 ? blob.walk1 : blob.walk2
  drawSprite(ctx, frame, e.x - 1 - camX, e.y - 2 - camY, e.dir > 0)
}

// ── World ───────────────────────────────────────────────────────────────────
export interface Camera { x: number; y: number }

export function updateCamera(cam: Camera, world: World): void {
  const { player: p, level } = world
  const maxX = level.w * TILE - VIEW_W
  const maxY = level.h * TILE - VIEW_H
  const targetX = p.x + p.w / 2 - VIEW_W / 2 + p.facing * 24
  cam.x += (targetX - cam.x) * 0.12
  cam.x = Math.max(0, Math.min(maxX, cam.x))
  cam.y = Math.max(0, Math.min(maxY, p.y - VIEW_H / 2 + 20))
}

export function drawWorld(ctx: CanvasRenderingContext2D, world: World, cam: Camera, t: number, showPlayer = true) {
  const camX = Math.round(cam.x)
  const camY = Math.round(cam.y)
  const { level } = world
  drawBackground(ctx, level.theme, camX, t)

  const tx0 = Math.max(0, Math.floor(camX / TILE))
  const tx1 = Math.min(level.w - 1, Math.floor((camX + VIEW_W) / TILE))
  const ty0 = Math.max(0, Math.floor(camY / TILE))
  const ty1 = Math.min(level.h - 1, Math.floor((camY + VIEW_H) / TILE))

  if (level.flagX + 32 >= camX && level.flagX <= camX + VIEW_W) {
    drawFlag(ctx, level.flagX - camX, level.flagY - camY, t)
  }

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      drawTile(ctx, world, tx, ty, tx * TILE - camX, ty * TILE - camY)
      if (world.coins.has(ty * level.w + tx)) drawCoin(ctx, tx * TILE - camX, ty * TILE - camY, t + tx * 0.05)
    }
  }

  for (const e of world.enemies) {
    if (e.x + 16 < camX || e.x > camX + VIEW_W) continue
    drawEnemy(ctx, e, camX, camY, t)
  }
  if (showPlayer) drawPlayer(ctx, world.player, camX, camY, t)
}

export function drawHud(
  ctx: CanvasRenderingContext2D, world: World, lives: number, levelNum: number,
) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, VIEW_W, 11)
  drawText(ctx, `SCORE ${String(world.score).padStart(6, '0')}`, 4, 3, PAL[7])
  drawCoinIcon(ctx, 92, 2)
  drawText(ctx, `x${String(world.coinCount).padStart(2, '0')}`, 100, 3, PAL[10])
  drawText(ctx, `WORLD 1-${levelNum}`, VIEW_W / 2 + 10, 3, PAL[7], 1, 'center')
  drawText(ctx, `TIME ${String(Math.floor(world.time)).padStart(3, '0')}`, 238, 3, PAL[7])
  drawHeart(ctx, 290, 2)
  drawText(ctx, `x${lives}`, 299, 3, PAL[8])
}

function drawCoinIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = PAL[9]
  ctx.fillRect(x + 1, y, 3, 7)
  ctx.fillRect(x, y + 1, 5, 5)
  ctx.fillStyle = PAL[10]
  ctx.fillRect(x + 1, y + 1, 3, 5)
}

export function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = PAL[8]
  ctx.fillRect(x, y + 1, 7, 3)
  ctx.fillRect(x + 1, y, 2, 1)
  ctx.fillRect(x + 4, y, 2, 1)
  ctx.fillRect(x + 1, y + 4, 5, 1)
  ctx.fillRect(x + 2, y + 5, 3, 1)
  ctx.fillRect(x + 3, y + 6, 1, 1)
}

/** The hero at 3× for the title screen. */
export function drawTitleHero(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const { pete, blob } = getSprites()
  const frame = Math.floor(t * 8) % 2 ? pete.run1 : pete.run2
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(frame, x, y, frame.width * 3, frame.height * 3)
  const b = Math.floor(t * 6) % 2 ? blob.walk1 : blob.walk2
  ctx.drawImage(b, x + 60, y + 6, b.width * 3, b.height * 3)
  ctx.restore()
}
