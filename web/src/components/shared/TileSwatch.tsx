import { resolveTileRef } from '../../data/tiles/tileIndex'

const SHEET_URL = '/world/SampleMap/[Base]BaseChip_pipo.png'
const SHEET_COLS = 8

/** Renders a single tile (by its resolved numeric id) as a small CSS swatch —
 *  used by the map editor's tile pickers and the player-facing room-style
 *  picker so both draw from one rendering path. */
export function TileSwatch({ tileNumericId, size = 20 }: { tileNumericId: number | undefined; size?: number }) {
  if (tileNumericId === undefined) return null
  if (tileNumericId >= 10000) {
    let ref: ReturnType<typeof resolveTileRef> | undefined
    try { ref = resolveTileRef(tileNumericId) } catch { /* unknown extended tile */ }
    if (!ref) return null
    const col = ref.id % ref.columns
    const row = Math.floor(ref.id / ref.columns)
    return (
      <div style={{
        width: size, height: size, flexShrink: 0, imageRendering: 'pixelated',
        backgroundImage: `url("${ref.file}")`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: ref.columns === 1 ? `${size}px ${size}px` : `${ref.columns * size}px auto`,
        backgroundPosition: ref.columns === 1 ? '0 0' : `-${col * size}px -${row * size}px`,
      }} />
    )
  }
  const col = tileNumericId % SHEET_COLS
  const row = Math.floor(tileNumericId / SHEET_COLS)
  return (
    <div style={{
      width: size, height: size, flexShrink: 0, imageRendering: 'pixelated',
      backgroundImage: `url("${SHEET_URL}")`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${SHEET_COLS * size}px auto`,
      backgroundPosition: `-${col * size}px -${row * size}px`,
    }} />
  )
}
