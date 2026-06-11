/**
 * Build Identity — derives a named "build theme" from the player's archetype +
 * equipped relic so the HUD can surface what the combination means.
 * Read-only: no game logic, just labelling existing run state.
 */

import type { Archetype } from './types'
import { ARCHETYPE_DEFS, RunState } from './questline'
import { getRelicDef, isExoticRelic } from './relics'

export interface BuildIdentity {
  archetypeName: string | null
  archetypeIcon: string | null
  relicName: string | null
  relicIcon: string | null
  relicIsExotic: boolean
  /** Short evocative label for the combination, e.g. "Structure Engine". */
  themeLabel: string
  /** One-line synergy note when the combination has a known interaction. */
  synergyNote: string | null
}

interface ThemeRule {
  archetype?: Archetype          // omit = any archetype
  relic?: string                 // omit = any relic
  label: string
  note?: string
}

/** First matching rule wins — most specific (archetype + relic) pairs first. */
const THEME_RULES: ThemeRule[] = [
  // Named archetype + exotic pairings
  { archetype: 'siege_commander', relic: "The Architect's Eye", label: 'Structure Engine',
    note: "Cheap structures that each draw a card — every wall is also a cantrip." },
  { archetype: 'siege_commander', relic: 'The Last Farm', label: 'Fortified Homestead',
    note: 'Discounted Farms that muster free Goblins — the economy fights back.' },
  { archetype: 'swarm_tactician', relic: 'Phantom Legion', label: 'Undying Swarm',
    note: 'A wide board that refuses to stay dead — every revive re-feeds the swarm ATK bonus.' },
  { archetype: 'swarm_tactician', relic: 'The Last Farm', label: 'Goblin Tide',
    note: 'Farms add free bodies that count toward your swarm discount and ATK stacks.' },
  { archetype: 'arcane_scholar', relic: 'Mana Surge', label: 'Tempo Scholar',
    note: 'Banked overflow mana turns every double-effect upgrade into a burst turn.' },
  { archetype: 'arcane_scholar', relic: 'Prism Lens', label: 'Deep Reservoir' },
  // Exotic-defined themes (any archetype)
  { relic: 'Glass Cannon Protocol', label: 'Glass Cannon',
    note: 'Ten base HP. Double-strength units. End it before they reach you.' },
  { relic: 'Phantom Legion', label: 'Ghost March' },
  { relic: 'Mana Surge', label: 'Stored Lightning' },
  { relic: "The Architect's Eye", label: 'Master Builder' },
  { relic: 'The Last Farm', label: 'Harvest War' },
  // Notable standard-relic synergies
  { archetype: 'siege_commander', relic: 'Bark Shield', label: 'Living Bastion' },
  { archetype: 'siege_commander', relic: 'Living Bark', label: 'Living Bastion' },
  { archetype: 'swarm_tactician', relic: 'Spore Bloom', label: 'Regenerating Horde' },
  { archetype: 'swarm_tactician', relic: 'Iron Standard', label: 'Sharpened Swarm' },
  { archetype: 'arcane_scholar', relic: 'Golden Compass', label: 'Opening Gambit' },
  // Archetype-only fallbacks
  { archetype: 'siege_commander', label: 'Siege Doctrine' },
  { archetype: 'swarm_tactician', label: 'Swarm Blitz' },
  { archetype: 'arcane_scholar', label: 'Late Game Control' },
]

/** Derives the player's current build identity from run state. Pure + cheap. */
export function deriveBuildIdentity(run: RunState): BuildIdentity {
  const archDef = run.archetype ? ARCHETYPE_DEFS.find(d => d.id === run.archetype) : undefined
  const relicDef = run.activeRelic ? getRelicDef(run.activeRelic) : undefined

  const rule = THEME_RULES.find(r =>
    (r.archetype === undefined || r.archetype === run.archetype) &&
    (r.relic === undefined || r.relic === run.activeRelic)
  )

  return {
    archetypeName: archDef?.name ?? null,
    archetypeIcon: archDef?.icon ?? null,
    relicName: relicDef?.name ?? null,
    relicIcon: relicDef?.icon ?? null,
    relicIsExotic: run.activeRelic ? isExoticRelic(run.activeRelic) : false,
    themeLabel: rule?.label ?? 'Free Agent',
    synergyNote: rule?.note ?? null,
  }
}
