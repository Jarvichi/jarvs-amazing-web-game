import { describe, it, expect, beforeEach, vi } from 'vitest'

// Minimal localStorage for the node test environment.
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem:    (k: string) => storage.get(k) ?? null,
  setItem:    (k: string, v: string) => { storage.set(k, String(v)) },
  removeItem: (k: string) => { storage.delete(k) },
  clear:      () => { storage.clear() },
})

import {
  CHRONICLE_CHAPTERS, getChronicleStatus, markChapterRead, recordChronicleWin,
  setChronicleDevUnlocked, getChronicleNewsItems, getUnreadChapterCount,
} from './chronicle'
import { getCardThemeTags, getCardCatalog } from './cards'

beforeEach(() => storage.clear())

/** A card name carrying the given theme tag, for win_with_tag challenges. */
function cardWithTag(tag: string): string {
  const card = getCardCatalog().find(c => getCardThemeTags(c.name).includes(tag))
  expect(card, `no card in catalog with tag '${tag}'`).toBeDefined()
  return card!.name
}

describe('chronicle data', () => {
  it('has unique chapter ids and valid dates', () => {
    const ids = new Set(CHRONICLE_CHAPTERS.map(c => c.id))
    expect(ids.size).toBe(CHRONICLE_CHAPTERS.length)
    for (const c of CHRONICLE_CHAPTERS) {
      expect(c.availableFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(c.lore.length).toBeGreaterThan(0)
    }
  })

  it('win_with_tag challenges reference tags that exist in the catalog', () => {
    for (const c of CHRONICLE_CHAPTERS) {
      if (c.challenge.type === 'win_with_tag') {
        expect(cardWithTag(c.challenge.tag)).toBeTruthy()
      }
    }
  })
})

describe('availability gating', () => {
  it('dev unlock opens every chapter; clearing restores the date gate', () => {
    setChronicleDevUnlocked(true)
    expect(getChronicleStatus().every(c => c.available)).toBe(true)
    setChronicleDevUnlocked(false)
    const future = getChronicleStatus().filter(c => c.def.availableFrom > new Date().toISOString().slice(0, 10))
    expect(future.every(c => !c.available)).toBe(true)
  })
})

describe('chapter completion flow', () => {
  it('requires reading before challenge progress counts', () => {
    setChronicleDevUnlocked(true)
    const ch1 = CHRONICLE_CHAPTERS[0]
    expect(ch1.challenge.type).toBe('win_with_tag')
    const tag = ch1.challenge.type === 'win_with_tag' ? ch1.challenge.tag : ''

    // Win before reading — no progress
    recordChronicleWin([cardWithTag(tag)])
    expect(getChronicleStatus()[0].progress).toBe(0)

    // Read, then win with a matching card — completes ch1 (count: 1)
    markChapterRead(ch1.id)
    expect(getUnreadChapterCount()).toBe(CHRONICLE_CHAPTERS.length - 1)
    const completed = recordChronicleWin([cardWithTag(tag)])
    expect(completed.map(c => c.id)).toContain(ch1.id)
    expect(getChronicleStatus()[0].completed).toBe(true)

    // Completing again is a no-op
    expect(recordChronicleWin([cardWithTag(tag)])).toEqual([])
  })

  it('does not progress win_with_tag chapters on unrelated wins', () => {
    setChronicleDevUnlocked(true)
    const ch1 = CHRONICLE_CHAPTERS[0]
    markChapterRead(ch1.id)
    recordChronicleWin([])  // won, but played no tagged cards
    expect(getChronicleStatus()[0].progress).toBe(0)
  })
})

describe('news surfacing', () => {
  it('announces only available chapters', () => {
    setChronicleDevUnlocked(false)
    const items = getChronicleNewsItems()
    const availableIds = getChronicleStatus().filter(c => c.available).map(c => `chronicle-${c.def.id}`)
    expect(items.map(i => i.id)).toEqual(availableIds)
    for (const item of items) {
      expect(item.title).toContain('Chronicle Update')
      expect(item.tag).toBe('EVENT')
    }
  })
})
