import rawBundles from './battlefieldBundles.json'
import { WORLD_DECOR } from '../tiles/worldTileIndex'
import { isSelfSave } from '../../utils/hotReloadGuard'

// Same full-reload issue as bundleLoader.ts — saving writes straight onto
// battlefieldBundles.json, which is also statically imported here.
if (import.meta.hot) {
  import.meta.hot.accept('./battlefieldBundles.json', () => {
    if (!isSelfSave()) {
      console.warn('[battlefield bundle editor] battlefieldBundles.json changed on disk outside this tab. Refresh to pick it up — unsaved changes here were left alone.')
    }
  })
}

export interface BattlefieldBundleTile {
  tileId: number
  /** Tile-grid offset from the bundle's placement origin (not game units — see
   *  BattlefieldEditorCanvas, which resolves these against the origin's own
   *  snapped tile so multi-tile objects stay pixel-adjacent regardless of the
   *  current (letterboxed, window-size-dependent) canvas resolution. */
  dtx: number
  dty: number
}

export interface BattlefieldBundleDef {
  bundleId: string
  label: string
  tiles: BattlefieldBundleTile[]
}

function resolveTileId(key: string): number {
  return (WORLD_DECOR as Record<string, number>)[key] ?? WORLD_DECOR.singleTree
}

const BUNDLE_REGISTRY = new Map<string, BattlefieldBundleDef>()

for (const raw of rawBundles as Array<{ bundleId: string; label: string; tiles: Array<{ tileKey: string; dtx: number; dty: number }> }>) {
  BUNDLE_REGISTRY.set(raw.bundleId, {
    bundleId: raw.bundleId,
    label:    raw.label,
    tiles:    raw.tiles.map(t => ({ tileId: resolveTileId(t.tileKey), dtx: t.dtx, dty: t.dty })),
  })
}

export function getBattlefieldBundleById(id: string): BattlefieldBundleDef | undefined {
  return BUNDLE_REGISTRY.get(id)
}

export function getAllBattlefieldBundles(): BattlefieldBundleDef[] {
  return Array.from(BUNDLE_REGISTRY.values())
}
