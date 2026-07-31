import rawBundles from './bundles.json'
import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'
import { HubDoor } from '../hub/loader'
import type { FlameColor, FlameType } from '../hub/config'
import { isSelfSave } from '../../utils/hotReloadGuard'

// Same full-reload issue as the map editor (see hotReloadGuard.ts): saving
// writes straight onto bundles.json, which is also statically imported here.
if (import.meta.hot) {
  import.meta.hot.accept('./bundles.json', () => {
    if (!isSelfSave()) {
      console.warn('[bundle editor] bundles.json changed on disk outside this tab. Refresh to pick it up — unsaved changes here were left alone.')
    }
  })
}

export type BundleTileType = 'decor' | 'window' | 'door'

export interface BundleTileEntry {
  type:        BundleTileType
  tileId:      number          // resolved at load time; 0 for door entries
  x:           number
  y:           number
  zlayer?:     string
  glow?:       boolean         // night light glow (decor entries)
  glowRadius?: number          // glow radius in tiles
  pulse?:      boolean         // animate the glow radius
  flame?:      boolean         // animated flame layer (decor entries)
  flameType?:  FlameType
  flameColor?: FlameColor
  buildingId?: string          // for type="door" entries
  hideSign?: boolean          // for type="door" entries
}

export interface BundleDef {
  bundleID: string
  tiles:    BundleTileEntry[]
}

function resolveTileId(key: string): number {
  return (BASE_CHIP_TILES as Record<string, number>)[key] ?? 666
}

const BUNDLE_REGISTRY = new Map<string, BundleDef>()

for (const raw of rawBundles as Array<Record<string, unknown>>) {
  const id = raw['bundleID'] as string | undefined
  if (!id || !Array.isArray(raw['tiles'])) {
    console.warn('[bundles] Skipping malformed bundle:', raw)
    continue
  }
  const tiles: BundleTileEntry[] = (raw['tiles'] as Array<Record<string, unknown>>).map(t => ({
    type:       (t['type'] as BundleTileType | undefined) ?? 'decor',
    tileId:     t['tileID'] ? resolveTileId(t['tileID'] as string) : 0,
    x:          (t['x'] as number) ?? 0,
    y:          (t['y'] as number) ?? 0,
    zlayer:     t['zlayer'] as string | undefined,
    glow:       t['glow'] as boolean | undefined,
    glowRadius: t['glowRadius'] as number | undefined,
    pulse:      t['pulse'] as boolean | undefined,
    flame:      t['flame'] as boolean | undefined,
    flameType:  t['flameType'] as FlameType | undefined,
    flameColor: t['flameColor'] as FlameColor | undefined,
    buildingId: t['buildingId'] as string | undefined,
    hideSign:   t['hideSign'] as boolean | undefined,
  }))
  BUNDLE_REGISTRY.set(id, { bundleID: id, tiles })
}

export function getBundleById(id: string): BundleDef | undefined {
  return BUNDLE_REGISTRY.get(id)
}

export function getAllBundles(): BundleDef[] {
  return Array.from(BUNDLE_REGISTRY.values())
}

/** Expand decor tiles from a bundle at the given bottom-left origin. */
export function expandBundleDecor(
  bundleID: string,
  originTx: number,
  originTy: number,
): { tx: number; ty: number; tileId: number; zlayer?: string; glow?: boolean; glowRadius?: number; pulse?: boolean; flame?: boolean; flameType?: FlameType; flameColor?: FlameColor }[] {
  const bundle = BUNDLE_REGISTRY.get(bundleID)
  if (!bundle) { console.warn(`[bundles] Unknown bundleID: "${bundleID}"`); return [] }
  return bundle.tiles
    .filter(t => t.type === 'decor')
    .map(t => ({ tx: originTx + t.x, ty: originTy - t.y, tileId: t.tileId, zlayer: t.zlayer, glow: t.glow, glowRadius: t.glowRadius, pulse: t.pulse, flame: t.flame, flameType: t.flameType, flameColor: t.flameColor }))
}

/** Expand window tiles from a bundle at the given bottom-left origin. */
export function expandBundleWindows(
  bundleID: string,
  originTx: number,
  originTy: number,
): { tx: number; ty: number; tileId: number }[] {
  const bundle = BUNDLE_REGISTRY.get(bundleID)
  if (!bundle) { console.warn(`[bundles] Unknown bundleID: "${bundleID}"`); return [] }
  return bundle.tiles
    .filter(t => t.type === 'window')
    .map(t => ({ tx: originTx + t.x, ty: originTy - t.y, tileId: t.tileId }))
}

/** Expand door entries from a bundle at the given bottom-left origin. */
export function expandBundleDoors(
  bundleID: string,
  defaultBuildingId: string,
  originTx: number,
  originTy: number,
):HubDoor[] {
  const bundle = BUNDLE_REGISTRY.get(bundleID)
  if (!bundle) { console.warn(`[bundles] Unknown bundleID: "${bundleID}"`); return [] }
  const doors = bundle.tiles
    .filter(t => t.type === 'door')
  return doors.map(t => ({ buildingId: t.buildingId ?? defaultBuildingId, tx: originTx + t.x, ty: originTy - t.y, hideSign: t.hideSign }))
}
