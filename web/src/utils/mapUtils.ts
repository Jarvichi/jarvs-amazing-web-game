export function seededRand(seed: number) {
  let s = seed | 0
  return (): number => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s ^= (s >>> 16)
    return (s >>> 0) / 0xffffffff
  }
}

export function hashStr(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export interface TerrainItem { x: number; y: number; scale: number; kind: string }

export function getTerrainItems(env: string | undefined, seed: number, w: number, h: number): TerrainItem[] {
  const r = seededRand(seed)
  const rf = (lo: number, hi: number) => lo + r() * (hi - lo)
  const pad = 30
  const items: TerrainItem[] = []
  const scatter = (kind: string, count: number, minS: number, maxS: number) => {
    for (let i = 0; i < count; i++)
      items.push({ kind, x: rf(pad, w - pad), y: rf(pad, h - pad), scale: rf(minS, maxS) })
  }
  switch (env) {
    case 'forest':   scatter('tree', 14, 0.8, 1.5); scatter('mountain', 4, 0.5, 0.9); scatter('river', 1, 1, 1); break
    case 'citadel':  scatter('tower', 10, 0.8, 1.4); scatter('mountain', 5, 0.5, 1.0); break
    case 'ruins':    scatter('pillar', 9, 0.8, 1.3); scatter('tree', 4, 0.5, 0.9); scatter('river', 1, 1, 1); break
    case 'ashen':    scatter('mountain', 10, 0.7, 1.4); scatter('deadtree', 6, 0.8, 1.3); break
    case 'farmland': scatter('tree', 8, 0.7, 1.1); scatter('mountain', 4, 0.4, 0.7); scatter('river', 1, 1, 1); break
    case 'frost':    scatter('crystal', 12, 0.8, 1.4); scatter('mountain', 6, 0.7, 1.2); scatter('river', 1, 1, 1); break
    case 'volcano':  scatter('mountain', 10, 0.8, 1.5); scatter('lava', 5, 0.7, 1.2); break
    case 'sand':     scatter('dune', 10, 0.7, 1.3); scatter('mountain', 4, 0.5, 0.9); break
    case 'reef':
    case 'coast':    scatter('wave', 10, 0.8, 1.4); scatter('mountain', 4, 0.5, 0.9); scatter('river', 1, 1, 1); break
    case 'sky':      scatter('cloud', 20, 0.7, 2.0); break
    case 'fungal':   scatter('mushroom', 12, 0.8, 1.5); scatter('deadtree', 4, 0.5, 0.9); scatter('river', 1, 1, 1); break
    case 'vault':
    case 'camp':     scatter('pillar', 8, 0.7, 1.2); scatter('mountain', 4, 0.5, 0.9); break
    default:         scatter('mountain', 10, 0.6, 1.2); scatter('tree', 4, 0.6, 1.0)
  }
  return items
}

export function envColors(env?: string): { trail: string; frontier: string } {
  switch (env) {
    case 'forest':   return { trail: 'rgba(80,140,60,0.6)',    frontier: 'rgba(100,220,80,0.9)'   }
    case 'citadel':
    case 'ruins':    return { trail: 'rgba(120,120,140,0.55)', frontier: 'rgba(180,180,210,0.9)'  }
    case 'ashen':    return { trail: 'rgba(160,80,40,0.55)',   frontier: 'rgba(240,120,60,0.9)'   }
    case 'farmland': return { trail: 'rgba(140,160,60,0.55)',  frontier: 'rgba(200,220,80,0.9)'   }
    case 'frost':    return { trail: 'rgba(80,160,200,0.55)',  frontier: 'rgba(120,220,255,0.9)'  }
    case 'volcano':  return { trail: 'rgba(200,80,20,0.6)',    frontier: 'rgba(255,120,30,0.95)'  }
    case 'sand':     return { trail: 'rgba(200,160,60,0.55)',  frontier: 'rgba(240,200,80,0.9)'   }
    case 'reef':
    case 'coast':    return { trail: 'rgba(40,140,180,0.55)',  frontier: 'rgba(60,200,240,0.9)'   }
    case 'sky':      return { trail: 'rgba(100,140,200,0.55)', frontier: 'rgba(140,190,255,0.9)'  }
    case 'fungal':   return { trail: 'rgba(120,60,160,0.55)',  frontier: 'rgba(180,80,240,0.9)'   }
    case 'vault':
    case 'camp':     return { trail: 'rgba(140,120,80,0.55)',  frontier: 'rgba(200,180,100,0.9)'  }
    default:         return { trail: 'rgba(120,120,120,0.45)', frontier: 'rgba(51,255,51,0.85)'   }
  }
}

export function parseRgba(s: string): { color: number; alpha: number } {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(s)
  if (!m) return { color: 0xffffff, alpha: 1 }
  return {
    color: (parseInt(m[1]) << 16) | (parseInt(m[2]) << 8) | parseInt(m[3]),
    alpha: m[4] ? parseFloat(m[4]) : 1,
  }
}

export function sampleBezier(
  x0: number, y0: number, cx1: number, cy1: number,
  cx2: number, cy2: number, x1: number, y1: number,
  n = 20,
): Array<{ x: number; y: number }> {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, mt = 1 - t
    return {
      x: mt**3*x0 + 3*mt**2*t*cx1 + 3*mt*t**2*cx2 + t**3*x1,
      y: mt**3*y0 + 3*mt**2*t*cy1 + 3*mt*t**2*cy2 + t**3*y1,
    }
  })
}

export function bezierBand(pts: Array<{ x: number; y: number }>, halfW: number): number[] {
  const left: number[] = [], right: Array<{ x: number; y: number }> = []
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)]
    const tx = next.x - prev.x, ty = next.y - prev.y
    const len = Math.sqrt(tx * tx + ty * ty) || 1
    const nx = -ty / len, ny = tx / len
    left.push(pts[i].x + nx * halfW, pts[i].y + ny * halfW)
    right.push({ x: pts[i].x - nx * halfW, y: pts[i].y - ny * halfW })
  }
  const rightFlat = right.reverse().flatMap(p => [p.x, p.y])
  return [...left, ...rightFlat]
}
