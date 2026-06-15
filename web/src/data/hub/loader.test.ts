import { describe, it, expect } from 'vitest'
import { createHubLocationData, createHubQuestData } from './loader'
import { RawConfig } from './config'
import { RawQuestConfig } from './questDefs'
import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'
import ravenwatchConfig from './ravenwatch/config.json'

function minimalConfig(extra: Partial<RawConfig>): RawConfig {
  return {
    mapW: 320,
    mapH: 320,
    avatarStart: { tx: 1, ty: 1 },
    areas: [],
    streets: [],
    buildings: [],
    exteriorDecor: [],
    interiors: {},
    npcs: [],
    npcSpawnTiles: [],
    ...extra,
  } as RawConfig
}

describe('interactables parsing', () => {
  it('returns [] when the key is absent', () => {
    const bundle = createHubLocationData(minimalConfig({}))
    expect(bundle.HUB_INTERACTABLES).toEqual([])
  })

  it('parses an owned-decor interactable: tile resolution and hitRect from decor bounds', () => {
    const bundle = createHubLocationData(minimalConfig({
      interactables: [{
        id: 'board',
        tx: 49, ty: 21,
        decor: [
          { dx: 0, dy: 0, tileId: 'messageBoardTopLeft' },
          { dx: 1, dy: 0, tileId: 'messageBoardTopRight' },
          { dx: 0, dy: 1, tileId: 'messageBoardBottomLeft' },
          { dx: 1, dy: 1, tileId: 'messageBoardBottomRight' },
        ],
        indicator: { condition: 'unread-news' },
        reactions: [{ type: 'screen', screen: 'news' }],
      }],
    }))
    expect(bundle.HUB_INTERACTABLES).toHaveLength(1)
    const i = bundle.HUB_INTERACTABLES[0]
    expect(i.id).toBe('board')
    expect(i.hitRect).toEqual({ w: 2, h: 2 })
    expect(i.decor?.[0].tileId).toBe(BASE_CHIP_TILES.messageBoardTopLeft)
    expect(i.decor?.map(d => d.tileId).every(t => t > 0)).toBe(true)
    expect(i.indicator).toEqual({ condition: 'unread-news', dx: 0, dy: 0 })
    expect(i.reactions).toEqual([{ type: 'screen', screen: 'news' }])
  })

  it('defaults hitRect to 1x1 when there is no decor, keeps explicit hitRect, passes building through', () => {
    const bundle = createHubLocationData(minimalConfig({
      interactables: [
        { id: 'plain', tx: 3, ty: 4, reactions: [{ type: 'dialogue', text: 'Hi' }] },
        { id: 'wide', tx: 5, ty: 6, building: 'inn-building', hitRect: { w: 3, h: 1 }, reactions: [] },
      ],
    }))
    expect(bundle.HUB_INTERACTABLES[0].hitRect).toEqual({ w: 1, h: 1 })
    expect(bundle.HUB_INTERACTABLES[0].building).toBeUndefined()
    expect(bundle.HUB_INTERACTABLES[1].hitRect).toEqual({ w: 3, h: 1 })
    expect(bundle.HUB_INTERACTABLES[1].building).toBe('inn-building')
  })
})

describe('animals parsing', () => {
  it('returns [] when the key is absent', () => {
    const bundle = createHubLocationData(minimalConfig({}))
    expect(bundle.HUB_ANIMALS).toEqual([])
  })

  it('passes placed animals through with all quest fields', () => {
    const bundle = createHubLocationData(minimalConfig({
      animals: [
        { id: 'rover', type: 'dog', variant: 'brown', tx: 10, ty: 12, name: 'Rover',
          dialogue: ['Woof!'], questGive: 'wheres-rover' },
        { id: 'smudge', type: 'cat', tx: 5, ty: 6, questReceive: ['feed-the-stray'], roam: true },
      ],
    }))
    expect(bundle.HUB_ANIMALS).toHaveLength(2)
    expect(bundle.HUB_ANIMALS[0]).toMatchObject({
      id: 'rover', type: 'dog', variant: 'brown', tx: 10, ty: 12, questGive: 'wheres-rover',
    })
    expect(bundle.HUB_ANIMALS[1].questReceive).toEqual(['feed-the-stray'])
    expect(bundle.HUB_ANIMALS[1].roam).toBe(true)
  })
})

describe('npc schedule activities', () => {
  it('passes the activity field through to HUB_NPCS', () => {
    const bundle = createHubLocationData(minimalConfig({
      npcs: [{
        id: 'baker', name: 'Baker', sprite: 'hub-npc-merchant', tx: 5, ty: 5, dialogue: ['Hi'],
        schedule: [
          { startHour: 6, endHour: 20, activity: 'work', location: { type: 'exterior', tx: 5, ty: 5 } },
          { startHour: 20, endHour: 6, location: { type: 'interior', buildingId: 'inn', tx: 1, ty: 1 } },
        ],
      }] as unknown as RawConfig['npcs'],
    }))
    const npc = bundle.HUB_NPCS.find(n => n.id === 'baker')
    expect(npc?.schedule?.[0].activity).toBe('work')
    expect(npc?.schedule?.[1].activity).toBeUndefined()
  })

  it('ravenwatch NPCs carry distinct scheduled activities', () => {
    const bundle = createHubLocationData(ravenwatchConfig as unknown as RawConfig)
    const acts = (id: string) =>
      bundle.HUB_NPCS.find(n => n.id === id)?.schedule?.map(e => e.activity)
    expect(acts('fisherman')).toContain('fish')
    expect(acts('merchant')).toContain('work')
    expect(acts('elder')).toContain('idle-chat')
  })
})

function minimalQuestConfig(extra: Record<string, unknown>): RawQuestConfig {
  return { quests: [], ...extra } as unknown as RawQuestConfig
}

describe('dialogue trees parsing', () => {
  it('returns {} when the dialogues key is absent', () => {
    const bundle = createHubQuestData(minimalQuestConfig({}))
    expect(bundle.HUB_DIALOGUES).toEqual({})
  })

  it('parses dialogue trees into a map keyed by id, preserving start + nodes', () => {
    const bundle = createHubQuestData(minimalQuestConfig({
      dialogues: [{
        id: 'elder-chat',
        npcId: 'elder',
        start: 'root',
        nodes: {
          root: {
            text: 'What brings you here?',
            choices: [
              { label: 'Lore', next: 'lore', effects: [{ type: 'friendship', xp: 5 }] },
              { label: 'Leave', effects: [{ type: 'end' }] },
            ],
          },
          lore: { text: 'A long story...', choices: [{ label: 'Bye', effects: [{ type: 'end' }] }] },
        },
      }],
    }))
    expect(Object.keys(bundle.HUB_DIALOGUES)).toEqual(['elder-chat'])
    const tree = bundle.HUB_DIALOGUES['elder-chat']
    expect(tree.start).toBe('root')
    expect(tree.nodes.root.choices?.[0].next).toBe('lore')
    expect(tree.nodes.root.choices?.[0].effects?.[0]).toEqual({ type: 'friendship', xp: 5 })
    expect(tree.nodes.lore.text).toBe('A long story...')
  })
})

describe('ravenwatch config', () => {
  it('contains the notice-board interactable with 4 resolved decor tiles', () => {
    const bundle = createHubLocationData(ravenwatchConfig as unknown as RawConfig)
    const board = bundle.HUB_INTERACTABLES.find(i => i.id === 'notice-board')
    expect(board).toBeDefined()
    expect(board!.decor).toHaveLength(4)
    expect(board!.decor!.every(d => d.tileId > 0)).toBe(true)
    expect(board!.hitRect).toEqual({ w: 2, h: 2 })
    expect(board!.indicator?.condition).toBe('unread-news')
    expect(board!.reactions).toEqual([{ type: 'screen', screen: 'news' }])
  })

  it('no longer renders the message board as plain exterior decor', () => {
    const bundle = createHubLocationData(ravenwatchConfig as unknown as RawConfig)
    const boardTiles = [
      BASE_CHIP_TILES.messageBoardTopLeft,
      BASE_CHIP_TILES.messageBoardTopRight,
      BASE_CHIP_TILES.messageBoardBottomLeft,
      BASE_CHIP_TILES.messageBoardBottomRight,
    ]
    expect(bundle.EXTERIOR_DECOR.some(d => boardTiles.includes(d.tileId))).toBe(false)
  })
})
