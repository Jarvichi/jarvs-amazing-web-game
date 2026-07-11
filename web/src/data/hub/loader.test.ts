import { describe, it, expect } from 'vitest'
import { createHubLocationData, createHubQuestData } from './loader'
import { RawConfig, RawTileRectCoord } from './config'
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
    expect(i.decor?.every(d => (d.tileId ?? 0) > 0)).toBe(true)
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

  it('passes shopArtSlot decor through without resolving a tileId', () => {
    const bundle = createHubLocationData(minimalConfig({
      interactables: [{
        id: 'card-shop-item-0', tx: 12, ty: 4, building: 'card-shop',
        decor: [{ dx: 0, dy: 0, shopArtSlot: 0 }],
        reactions: [{ type: 'buy', slotIndex: 0 }],
      }],
    }))
    const decor = bundle.HUB_INTERACTABLES[0].decor?.[0]
    expect(decor?.shopArtSlot).toBe(0)
    expect(decor?.tileId).toBeUndefined()
  })

  it('passes spriteId decor through without resolving a tileId', () => {
    const bundle = createHubLocationData(minimalConfig({
      interactables: [{
        id: 'card-shop-pack', tx: 12, ty: 7, building: 'card-shop',
        decor: [{ dx: 0, dy: 0, spriteId: 'hub-item-cards' }],
        reactions: [{ type: 'buyPack' }],
      }],
    }))
    const decor = bundle.HUB_INTERACTABLES[0].decor?.[0]
    expect(decor?.spriteId).toBe('hub-item-cards')
    expect(decor?.tileId).toBeUndefined()
  })

  it('passes a buyPack reaction through unchanged', () => {
    const bundle = createHubLocationData(minimalConfig({
      interactables: [{
        id: 'card-shop-pack', tx: 12, ty: 7, building: 'card-shop',
        decor: [{ dx: 0, dy: 0, spriteId: 'hub-item-cards' }],
        reactions: [{ type: 'buyPack' }],
      }],
    }))
    expect(bundle.HUB_INTERACTABLES[0].reactions).toEqual([{ type: 'buyPack' }])
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
    expect(board!.decor!.every(d => (d.tileId ?? 0) > 0)).toBe(true)
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

  it('parses a giveItem reaction collectible with lore text', () => {
    const bundle = createHubLocationData(minimalConfig({
      interactables: [{
        id: 'secret-note',
        tx: 10, ty: 10,
        reactions: [{
          type: 'giveItem',
          collectible: { id: 'weathered-note', name: 'Weathered Note', icon: '📜', desc: 'A scrap of paper.', lore: 'Long ago...' },
        }],
      }],
    }))
    const secret = bundle.HUB_INTERACTABLES.find(i => i.id === 'secret-note')
    expect(secret?.decor).toBeUndefined()
    expect(secret?.hitRect).toEqual({ w: 1, h: 1 })
    const reaction = secret?.reactions[0] as { type: 'giveItem'; collectible?: { lore?: string } }
    expect(reaction.collectible?.lore).toBe('Long ago...')
  })

  it('contains the card-shop-pack interactable with a buyPack reaction', () => {
    const bundle = createHubLocationData(ravenwatchConfig as unknown as RawConfig)
    const pack = bundle.HUB_INTERACTABLES.find(i => i.id === 'card-shop-pack')
    expect(pack).toBeDefined()
    expect(pack!.building).toBe('card-shop')
    expect(pack!.reactions).toEqual([{ type: 'buyPack' }])
  })
})

function minimalBlockedPath(extra: Record<string, unknown>) {
  return {
    id: 'test-block',
    blockedTiles: [[1, 1]],
    blocked: { decor: [], npcs: [] },
    cleared: { decor: [], npcs: [] },
    ...extra,
  }
}

describe('blocked paths parsing', () => {
  it('parses a quest-gated blocked path (regression)', () => {
    const bundle = createHubQuestData(minimalQuestConfig({
      blockedPaths: [minimalBlockedPath({ questId: 'some-quest' })],
    }))
    expect(bundle.HUB_BLOCKED_PATHS).toHaveLength(1)
    expect(bundle.HUB_BLOCKED_PATHS[0].questId).toBe('some-quest')
    expect(bundle.HUB_BLOCKED_PATHS[0].unlockedByInteractable).toBeUndefined()
  })

  it('parses a secret-gated blocked path via unlockedByInteractable', () => {
    const bundle = createHubQuestData(minimalQuestConfig({
      blockedPaths: [minimalBlockedPath({ unlockedByInteractable: 'ravenwatch-hidden-grove-key' })],
    }))
    expect(bundle.HUB_BLOCKED_PATHS).toHaveLength(1)
    expect(bundle.HUB_BLOCKED_PATHS[0].unlockedByInteractable).toBe('ravenwatch-hidden-grove-key')
    expect(bundle.HUB_BLOCKED_PATHS[0].questId).toBeUndefined()
  })
})

describe('player-owned house fields', () => {
  it('passes requiresOwnership through on a building and playerDecor through on its interior', () => {
    const bundle = createHubLocationData(minimalConfig({
      buildings: [{
        id: 'test-house', rect: [0, 0, 2, 2] as unknown as RawTileRectCoord,
        upgradeKind: 'playerHouse', requiresOwnership: true,
      }],
      interiors: {
        'test-house': {
          name: 'Test House', width: 4, height: 4,
          floorTileId: 'parquetFloor', decor: [], playerDecor: true,
        },
      },
    }))
    expect(bundle.HUB_BUILDINGS[0].requiresOwnership).toBe(true)
    expect(bundle.HUB_INTERIORS['test-house'].playerDecor).toBe(true)
  })

  it('both fields default to falsy/undefined for ordinary buildings, leaving existing towns unaffected', () => {
    const bundle = createHubLocationData(minimalConfig({
      buildings: [{ id: 'shop', rect: [0, 0, 2, 2] as unknown as RawTileRectCoord, upgradeKind: 'shop' }],
      interiors: { shop: { name: 'Shop', width: 4, height: 4, floorTileId: 'woodFloor', decor: [] } },
    }))
    expect(bundle.HUB_BUILDINGS[0].requiresOwnership).toBeUndefined()
    expect(bundle.HUB_INTERIORS.shop.playerDecor).toBeUndefined()
  })
})
