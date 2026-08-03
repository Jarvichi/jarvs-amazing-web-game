import { describe, it, expect } from 'vitest'
import { getCardCatalog, getAllCardTags } from './cards'
import {
  SYNERGY_GROUPS,
  getSynergyGroups,
  getComboLinks,
  getGroupMembers,
  buildDeckProfile,
  getDeckSynergy,
} from './synergies'

const catalog = getCardCatalog()
const byName  = new Map(catalog.map(c => [c.name, c]))

/**
 * A group matching a sixth of the catalogue is a category, not a combo hint.
 * Keep every group small enough that "shares a group with your deck" still
 * means something.
 */
const MAX_GROUP_MEMBERS = 70

describe('synergy group definitions', () => {
  it('has unique ids and at least five groups', () => {
    const ids = SYNERGY_GROUPS.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(SYNERGY_GROUPS.length).toBeGreaterThanOrEqual(5)
  })

  it('gives every group a label, icon and description', () => {
    for (const g of SYNERGY_GROUPS) {
      expect(g.label, g.id).toBeTruthy()
      expect(g.icon,  g.id).toBeTruthy()
      expect(g.desc,  g.id).toBeTruthy()
    }
  })

  it('keeps every group between 2 and MAX_GROUP_MEMBERS cards', () => {
    for (const g of SYNERGY_GROUPS) {
      const members = getGroupMembers(g.id)
      expect(members.length, `${g.id} has ${members.length} members`).toBeGreaterThanOrEqual(2)
      expect(members.length, `${g.id} has ${members.length} members`).toBeLessThanOrEqual(MAX_GROUP_MEMBERS)
    }
  })

  it('only names tags that exist on at least one card', () => {
    const known = new Set(catalog.flatMap(getAllCardTags))
    for (const g of SYNERGY_GROUPS) {
      for (const tag of g.tags) {
        expect(known.has(tag), `group '${g.id}' references unknown tag '${tag}'`).toBe(true)
      }
    }
  })

  it('only names explicit member cards that exist', () => {
    for (const g of SYNERGY_GROUPS) {
      for (const name of g.cards) {
        expect(byName.has(name), `group '${g.id}' references unknown card '${name}'`).toBe(true)
      }
    }
  })

  it('orders a card\'s groups most-specific first', () => {
    for (const card of catalog) {
      const groups = getSynergyGroups(card)
      const sizes  = groups.map(g => getGroupMembers(g.id).length)
      expect([...sizes].sort((a, b) => a - b)).toEqual(sizes)
    }
  })
})

describe('combo links', () => {
  it('only links to cards that exist in the catalogue', () => {
    for (const card of catalog) {
      for (const link of getComboLinks(card)) {
        expect(byName.has(link.partner), `${card.name} -> ${link.partner}`).toBe(true)
      }
    }
  })

  it('has no duplicate (kind, partner) pairs on a card', () => {
    for (const card of catalog) {
      const keys = getComboLinks(card).map(l => `${l.kind}:${l.partner}`)
      expect(new Set(keys).size, card.name).toBe(keys.length)
    }
  })

  it('pairs every spawns link with a spawned-by link on the other card', () => {
    for (const card of catalog) {
      for (const link of getComboLinks(card).filter(l => l.kind === 'spawns')) {
        const back = getComboLinks(byName.get(link.partner)!)
        expect(
          back.some(l => l.kind === 'spawned-by' && l.partner === card.name),
          `${link.partner} is missing the spawned-by link back to ${card.name}`,
        ).toBe(true)
      }
    }
  })

  it('finds the Goblin/Archer affinity in both the data and the links', () => {
    const goblin = byName.get('Goblin')!
    expect(goblin.unit?.affinity?.withName).toBe('Archer')
    const link = getComboLinks(goblin).find(l => l.kind === 'affinity')
    expect(link?.partner).toBe('Archer')
    expect(link?.detail).toContain('Battle Cry')
  })

  it('resolves spawner structures to the card they spawn', () => {
    const spawners = catalog.filter(c => c.unit?.structureEffect?.type === 'spawn')
    expect(spawners.length).toBeGreaterThan(100)
    const linked = spawners.filter(c => getComboLinks(c).some(l => l.kind === 'spawns'))
    // Not every spawned template is a playable card — those simply get no link.
    expect(linked.length).toBeGreaterThan(spawners.length * 0.9)
  })
})

describe('getDeckSynergy', () => {
  it('scores zero against an empty deck', () => {
    const deck = buildDeckProfile([])
    for (const name of ['Goblin', 'Archer', 'Farm']) {
      expect(getDeckSynergy(byName.get(name)!, deck).score).toBe(0)
    }
  })

  it('ranks a combo partner above a card that only shares a group', () => {
    const goblin = byName.get('Goblin')!
    const deck   = buildDeckProfile(['Archer'])

    const comboScore = getDeckSynergy(goblin, deck).score
    expect(getDeckSynergy(goblin, deck).combos.map(l => l.partner)).toContain('Archer')

    // A card sharing a group with Archer but with no direct link to it.
    const archerGroups = new Set(getSynergyGroups(byName.get('Archer')!).map(g => g.id))
    const groupOnly = catalog.find(c =>
      c.name !== 'Archer' &&
      getSynergyGroups(c).some(g => archerGroups.has(g.id)) &&
      !getComboLinks(c).some(l => l.partner === 'Archer'),
    )
    expect(groupOnly, 'expected a group-only card to compare against').toBeDefined()

    const groupScore = getDeckSynergy(groupOnly!, deck).score
    expect(groupScore).toBeGreaterThan(0)
    expect(comboScore).toBeGreaterThan(groupScore)
  })

  it('does not let a card in the deck score against itself', () => {
    const goblin = byName.get('Goblin')!
    const alone  = getDeckSynergy(goblin, buildDeckProfile(['Goblin']))
    expect(alone.score).toBe(0)

    // A second member of one of Goblin's groups makes that group count.
    const group = getSynergyGroups(goblin)[0]
    const other = getGroupMembers(group.id).find(n => n !== 'Goblin')!
    const paired = getDeckSynergy(goblin, buildDeckProfile(['Goblin', other]))
    expect(paired.groups.some(g => g.id === group.id)).toBe(true)
  })

  it('updates as cards are added to the deck', () => {
    const goblin = byName.get('Goblin')!
    const before = getDeckSynergy(goblin, buildDeckProfile(['Farm'])).score
    const after  = getDeckSynergy(goblin, buildDeckProfile(['Farm', 'Archer'])).score
    expect(after).toBeGreaterThan(before)
  })
})
