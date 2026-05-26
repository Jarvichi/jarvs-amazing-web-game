import * as PIXI from 'pixi.js'

/**
 * Draws a single terrain item shape onto `g` centred at (0, 0).
 * The caller is responsible for positioning `g` and setting `zIndex`.
 *
 * @param pillarVariant  0–17 integer used to vary pillar height; callers
 *   should derive this from a hash of the item's position/index.
 */
export function drawTerrainItem(
  g: PIXI.Graphics,
  kind: string,
  scale: number,
  environment: string | undefined,
  pillarVariant = 0,
): void {
  switch (kind) {
    case 'mountain': {
      const w = scale * 44, h = scale * 32
      const col = environment === 'frost' ? 0x8ab8cc : environment === 'volcano' ? 0x6a3020 : environment === 'sand' ? 0xa08040 : 0x5a6050
      g.ellipse(w * 0.5, 3, w * 0.5, 5).fill({ color: 0x000000, alpha: 0.30 })
      g.poly([0,0, w*0.45,-h, w,0]).fill({ color: col, alpha: 0.82 })
      g.poly([w*0.3,0, w*0.72,-h*0.75, w*1.1,0]).fill({ color: col, alpha: 0.82 })
      g.poly([w*0.45,-h, w*0.15,-h*0.4, w*0.45,-h*0.05]).fill({ color: 0xffffff, alpha: 0.12 })
      if (environment === 'frost')
        g.poly([w*0.2,-h*0.55, w*0.45,-h, w*0.7,-h*0.55]).fill({ color: 0xffffff, alpha: 0.50 })
      break
    }
    case 'tree': {
      const h = scale * 28, tw = scale * 14
      const col = environment === 'farmland' ? 0x4a7a28 : environment === 'ruins' ? 0x3a6028 : 0x2a7020
      g.ellipse(0, 2, tw * 0.8, 4).fill({ color: 0x000000, alpha: 0.28 })
      g.rect(-scale*2, -scale*8, scale*4, scale*9).fill({ color: 0x6b4226, alpha: 0.85 })
      g.poly([0,-h, -tw,-scale*6, tw,-scale*6]).fill({ color: col, alpha: 0.82 })
      g.poly([0,-h*0.62, -tw*1.1,-scale*2, tw*1.1,-scale*2]).fill({ color: col, alpha: 0.82 })
      g.poly([0,-h, -tw,-scale*6, tw,-scale*6]).stroke({ color: 0x1a4012, width: 1, alpha: 0.50 })
      g.poly([0,-h*0.62, -tw*1.1,-scale*2, tw*1.1,-scale*2]).stroke({ color: 0x1a4012, width: 1, alpha: 0.50 })
      break
    }
    case 'deadtree': {
      const h = scale * 28
      g.ellipse(0, 2, scale * 5, 3).fill({ color: 0x000000, alpha: 0.25 })
      g.moveTo(0,0).lineTo(0,-h).stroke({ color: 0x5a4030, width: scale*3, alpha: 0.82, cap: 'round' })
      g.moveTo(0,-h*0.6).lineTo(-scale*12,-h*0.85).stroke({ color: 0x5a4030, width: scale*2, alpha: 0.82, cap: 'round' })
      g.moveTo(0,-h*0.5).lineTo(scale*10,-h*0.72).stroke({ color: 0x5a4030, width: scale*1.5, alpha: 0.82, cap: 'round' })
      break
    }
    case 'crystal': {
      const h = scale * 26
      g.ellipse(0, 3, scale * 7, 4).fill({ color: 0x000000, alpha: 0.25 })
      g.poly([0,-h, -scale*5,0, scale*5,0]).fill({ color: 0x88ddff, alpha: 0.85 })
      g.poly([0,-h*0.7, -scale*7,h*0.3, scale*7,h*0.3]).fill({ color: 0xaaeeff, alpha: 0.85 })
      g.moveTo(0,-h).lineTo(0,h*0.3).stroke({ color: 0xffffff, width: scale*1.5, alpha: 0.55 })
      break
    }
    case 'mushroom': {
      const h = scale * 22, rw = scale * 12
      g.ellipse(0, 3, rw * 0.7, 4).fill({ color: 0x000000, alpha: 0.25 })
      g.rect(-scale*2.5,-h, scale*5, h).fill({ color: 0x8a7060, alpha: 0.80 })
      g.ellipse(0,-h, rw, scale*8).fill({ color: 0x9a40ee, alpha: 0.82 })
      g.ellipse(-scale*3,-h-scale*2, scale*4, scale*3).fill({ color: 0xffffff, alpha: 0.35 })
      break
    }
    case 'lava': {
      g.ellipse(0, 2, scale * 22, 6).fill({ color: 0x000000, alpha: 0.28 })
      g.ellipse(0,0, scale*20, scale*10).fill({ color: 0xcc3300, alpha: 0.82 })
      g.ellipse(0,0, scale*12, scale*6).fill({ color: 0xff6600, alpha: 0.82 })
      g.ellipse(scale*4,-scale*2, scale*5, scale*3).fill({ color: 0xffaa00, alpha: 0.75 })
      break
    }
    case 'wave': {
      const ww = scale * 50
      g.moveTo(0,0).quadraticCurveTo(ww*0.25,-scale*9, ww*0.5,0).quadraticCurveTo(ww*0.75,scale*9, ww,0)
        .stroke({ color: 0x4499cc, width: scale*4, alpha: 0.78, cap: 'round' })
      g.moveTo(scale*5,scale*7).quadraticCurveTo(ww*0.3,-scale*5, ww*0.6,scale*7)
        .stroke({ color: 0x88ccee, width: scale*2.5, alpha: 0.65, cap: 'round' })
      g.moveTo(scale*2,scale*3).quadraticCurveTo(ww*0.25,-scale*4, ww*0.5,scale*3)
        .stroke({ color: 0xffffff, width: scale*1.5, alpha: 0.45, cap: 'round' })
      break
    }
    case 'cloud': {
      g.ellipse(0,0, scale*22, scale*13).fill({ color: 0xf0f8ff, alpha: 0.78 })
      g.ellipse(scale*14,scale*4, scale*18, scale*11).fill({ color: 0xe8f4ff, alpha: 0.78 })
      g.ellipse(-scale*12,scale*5, scale*16, scale*10).fill({ color: 0xf0f8ff, alpha: 0.78 })
      g.ellipse(scale*2,-scale*5, scale*14, scale*9).fill({ color: 0xffffff, alpha: 0.85 })
      break
    }
    case 'tower': {
      const h = scale * 30, tw = scale * 10
      g.ellipse(0, 3, tw * 0.7, 4).fill({ color: 0x000000, alpha: 0.28 })
      g.rect(-tw/2,-h, tw, h).fill({ color: 0x6a6a7a, alpha: 0.82 })
      g.rect(-tw/2,-h, tw, h).stroke({ color: 0x3a3a4a, width: 1, alpha: 0.60 })
      g.rect(-tw/2-scale*2,-h, tw+scale*4, scale*5).fill({ color: 0x8a8a9a, alpha: 0.82 })
      g.rect(-scale*2,-h-scale*6, scale*4, scale*6).fill({ color: 0x6a6a7a, alpha: 0.82 })
      g.rect(-tw/2-scale*2,-h-scale*6, tw+scale*4, scale*3).fill({ color: 0x7a7a8a, alpha: 0.82 })
      break
    }
    case 'pillar': {
      const h = scale * (16 + (pillarVariant % 18)), pw = scale * 7
      g.ellipse(0, 3, pw * 0.7, 4).fill({ color: 0x000000, alpha: 0.25 })
      g.rect(-pw/2,-h, pw, h).fill({ color: 0x888888, alpha: 0.80 })
      g.rect(-pw/2,-h, pw, h).stroke({ color: 0x444444, width: 1, alpha: 0.55 })
      g.rect(-pw/2-scale*2,-h, pw+scale*4, scale*4).fill({ color: 0xaaaaaa, alpha: 0.80 })
      g.rect(-pw/2-scale*2,-scale*4, pw+scale*4, scale*4).fill({ color: 0xaaaaaa, alpha: 0.80 })
      break
    }
    case 'dune': {
      const dw = scale * 55
      g.ellipse(0, 4, dw * 0.45, 6).fill({ color: 0x000000, alpha: 0.22 })
      g.ellipse(0,0, dw*0.5, scale*10).fill({ color: 0xc8a040, alpha: 0.80 })
      g.ellipse(dw*0.35,scale*4, dw*0.35, scale*8).fill({ color: 0xb89030, alpha: 0.80 })
      g.moveTo(-dw*0.3,-scale*7).quadraticCurveTo(0,-scale*11, dw*0.25,-scale*6)
        .stroke({ color: 0xffe090, width: scale*2, alpha: 0.50, cap: 'round' })
      break
    }
  }
}
