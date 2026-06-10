import { describe, it, expect } from 'vitest'
import { isQuestIdUnique, generateQuestId } from './questValidation'

describe('isQuestIdUnique', () => {
  const quests = [{ id: 'quest-a' }, { id: 'quest-b' }, { id: 'quest-c' }]

  it('returns true when id does not exist in the list', () => {
    expect(isQuestIdUnique('quest-z', quests, -1)).toBe(true)
  })

  it('returns false when another quest has the same id', () => {
    expect(isQuestIdUnique('quest-a', quests, 1)).toBe(false)
  })

  it('returns true when the only match is the excluded index', () => {
    expect(isQuestIdUnique('quest-a', quests, 0)).toBe(true)
  })

  it('returns false when list has one entry with same id', () => {
    expect(isQuestIdUnique('quest-a', [{ id: 'quest-a' }], -1)).toBe(false)
  })
})

describe('generateQuestId', () => {
  it('returns new-quest-1 for empty list', () => {
    expect(generateQuestId([])).toBe('new-quest-1')
  })

  it('returns new-quest-1 when no new-quest-N ids exist', () => {
    expect(generateQuestId(['fetch-herbs', 'lost-pendant'])).toBe('new-quest-1')
  })

  it('increments past consecutive existing ids', () => {
    expect(generateQuestId(['new-quest-1', 'new-quest-2', 'new-quest-3'])).toBe('new-quest-4')
  })

  it('fills the first gap in the sequence', () => {
    expect(generateQuestId(['new-quest-1', 'new-quest-3'])).toBe('new-quest-2')
  })
})
