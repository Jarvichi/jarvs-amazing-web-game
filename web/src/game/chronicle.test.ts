import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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
  recordChronicleDecision, getChronicleAlignment, getDominantAlignment,
  type ChronicleChapterDef,
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

describe('decisions (Season 2)', () => {
  // Season 1 chapters (ch1-ch6) carry no `decision`; these synthetic entries
  // exercise the decision/alignment machinery ahead of any real Season 2
  // content landing in chronicle.json.
  const chapterA: ChronicleChapterDef = {
    id: 'test-decision-a',
    title: 'Test Decision A',
    availableFrom: '2000-01-01',
    teaser: 't',
    lore: 'l',
    challenge: { type: 'win_battles', count: 1 },
    reward: { type: 'crystals', amount: 1 },
    decision: {
      id: 'da',
      prompt: 'Choose',
      options: [
        { id: 'vigil-opt', label: 'Vigil', consequence: 'v', alignment: { vigil: 2 } },
        { id: 'accord-opt', label: 'Accord', consequence: 'a', alignment: { accord: 2 } },
      ],
    },
  }
  const chapterB: ChronicleChapterDef = {
    id: 'test-decision-b',
    title: 'Test Decision B',
    availableFrom: '2000-01-01',
    teaser: 't',
    lore: 'l',
    challenge: { type: 'win_battles', count: 1 },
    reward: { type: 'crystals', amount: 1 },
    decision: {
      id: 'db',
      prompt: 'Choose',
      options: [{ id: 'accord-opt-2', label: 'Accord again', consequence: 'a', alignment: { accord: 2 } }],
    },
  }
  const chapterC: ChronicleChapterDef = {
    id: 'test-decision-c',
    title: 'Test Decision C',
    availableFrom: '2000-01-01',
    teaser: 't',
    lore: 'l',
    challenge: { type: 'win_battles', count: 1 },
    reward: { type: 'crystals', amount: 1 },
    decision: {
      id: 'dc',
      prompt: 'Choose',
      options: [{ id: 'vigil-opt-2', label: 'Vigil again', consequence: 'v', alignment: { vigil: 4 } }],
    },
  }
  const lockedChapter: ChronicleChapterDef = {
    ...chapterA,
    id: 'test-decision-locked',
    availableFrom: '2999-01-01',
  }

  beforeEach(() => {
    CHRONICLE_CHAPTERS.push(chapterA, chapterB, chapterC, lockedChapter)
  })
  afterEach(() => {
    for (const id of [chapterA.id, chapterB.id, chapterC.id, lockedChapter.id]) {
      const idx = CHRONICLE_CHAPTERS.findIndex(c => c.id === id)
      if (idx >= 0) CHRONICLE_CHAPTERS.splice(idx, 1)
    }
  })

  it('records a decision and reflects it in status', () => {
    recordChronicleDecision(chapterA.id, 'vigil-opt')
    const status = getChronicleStatus().find(c => c.def.id === chapterA.id)!
    expect(status.decisionOptionId).toBe('vigil-opt')
  })

  it('first pick is final — re-recording is a no-op', () => {
    recordChronicleDecision(chapterA.id, 'vigil-opt')
    recordChronicleDecision(chapterA.id, 'accord-opt')
    const status = getChronicleStatus().find(c => c.def.id === chapterA.id)!
    expect(status.decisionOptionId).toBe('vigil-opt')
    expect(getChronicleAlignment().vigil).toBe(2)
    expect(getChronicleAlignment().accord).toBe(0)
  })

  it('ignores unknown option ids', () => {
    recordChronicleDecision(chapterA.id, 'not-a-real-option')
    const status = getChronicleStatus().find(c => c.def.id === chapterA.id)!
    expect(status.decisionOptionId).toBeNull()
  })

  it('no-ops for a chapter with no decision', () => {
    const ch1 = CHRONICLE_CHAPTERS.find(c => c.id === 'ch1')!
    recordChronicleDecision(ch1.id, 'whatever')
    const status = getChronicleStatus().find(c => c.def.id === ch1.id)!
    expect(status.decisionOptionId).toBeNull()
  })

  it('no-ops for an unavailable chapter', () => {
    recordChronicleDecision(lockedChapter.id, 'vigil-opt')
    const status = getChronicleStatus().find(c => c.def.id === lockedChapter.id)!
    expect(status.decisionOptionId).toBeNull()
  })

  it('sums alignment weights across chapters and picks the dominant track', () => {
    recordChronicleDecision(chapterA.id, 'vigil-opt')
    expect(getChronicleAlignment()).toEqual({ vigil: 2, accord: 0, unbinding: 0 })
    expect(getDominantAlignment()).toBe('vigil')
  })

  it('returns null dominant alignment on no decisions made, and on a tie', () => {
    expect(getDominantAlignment()).toBeNull()
    recordChronicleDecision(chapterA.id, 'accord-opt')
    recordChronicleDecision(chapterB.id, 'accord-opt-2')
    expect(getDominantAlignment()).toBe('accord')  // accord=4, others 0
    recordChronicleDecision(chapterC.id, 'vigil-opt-2')
    expect(getDominantAlignment()).toBeNull()  // accord=4, vigil=4 — tied
  })
})
