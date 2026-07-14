import { describe, it, expect, beforeEach, vi } from 'vitest'

// resumeJournal needs window/document/localStorage at module load (via
// rollbar.ts) and call time — stub them before importing the module under test.
const rollbarSpy = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), configure: vi.fn() }

let store = new Map<string, string>()
let storageThrows = false
const localStorageStub = {
  getItem: (k: string) => { if (storageThrows) throw new Error('quota'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (storageThrows) throw new Error('quota'); store.set(k, v) },
  removeItem: (k: string) => { if (storageThrows) throw new Error('quota'); store.delete(k) },
}

const windowListeners = new Map<string, (e: { persisted?: boolean }) => void>()
const documentListeners = new Map<string, () => void>()
vi.stubGlobal('window', {
  Rollbar: rollbarSpy,
  addEventListener: (type: string, fn: (e: { persisted?: boolean }) => void) => windowListeners.set(type, fn),
})
vi.stubGlobal('document', {
  visibilityState: 'visible',
  addEventListener: (type: string, fn: () => void) => documentListeners.set(type, fn),
})
vi.stubGlobal('localStorage', localStorageStub)
vi.stubGlobal('performance', {
  getEntriesByType: (type: string) => type === 'navigation' ? [{ type: 'reload' }] : [],
})

const { journal, flushResumeJournal, initResumeJournal, _resetResumeJournalForTest } = await import('./resumeJournal')

const KEY = 'jarv_resume_journal'
const readEntries = () => JSON.parse(store.get(KEY) ?? '[]')

describe('resumeJournal', () => {
  beforeEach(() => {
    store = new Map()
    storageThrows = false
    windowListeners.clear()
    documentListeners.clear()
    rollbarSpy.info.mockClear()
    _resetResumeJournalForTest()
  })

  it('appends entries with timestamp, event, data and unsent flag', () => {
    journal('hidden', { screen: 'hubworld' })
    expect(readEntries()).toEqual([
      { ts: expect.any(Number), event: 'hidden', data: { screen: 'hubworld' }, sent: false },
    ])
  })

  it('keeps only the most recent entries when the ring buffer overflows', () => {
    for (let i = 0; i < 25; i++) journal('tick', { i })
    const entries = readEntries()
    expect(entries).toHaveLength(20)
    expect(entries[0].data.i).toBe(5)
    expect(entries[19].data.i).toBe(24)
  })

  it('coalesces consecutive unsent entries of the same event', () => {
    journal('hidden', { screen: 'title' }, { coalesce: true })
    journal('hidden', { screen: 'hubworld' }, { coalesce: true })
    expect(readEntries()).toHaveLength(1)
    expect(readEntries()[0].data.screen).toBe('hubworld')
  })

  it('does not coalesce across a different intervening event', () => {
    journal('hidden', undefined, { coalesce: true })
    journal('visible')
    journal('hidden', undefined, { coalesce: true })
    expect(readEntries().map((e: { event: string }) => e.event)).toEqual(['hidden', 'visible', 'hidden'])
  })

  it('does not coalesce into an already-sent entry', () => {
    journal('hidden', undefined, { coalesce: true })
    flushResumeJournal('resume')
    journal('hidden', undefined, { coalesce: true })
    expect(readEntries()).toHaveLength(2)
  })

  it('flushes all unsent entries as a single rollbar.info and marks them sent', () => {
    journal('webglcontextlost', { hidden: true })
    journal('rebuild-deferred')
    flushResumeJournal('resume', { hiddenMs: 60_000 })
    expect(rollbarSpy.info).toHaveBeenCalledTimes(1)
    expect(rollbarSpy.info).toHaveBeenCalledWith('[resumeJournal] flush', expect.objectContaining({
      trigger: 'resume',
      count: 2,
      hiddenMs: 60_000,
      entries: [
        expect.objectContaining({ event: 'webglcontextlost' }),
        expect.objectContaining({ event: 'rebuild-deferred' }),
      ],
    }))
    expect(readEntries().every((e: { sent: boolean }) => e.sent)).toBe(true)
  })

  it('sends nothing when there are no unsent entries', () => {
    journal('hidden')
    flushResumeJournal('resume')
    rollbarSpy.info.mockClear()
    flushResumeJournal('boot')
    expect(rollbarSpy.info).not.toHaveBeenCalled()
  })

  it('only includes entries journaled since the previous flush', () => {
    journal('hidden')
    flushResumeJournal('resume')
    journal('visible')
    rollbarSpy.info.mockClear()
    flushResumeJournal('resume')
    expect(rollbarSpy.info).toHaveBeenCalledWith('[resumeJournal] flush', expect.objectContaining({
      count: 1,
      entries: [expect.objectContaining({ event: 'visible' })],
    }))
  })

  it('boot flush reports the navigation type of the new page load', () => {
    journal('sw-controllerchange-reload')
    initResumeJournal()
    expect(rollbarSpy.info).toHaveBeenCalledWith('[resumeJournal] flush', expect.objectContaining({
      trigger: 'boot',
      navigationType: 'reload',
      entries: [expect.objectContaining({ event: 'sw-controllerchange-reload' })],
    }))
  })

  it('journals bfcache pageshow restores but not normal loads', () => {
    initResumeJournal()
    windowListeners.get('pageshow')!({ persisted: false })
    expect(readEntries()).toHaveLength(0)
    windowListeners.get('pageshow')!({ persisted: true })
    expect(readEntries()).toEqual([expect.objectContaining({ event: 'pageshow', data: { persisted: true } })])
  })

  it('journals Page Lifecycle freeze/resume events', () => {
    initResumeJournal()
    documentListeners.get('freeze')!()
    documentListeners.get('resume')!()
    expect(readEntries().map((e: { event: string }) => e.event)).toEqual(['freeze', 'resume'])
  })

  it('survives a throwing localStorage', () => {
    storageThrows = true
    expect(() => {
      journal('hidden')
      flushResumeJournal('resume')
      initResumeJournal()
    }).not.toThrow()
    expect(rollbarSpy.info).not.toHaveBeenCalled()
  })
})
