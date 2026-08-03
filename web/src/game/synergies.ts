// ─── Card Synergies ───────────────────────────────────────────────────────────
//
// Two tiers of "these cards work together", both resolved from data that
// already exists:
//
//  1. Synergy groups — curated themes from data/synergies.json, matched against
//     a card's tags (theme tags in cards.json plus the unit's combat tags).
//     Broad signal: "these belong in the same deck".
//
//  2. Combo links — precise, per-card pairings derived from the card data:
//       • affinity   — unit.affinity names an ally that grants a proximity buff
//                      (resolved every tick by processAffinities in engine/units.ts)
//       • spawns     — a structure whose spawned unit is itself a playable card
//       • spawned-by — the reverse of the above
//     Narrow signal, and mechanically real, so it outranks group matches.

import { Card } from './types'
import { getCardCatalog, getAllCardTags } from './cards'
import synergyData from '../data/synergies.json'

export interface SynergyGroup {
  id: string
  label: string
  /** Emoji shown on card tiles — icon only at tile size, label in the tooltip. */
  icon: string
  /** One sentence on why these cards want to be in a deck together. */
  desc: string
  /** Card tags that put a card in this group. */
  tags: string[]
  /** Explicit member names, for cards whose tags don't place them. */
  cards: string[]
}

export type ComboKind = 'affinity' | 'spawns' | 'spawned-by'

export interface ComboLink {
  kind: ComboKind
  /** Name of the other card in the pairing. */
  partner: string
  /** Plain-English explanation, e.g. "Spawns a Goblin every 9s". */
  detail: string
}

export interface DeckSynergy {
  /** Groups this card shares with at least one card already in the deck. */
  groups: SynergyGroup[]
  /** Combo partners that are actually in the deck. */
  combos: ComboLink[]
  /** Ranking weight — combos count for more than a shared theme. */
  score: number
}

/** A combo partner in the deck is worth this many shared-group matches. */
const COMBO_WEIGHT = 3

export const SYNERGY_GROUPS: SynergyGroup[] = (synergyData.groups as SynergyGroup[])

// ─── Indexes ──────────────────────────────────────────────────────────────────
//
// Built once, lazily, on first use — 960 cards is enough work that we don't want
// it running at module-import time in every test file that touches this module.

interface SynergyIndex {
  groupsByCard: Map<string, SynergyGroup[]>
  combosByCard: Map<string, ComboLink[]>
  /** Card names per group id — used by the group-size test and the detail modal. */
  membersByGroup: Map<string, string[]>
}

let _index: SynergyIndex | null = null

function pushLink(map: Map<string, ComboLink[]>, cardName: string, link: ComboLink): void {
  const existing = map.get(cardName)
  if (!existing) {
    map.set(cardName, [link])
    return
  }
  // A structure can spawn a unit it also has an affinity with — keep one link per
  // (kind, partner) pair so the badge count doesn't double up.
  if (existing.some(l => l.kind === link.kind && l.partner === link.partner)) return
  existing.push(link)
}

function buildIndex(): SynergyIndex {
  const catalog      = getCardCatalog()
  const cardNames    = new Set(catalog.map(c => c.name))
  const groupsByCard = new Map<string, SynergyGroup[]>()
  const combosByCard = new Map<string, ComboLink[]>()
  const membersByGroup = new Map<string, string[]>(SYNERGY_GROUPS.map(g => [g.id, []]))

  for (const card of catalog) {
    // ── Tier 1: groups ──
    const tags = new Set(getAllCardTags(card))
    const groups = SYNERGY_GROUPS.filter(g =>
      g.tags.some(t => tags.has(t)) || g.cards.includes(card.name)
    )
    if (groups.length > 0) {
      groupsByCard.set(card.name, groups)
      for (const g of groups) membersByGroup.get(g.id)!.push(card.name)
    }

    // ── Tier 2: combo links ──
    const unit = card.unit
    if (!unit) continue

    const affinity = unit.affinity
    // Only surface an affinity whose partner is a card the player can actually run.
    if (affinity && cardNames.has(affinity.withName)) {
      pushLink(combosByCard, card.name, {
        kind: 'affinity',
        partner: affinity.withName,
        detail: `Near a ${affinity.withName}: ${affinityEffectText(affinity.effectType, affinity.effectAmount)} — "${affinity.label}"`,
      })
    }

    const fx = unit.structureEffect
    // A spawner whose unit has no card of its own (4 of them) simply has no link.
    if (fx?.type === 'spawn' && fx.unitTemplate && cardNames.has(fx.unitTemplate.name)) {
      const spawned  = fx.unitTemplate.name
      const everySec = fx.intervalMs > 0 ? ` every ${Math.round(fx.intervalMs / 1000)}s` : ''
      pushLink(combosByCard, card.name, {
        kind: 'spawns',
        partner: spawned,
        detail: `Spawns a ${spawned}${everySec} — free bodies without spending a card.`,
      })
      pushLink(combosByCard, spawned, {
        kind: 'spawned-by',
        partner: card.name,
        detail: `${card.name} keeps producing these${everySec}, so buffs aimed at them keep paying out.`,
      })
    }
  }

  return { groupsByCard, combosByCard, membersByGroup }
}

function index(): SynergyIndex {
  if (!_index) _index = buildIndex()
  return _index
}

/** Human-readable form of an affinity's buff — mirrors the wording in CardDetailModal. */
function affinityEffectText(effectType: string, effectAmount: number): string {
  const pct = Math.round(Math.abs(effectAmount - 1) * 100)
  const dir = effectAmount >= 1 ? '+' : '−'
  switch (effectType) {
    case 'attackSpeed': return `${dir}${pct}% attack speed`
    case 'damage':      return `${dir}${pct}% damage`
    case 'moveSpeed':   return `${dir}${pct}% move speed`
    default:            return `${dir}${pct}%`
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Synergy groups this card belongs to, most specific (smallest group) first. */
export function getSynergyGroups(card: Card): SynergyGroup[] {
  const { groupsByCard, membersByGroup } = index()
  const groups = groupsByCard.get(card.name) ?? []
  return [...groups].sort(
    (a, b) => (membersByGroup.get(a.id)?.length ?? 0) - (membersByGroup.get(b.id)?.length ?? 0)
  )
}

/** Named cards this card has a direct mechanical pairing with. */
export function getComboLinks(card: Card): ComboLink[] {
  return index().combosByCard.get(card.name) ?? []
}

/** Card names in a synergy group. */
export function getGroupMembers(groupId: string): string[] {
  return index().membersByGroup.get(groupId) ?? []
}

/**
 * A deck reduced to what synergy scoring needs. Build this once per deck change
 * and reuse it across every card being scored — the deck builder scores the
 * whole 960-card browser on each add/remove.
 */
export interface DeckProfile {
  names: Set<string>
  /** How many deck cards belong to each group id. */
  groupCounts: Map<string, number>
}

export function buildDeckProfile(deckNames: Iterable<string>): DeckProfile {
  const { groupsByCard } = index()
  const names       = new Set(deckNames)
  const groupCounts = new Map<string, number>()
  for (const name of names) {
    for (const g of groupsByCard.get(name) ?? []) {
      groupCounts.set(g.id, (groupCounts.get(g.id) ?? 0) + 1)
    }
  }
  return { names, groupCounts }
}

/**
 * How well this card pairs with a deck. A card already in the deck never scores
 * against itself: it needs a second deck member of the group to count.
 */
export function getDeckSynergy(card: Card, deck: DeckProfile): DeckSynergy {
  const inDeck = deck.names.has(card.name)

  const combos = getComboLinks(card).filter(l => deck.names.has(l.partner))

  const groups = (index().groupsByCard.get(card.name) ?? []).filter(g => {
    const count = deck.groupCounts.get(g.id) ?? 0
    return count >= (inDeck ? 2 : 1)
  })

  return { groups, combos, score: combos.length * COMBO_WEIGHT + groups.length }
}
