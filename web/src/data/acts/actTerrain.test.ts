import { describe, it, expect } from 'vitest'
import { generateTerrain, expandTerrainPathsToObstacles } from '../../game/engine/terrain'
import { checkAllProfilesReachable } from '../../game/engine/terrainGrid'
import type { Act, QuestNode } from '../../game/questline'

// Every act/node that opts into hard tile-based terrain blocking
// (terrainValidated: true) must keep its lane traversable — see
// game/engine/units.ts's terrainValidated branch and the battlefield
// editor's "validate on save" step (BattlefieldEditorToolbar.tsx), which
// this test mirrors offline so a bad edit to tree/rock/water lines fails
// CI instead of silently sealing a battle's lane.

const actModules = import.meta.glob<{ default: Act }>('./*.json', { eager: true })

interface ValidatedTarget {
  actId: string
  nodeId: string
  node: QuestNode
  act: Act
}

const validatedTargets: ValidatedTarget[] = []
for (const [path, mod] of Object.entries(actModules)) {
  const act = mod.default
  if (!act?.nodes) continue
  const actId = path.replace(/^\.\//, '').replace(/\.json$/, '')
  for (const [nodeId, node] of Object.entries(act.nodes)) {
    const terrainValidated = node.terrainValidated ?? act.terrainValidated ?? false
    if (terrainValidated) validatedTargets.push({ actId, nodeId, node, act })
  }
}

describe('act terrain reachability', () => {
  it('found at least one terrainValidated node to check', () => {
    expect(validatedTargets.length).toBeGreaterThan(0)
  })

  it.each(validatedTargets)('$actId/$nodeId keeps the lane reachable for ground and burrowing units', ({ node, act }) => {
    const environment = node.environment ?? act.environment
    const authoredTerrain = node.terrain ?? act.terrain
    const terrainPaths = node.terrainPaths ?? act.terrainPaths
    const roads = node.roads ?? act.roads ?? []

    const terrain = [
      ...(authoredTerrain ?? generateTerrain(node.id, environment)),
      ...expandTerrainPathsToObstacles(terrainPaths ?? []),
    ]

    const report = checkAllProfilesReachable(terrain, roads)
    expect(report.ground.reachable).toBe(true)
    expect(report.burrowing.reachable).toBe(true)
  })
})
