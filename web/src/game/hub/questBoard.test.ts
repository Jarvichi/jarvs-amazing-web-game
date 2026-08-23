import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HubQuestDef } from '../../data/hub/questDefs'
import type { LocationEntry } from '../../data/hub/hubWorldFactory'
import {
  buildNpcHomeIndex, buildActiveQuestViews, buildCompletedQuestViews,
  isQuestReady, rewardSummary,
} from './questBoard'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

function seedQuests(states: Record<string, { status: string; progress?: Record<string, number> }>): void {
  const store: Record<string, unknown> = {}
  for (const [id, s] of Object.entries(states)) {
    store[id] = { status: s.status, progress: s.progress ?? {} }
  }
  localStorage.setItem('jarv_hub_quests', JSON.stringify(store))
}

/** Minimal stand-ins — only the fields questBoard reads. */
function town(name: string, npcs: { id: string; name: string }[]): LocationEntry {
  return {
    locationData: { HUB_TOWN_NAME: name, HUB_NPCS: npcs, HUB_ANIMALS: [] },
    locationQuests: {},
    questDefs: [],
  } as unknown as LocationEntry
}

const REGISTRY = {
  ravenwatch: town('Ravenwatch', [
    { id: 'merchant', name: 'Vex the Merchant' },
    { id: 'scholar',  name: 'Loremaster Caelen' },
  ]),
  saltmere: town('Saltmere Port', [
    { id: 'harbourmaster-vane', name: 'Harbourmaster Vane' },
  ]),
}

const HOMES = buildNpcHomeIndex(REGISTRY)
const HERE = new Set(['merchant', 'scholar'])

const localQuest: HubQuestDef = {
  id: 'q-local', type: 'fetch', title: 'The Ingredient',
  giverNpcId: 'merchant', receiverNpcId: 'merchant',
  offerDialogue: 'o', activeDialogue: { herb: 'Look near the wall.' }, completeDialogue: 'c',
  reward: { crystals: 60 },
  steps: [{ key: 'herb', type: 'collect', required: 3, itemName: 'Moonleaf Herb' }],
}

const crossTownQuest: HubQuestDef = {
  id: 'q-away', type: 'chain', title: 'The Anthology',
  giverNpcId: 'scholar', receiverNpcId: 'harbourmaster-vane',
  offerDialogue: 'o', activeDialogue: { deliver: 'Vane keeps an office above the quay.' }, completeDialogue: 'c',
  reward: { crystals: 90 },
  steps: [{ key: 'deliver', type: 'deliver', required: 1, targetNpcId: 'harbourmaster-vane' }],
}

const ALL = [localQuest, crossTownQuest]
const opts = { npcHomes: HOMES, presentNpcIds: HERE, currentTownName: 'Ravenwatch' }

describe('buildNpcHomeIndex', () => {
  it('maps every named NPC to their name and home town', () => {
    expect(HOMES.get('merchant')).toEqual({ name: 'Vex the Merchant', townName: 'Ravenwatch' })
    expect(HOMES.get('harbourmaster-vane')).toEqual({ name: 'Harbourmaster Vane', townName: 'Saltmere Port' })
  })

  it('ignores unnamed ambient NPCs', () => {
    const index = buildNpcHomeIndex({ t: town('T', [{ id: 'villager-3', name: '  ' }]) })
    expect(index.size).toBe(0)
  })
})

describe('buildActiveQuestViews', () => {
  beforeEach(installLocalStorageStub)

  it('lists a quest accepted in another town, and says where to take it', () => {
    seedQuests({ 'q-away': { status: 'active' } })
    const [view] = buildActiveQuestViews(ALL, opts)

    expect(view.id).toBe('q-away')
    expect(view.target).toEqual({
      npcId: 'harbourmaster-vane',
      name: 'Harbourmaster Vane',
      townName: 'Saltmere Port',
      here: false,
    })
  })

  it('marks a target standing in the current town as here', () => {
    seedQuests({ 'q-local': { status: 'active', progress: { herb: 3 } } })
    const [view] = buildActiveQuestViews(ALL, opts)

    expect(view.ready).toBe(true)
    expect(view.target?.here).toBe(true)
    expect(view.target?.townName).toBe('Ravenwatch')
  })

  it('sorts ready-to-hand-in above in-progress', () => {
    seedQuests({
      'q-local': { status: 'active', progress: { herb: 1 } },
      'q-away':  { status: 'active', progress: { deliver: 1 } },
    })
    expect(buildActiveQuestViews(ALL, opts).map(v => v.id)).toEqual(['q-away', 'q-local'])
  })

  it('reports partial progress across every objective', () => {
    seedQuests({ 'q-local': { status: 'active', progress: { herb: 2 } } })
    const [view] = buildActiveQuestViews(ALL, opts)

    expect(view.ready).toBe(false)
    expect(view.current).toBe(2)
    expect(view.required).toBe(3)
    expect(view.objectives[0].label).toBe('Collect Moonleaf Herb')
    expect(view.hint).toBe('Look near the wall.')
  })

  it('does not count progress beyond what a step requires', () => {
    seedQuests({ 'q-local': { status: 'active', progress: { herb: 99 } } })
    const [view] = buildActiveQuestViews(ALL, opts)
    expect(view.current).toBe(3)
  })

  it('excludes quests that are available or already finished', () => {
    seedQuests({ 'q-local': { status: 'completed' } })
    expect(buildActiveQuestViews(ALL, opts)).toEqual([])
  })

  it('labels a deliver step with the target NPC, not the step key', () => {
    seedQuests({ 'q-away': { status: 'active' } })
    const [view] = buildActiveQuestViews(ALL, opts)
    expect(view.objectives[0].label).toBe('Deliver to Harbourmaster Vane')
  })
})

describe('buildCompletedQuestViews', () => {
  beforeEach(installLocalStorageStub)

  it('returns only completed quests', () => {
    seedQuests({ 'q-local': { status: 'completed' }, 'q-away': { status: 'active' } })
    expect(buildCompletedQuestViews(ALL).map(q => q.id)).toEqual(['q-local'])
  })
})

describe('isQuestReady', () => {
  beforeEach(installLocalStorageStub)

  it('is false until every step is satisfied', () => {
    seedQuests({ 'q-local': { status: 'active', progress: { herb: 2 } } })
    expect(isQuestReady(localQuest)).toBe(false)
    seedQuests({ 'q-local': { status: 'active', progress: { herb: 3 } } })
    expect(isQuestReady(localQuest)).toBe(true)
  })
})

describe('rewardSummary', () => {
  it('joins crystals and a collectible', () => {
    expect(rewardSummary({ crystals: 40 })).toBe('+40 💎')
    expect(rewardSummary({ crystals: 40, collectible: { icon: '🌿', name: 'Charm' } as never }))
      .toBe('+40 💎  ·  🌿 Charm')
  })

  it('is empty when a quest pays nothing visible', () => {
    expect(rewardSummary({})).toBe('')
  })
})
