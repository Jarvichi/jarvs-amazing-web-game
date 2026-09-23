// ─── Arcade: shared pixel-art helpers ───────────────────────────────────────
//
// Used by the standalone arcade pages (/retro, /shmup): the 16-colour palette,
// a 3×5 bitmap font, and palette-indexed text sprites. Everything is drawn
// from code so the games ship with no image assets.

// A classic 16-colour palette. Sprite strings index into it with hex digits.
export const PAL = [
  '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa',
]

// ── Font ────────────────────────────────────────────────────────────────────
// Each glyph is five rows of three bits, written as five octal digits.
const GLYPHS: Record<string, string> = {
  '0': '75557', '1': '26227', '2': '71747', '3': '71317', '4': '55711',
  '5': '74717', '6': '74757', '7': '71122', '8': '75757', '9': '75717',
  A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644',
  G: '34553', H: '55755', I: '72227', J: '11152', K: '55655', L: '44447',
  M: '57755', N: '65555', O: '25552', P: '75744', Q: '25563', R: '65655',
  S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255',
  Y: '55222', Z: '71247', ' ': '00000', '-': '00700', ':': '02020',
  '!': '22202', '.': '00002', x: '05250', '/': '11244', '?': '71202', "'": '22000',
  '+': '02720', '<': '12421', '>': '42124', '%': '51245', ',': '00024',
}

export function textWidth(text: string, scale = 1): number {
  return text.length === 0 ? 0 : (text.length * 4 - 1) * scale
}

export function drawText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  color: string, scale = 1, align: 'left' | 'center' | 'right' = 'left', shadow = true,
): void {
  if (align === 'center') x -= Math.floor(textWidth(text, scale) / 2)
  else if (align === 'right') x -= textWidth(text, scale)
  const off = Math.max(1, Math.floor(scale / 2))
  if (shadow) drawGlyphs(ctx, text, x + off, y + off, PAL[0], scale)
  drawGlyphs(ctx, text, x, y, color, scale)
}

function drawGlyphs(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, s: number) {
  ctx.fillStyle = color
  for (let i = 0; i < text.length; i++) {
    const g = GLYPHS[text[i]] ?? GLYPHS[text[i].toUpperCase()] ?? GLYPHS['?']
    for (let row = 0; row < 5; row++) {
      const bits = parseInt(g[row], 8)
      for (let col = 0; col < 3; col++) {
        if (bits & (4 >> col)) ctx.fillRect(x + (i * 4 + col) * s, y + row * s, s, s)
      }
    }
  }
}

// ── Sprites ─────────────────────────────────────────────────────────────────
export type Sprite = HTMLCanvasElement

/** Build a sprite from rows of palette hex digits; '.' is transparent. */
export function makeSprite(rows: string[]): Sprite {
  const c = document.createElement('canvas')
  c.width = rows[0].length
  c.height = rows.length
  const ctx = c.getContext('2d')!
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue
      ctx.fillStyle = PAL[parseInt(row[x], 16)]
      ctx.fillRect(x, y, 1, 1)
    }
  })
  return c
}

export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, flip: boolean) {
  x = Math.round(x); y = Math.round(y)
  if (!flip) { ctx.drawImage(s, x, y); return }
  ctx.save()
  ctx.translate(x + s.width, y)
  ctx.scale(-1, 1)
  ctx.drawImage(s, 0, 0)
  ctx.restore()
}

// Cheap deterministic hash for scattering background details.
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}
