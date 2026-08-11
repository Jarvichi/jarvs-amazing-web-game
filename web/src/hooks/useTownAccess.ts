import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { fetchEnabledTownIds, isTownAccessible, loadPreviewAsPlayer } from '../game/townAccess'
import { WORLD_MAP, WORLD_MAP_NODES } from '../data/world/worldMapDef'

interface UseTownAccessResult {
  enabledTownIds:  Set<string>
  previewAsPlayer: boolean
  setPreviewAsPlayer: Dispatch<SetStateAction<boolean>>
  /** True when the admin's town-access bypass is in effect. */
  bypassTownAccess: boolean
  /** World-map node ids that should render fogged. */
  restrictedTownNodeIds: Set<string>
}

/**
 * Admin-controlled hub-world town access, and the derived set of fogged
 * world-map nodes.
 */
export function useTownAccess(isAdmin: boolean): UseTownAccessResult {
  // Admin-controlled hub-world town access — locked until fetched/enabled.
  const [enabledTownIds, setEnabledTownIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    // Re-fetch when connectivity returns: a player whose first attempt failed
    // would otherwise stay locked out of every toggleable town until reload.
    const load = () => { fetchEnabledTownIds().then(ids => setEnabledTownIds(new Set(ids))) }
    load()
    window.addEventListener('online', load)
    return () => window.removeEventListener('online', load)
  }, [])
  // "Preview as player" lets the admin see the fogged map as a regular
  // player would, by suppressing their own town-access bypass.
  const [previewAsPlayer, setPreviewAsPlayer] = useState<boolean>(loadPreviewAsPlayer)
  const bypassTownAccess = isAdmin && !previewAsPlayer
  // Fogged nodes: locations (towns/castles/camps/ports) the admin hasn't
  // enabled, plus any battle/waypoint node that isn't a requiredClears
  // prerequisite (directly, or transitively through an OR-alternative) for
  // reaching a currently-open town. Deliberately based on requiredClears —
  // the real gameplay gate — rather than `connections` (a road-drawing
  // convenience graph that mostly but doesn't always match it: e.g. Forest
  // Path/Bridge Battle gate Ironhold Keep, Thornwood Camp, and River
  // Crossing independently, not chained through Ironhold Keep, even though
  // `connections` draws them as one line). Using `connections` instead
  // could fog a battle a player still needs to satisfy a further-along,
  // already-enabled town's requiredClears — softlocking it.
  const restrictedTownNodeIds = useMemo(() => {
    const ids = new Set<string>()
    if (bypassTownAccess) return ids // admin bypass: nothing is fogged

    const nodesById = WORLD_MAP.nodes
    const openTownIds = WORLD_MAP_NODES
      .filter(n => n.locationKey && isTownAccessible(n.locationKey, enabledTownIds, false))
      .map(n => n.id)

    const neededIds = new Set<string>()
    const markNeeded = (id: string): void => {
      if (neededIds.has(id)) return
      neededIds.add(id)
      for (const group of nodesById[id]?.requiredClears ?? []) {
        for (const altId of group.split('|')) markNeeded(altId)
      }
    }
    openTownIds.forEach(markNeeded)

    for (const node of WORLD_MAP_NODES) {
      if (node.locationKey) {
        if (!isTownAccessible(node.locationKey, enabledTownIds, false)) ids.add(node.id)
      } else if (!neededIds.has(node.id)) {
        ids.add(node.id)
      }
    }
    return ids
  }, [enabledTownIds, bypassTownAccess])

  return { enabledTownIds, previewAsPlayer, setPreviewAsPlayer, bypassTownAccess, restrictedTownNodeIds }
}
