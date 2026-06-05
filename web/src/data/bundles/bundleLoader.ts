import rawBundles from './bundles.json'
import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'

export type BundleTileType = 'decor' | 'window' | 'door'

export interface BundleTileEntry {
  type:        BundleTileType
  tileId:      number          // resolved at load time; 0 for door entries
  x:           number
  y:           number
  zlayer?:     string
  buildingId?: string          // for type="door" entries
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
    buildingId: t['buildingId'] as string | undefined,
  }))
  BUNDLE_REGISTRY.set(id, { bundleID: id, tiles })
}

export function getBundleById(id: string): BundleDef | undefined {
  return BUNDLE_REGISTRY.get(id)
}

/** Expand decor tiles from a bundle at the given bottom-left origin. */
export function expandBundleDecor(
  bundleID: string,
  originTx: number,
  originTy: number,
): { tx: number; ty: number; tileId: number; zlayer?: string }[] {
  const bundle = BUNDLE_REGISTRY.get(bundleID)
  if (!bundle) { console.warn(`[bundles] Unknown bundleID: "${bundleID}"`); return [] }
  return bundle.tiles
    .filter(t => t.type === 'decor')
    .map(t => ({ tx: originTx + t.x, ty: originTy - t.y, tileId: t.tileId, zlayer: t.zlayer }))
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
): { buildingId: string; tx: number; ty: number }[] {
  const bundle = BUNDLE_REGISTRY.get(bundleID)
  if (!bundle) { console.warn(`[bundles] Unknown bundleID: "${bundleID}"`); return [] }
  return bundle.tiles
    .filter(t => t.type === 'door')
    .map(t => ({ buildingId: t.buildingId ?? defaultBuildingId, tx: originTx + t.x, ty: originTy - t.y }))
}
