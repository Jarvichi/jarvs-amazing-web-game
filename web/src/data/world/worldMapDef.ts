import type { WorldMap, QuestNode } from '../../game/questline'
import rawWorldMap from './worldMap.json'

export const WORLD_MAP: WorldMap = rawWorldMap as unknown as WorldMap

// Convenience array for components that iterate nodes
export const WORLD_MAP_NODES: QuestNode[] = Object.values(WORLD_MAP.nodes)

// WorldNodeType is still used by the type system in a few places
export type WorldNodeType = 'town' | 'castle' | 'battle' | 'camp' | 'cave' | 'port'

// WorldNodeDef is now an alias for QuestNode — kept for any remaining usages
export type WorldNodeDef = QuestNode
