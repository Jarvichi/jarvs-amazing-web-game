import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../platform', () => ({ isNative: vi.fn(() => false) }))

import { isNative } from '../../platform'
import { saveMap, saveQuestDefs } from './mapEditorApi'

describe('mapEditorApi on native (#2088)', () => {
  beforeEach(() => {
    vi.mocked(isNative).mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn())
  })

  it('saveMap throws without reaching the dev-server endpoint', async () => {
    await expect(saveMap('map-1', {})).rejects.toThrow('Editor unavailable on native')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('saveQuestDefs throws without reaching the dev-server endpoint', async () => {
    await expect(saveQuestDefs('map-1', {})).rejects.toThrow('Editor unavailable on native')
    expect(fetch).not.toHaveBeenCalled()
  })
})
