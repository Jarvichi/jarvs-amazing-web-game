// ─── One-off migration: shared upgrade-track decor → per-building levelDecor ──
//
// Historically, exterior upgrade decor was placed programmatically by a shared,
// per-kind track (buildingUpgrades.json → decor dx/dy offsets from the door).
// That generic placement was unreliable, so we now author decor per building in
// config.json (`levelDecor`, absolute tx/ty, minLevel).
//
// This script preserves each town's current look: for every upgradeable building
// without existing levelDecor, it resolves the building's door tile (exactly as
// the live loader does) and writes out the track decor at absolute positions.
//
// Run once from web/:  npx tsx scripts/migrateUpgradeDecor.ts
// Afterwards, delete the `decor` field from buildingUpgrades.json.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHubLocationData } from '../src/data/hub/loader'
import { getUpgradeTrack } from '../src/data/hub/buildingUpgrades'
import type { RawConfig } from '../src/data/hub/config'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HUB_DIR = join(__dirname, '..', 'src', 'data', 'hub')

interface LevelDecorItem { tx: number; ty: number; tileId: string; minLevel: number }

let totalBuildings = 0
let totalItems = 0

for (const town of readdirSync(HUB_DIR, { withFileTypes: true })) {
  if (!town.isDirectory()) continue
  const configPath = join(HUB_DIR, town.name, 'config.json')
  if (!existsSync(configPath)) continue

  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as RawConfig & {
    buildings: Array<Record<string, unknown> & { id?: string; upgradeKind?: string; rect?: number[]; rects?: number[][]; levelDecor?: unknown[] }>
  }

  let bundle
  try {
    bundle = createHubLocationData(raw as RawConfig)
  } catch (e) {
    console.warn(`[skip] ${town.name}: failed to load (${String(e)})`)
    continue
  }

  let townItems = 0
  for (const b of raw.buildings ?? []) {
    if (!b.id || !b.upgradeKind) continue
    if (Array.isArray(b.levelDecor) && b.levelDecor.length) continue   // already authored

    const track = getUpgradeTrack(b.upgradeKind)
    if (!track.length || !track.some(l => (l.decor ?? []).length)) continue

    // Resolve the door tile the same way the live renderer did.
    const door = bundle.HUB_DOORS.find(d => d.buildingId === b.id)
    const rect = (b.rects?.[0] ?? b.rect) as number[] | undefined
    if (!door && !rect) continue
    const anchor = door ?? { tx: Math.floor(((rect![0]) + (rect![2])) / 2), ty: rect![3] + 1 }

    const levelDecor: LevelDecorItem[] = []
    track.forEach((lvl, levelIndex) => {
      for (const d of lvl.decor ?? [])
        levelDecor.push({ tx: anchor.tx + d.dx, ty: anchor.ty + d.dy, tileId: d.tileId, minLevel: levelIndex + 1 })
    })
    if (!levelDecor.length) continue

    b.levelDecor = levelDecor
    townItems += levelDecor.length
    totalBuildings++
  }

  if (townItems > 0) {
    writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8')
    totalItems += townItems
    console.log(`[ok]   ${town.name}: +${townItems} levelDecor items`)
  } else {
    console.log(`[--]   ${town.name}: nothing to migrate`)
  }
}

console.log(`\nDone. ${totalItems} items across ${totalBuildings} buildings.`)
