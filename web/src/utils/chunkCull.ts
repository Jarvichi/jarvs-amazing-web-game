import * as PIXI from 'pixi.js'

// ── Chunked culling for static world layers ───────────────────────────────────
// The hub map renders thousands of tile/decor sprites; with a viewport-sized
// camera (#1570) most are off-screen every frame, but Pixi still processes
// them. This groups a layer's children into grid-cell chunk containers and
// toggles chunk visibility against the camera view, so per-frame work scales
// with the viewport instead of the map.
//
// Constraints:
// - Only pass layers whose children do NOT move after being added (their
//   bounds are captured when a sweep adopts them into a chunk). Toggling
//   `visible`/`alpha`/textures on children is fine.
// - Children are assigned to a chunk by their (x, y), but culling tests the
//   chunk's exact bounds union, so oversized children (multi-tile buildings,
//   map-wide backgrounds) are never culled incorrectly — a map-wide child
//   simply makes its chunk permanently visible.
// - Children added asynchronously (texture loads) are adopted by the periodic
//   sweep; until then they sit at the layer level and render normally.

const DEFAULT_CHUNK_PX   = 512   // 16 tiles of 32px
const DEFAULT_RECHUNK_MS = 1000

interface Chunk {
  container: PIXI.Container
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface LayerState {
  layer: PIXI.Container
  chunks: Map<string, Chunk>
}

export interface ChunkCuller {
  /** Adopt any new layer children into chunks, then cull against the view
   *  (world-space rect). Call once per frame after the camera is positioned. */
  update(deltaMS: number, viewX: number, viewY: number, viewW: number, viewH: number): void
  /** Force an adoption sweep now (also runs every rechunkMs via update). */
  rechunk(): void
  /** Visible/total chunk counts from the last update — for tests/telemetry. */
  stats(): { chunks: number; visibleChunks: number }
}

const CHUNK_FLAG = Symbol('hubChunk')

function isChunk(c: PIXI.Container): boolean {
  return CHUNK_FLAG in (c as unknown as Record<symbol, unknown>)
}

// Child bounds in layer space: local bounds mapped through position + scale
// (rotation is not used by hub scene content).
function childBox(c: PIXI.Container): { minX: number; minY: number; maxX: number; maxY: number } {
  const lb = c.getLocalBounds()
  const sx = c.scale.x, sy = c.scale.y
  const x0 = c.x + lb.x * sx, y0 = c.y + lb.y * sy
  const x1 = c.x + (lb.x + lb.width) * sx, y1 = c.y + (lb.y + lb.height) * sy
  return { minX: Math.min(x0, x1), minY: Math.min(y0, y1), maxX: Math.max(x0, x1), maxY: Math.max(y0, y1) }
}

export function createChunkCuller(
  layers: PIXI.Container[],
  opts?: { chunkPx?: number; rechunkMs?: number },
): ChunkCuller {
  const chunkPx   = opts?.chunkPx   ?? DEFAULT_CHUNK_PX
  const rechunkMs = opts?.rechunkMs ?? DEFAULT_RECHUNK_MS
  const states: LayerState[] = layers.map(layer => ({ layer, chunks: new Map() }))
  let sinceRechunk = Infinity  // first update() always sweeps
  let visibleChunks = 0

  function rechunk(): void {
    for (const st of states) {
      const pending = st.layer.children.filter(c => !isChunk(c))
      for (const child of pending) {
        const box = childBox(child)
        const key = `${Math.floor(child.x / chunkPx)},${Math.floor(child.y / chunkPx)}`
        let chunk = st.chunks.get(key)
        if (!chunk) {
          const container = new PIXI.Container()
          ;(container as unknown as Record<symbol, unknown>)[CHUNK_FLAG] = true
          st.layer.addChild(container)
          chunk = { container, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
          st.chunks.set(key, chunk)
        }
        chunk.container.addChild(child)  // re-parents; layer-space coords are unchanged
        chunk.minX = Math.min(chunk.minX, box.minX)
        chunk.minY = Math.min(chunk.minY, box.minY)
        chunk.maxX = Math.max(chunk.maxX, box.maxX)
        chunk.maxY = Math.max(chunk.maxY, box.maxY)
      }
    }
  }

  function cull(viewX: number, viewY: number, viewW: number, viewH: number): void {
    visibleChunks = 0
    for (const st of states) {
      for (const chunk of st.chunks.values()) {
        const visible =
          chunk.maxX >= viewX && chunk.minX <= viewX + viewW &&
          chunk.maxY >= viewY && chunk.minY <= viewY + viewH
        chunk.container.visible = visible
        if (visible) visibleChunks++
      }
    }
  }

  return {
    rechunk,
    update(deltaMS, viewX, viewY, viewW, viewH) {
      sinceRechunk += deltaMS
      if (sinceRechunk >= rechunkMs) {
        sinceRechunk = 0
        rechunk()
      }
      cull(viewX, viewY, viewW, viewH)
    },
    stats() {
      let chunks = 0
      for (const st of states) chunks += st.chunks.size
      return { chunks, visibleChunks }
    },
  }
}
