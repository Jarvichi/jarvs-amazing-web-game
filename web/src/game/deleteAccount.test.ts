import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from 'firebase/auth'

// deleteAccount is destructive, so it is verified against a stubbed Firestore
// rather than by running it. The stubs record every path touched, which is
// what the assertions below are actually about: what gets deleted, what does
// not, and in which order relative to deleting the auth user.

let reauthImpl: () => Promise<unknown> = async () => ({})
let deleteUserImpl: () => Promise<unknown> = async () => undefined
let getDocImpl: (path: string) => Promise<unknown> = async () => ({ exists: () => false })
let deleteDocImpl: (path: string) => Promise<unknown> = async () => undefined
let indexPaths: string[] = []
let indexThrows = false

let deletedPaths: string[] = []
let events: string[] = []

vi.mock('../firebase', () => ({ db: {} }))
vi.mock('../logger', () => ({ logError: () => {} }))

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  reauthenticateWithCredential: () => { events.push('reauth'); return reauthImpl() },
  deleteUser: () => { events.push('deleteUser'); return deleteUserImpl() },
}))

vi.mock('firebase/firestore', () => ({
  // Our doc() is called as doc(db, ...segments); rebuild the path so the
  // stubs can assert on it.
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  getDoc: (ref: { path: string }) => getDocImpl(ref.path),
  deleteDoc: (ref: { path: string }) => {
    events.push(`delete:${ref.path}`)
    deletedPaths.push(ref.path)
    return deleteDocImpl(ref.path)
  },
}))

vi.mock('./userIndex', () => ({
  readUserDocs: async () => {
    if (indexThrows) throw new Error('offline')
    return indexPaths
  },
}))

vi.mock('./questline', () => ({ loadPlayerName: () => 'Jarv' }))
vi.mock('./miniGames', () => ({ MINI_GAME_LABELS: { marble: 'Marble', fishing: 'Fishing' } }))

import { deleteAccount } from './deleteAccount'

const asUser = (over: Partial<User> = {}) => ({
  uid: 'u1',
  email: 'player@example.com',
  isAnonymous: false,
  ...over,
}) as User

beforeEach(() => {
  reauthImpl = async () => ({})
  deleteUserImpl = async () => undefined
  getDocImpl = async () => ({ exists: () => false })
  deleteDocImpl = async () => undefined
  indexPaths = []
  indexThrows = false
  deletedPaths = []
  events = []
})

describe('deleteAccount', () => {
  it('deletes every path recorded in the deletion index', async () => {
    indexPaths = [
      'dailyLeaderboard/2026-08-01/entries/u1',
      'weeklyLeaderboard/2026-W31/entries/u1',
      'miniGameLeaderboard/fishing/today/2026-08-01/u1',
    ]
    const res = await deleteAccount(asUser(), 'pw')

    expect(res).toEqual({ ok: true, orphanedPaths: 0 })
    for (const path of indexPaths) expect(deletedPaths).toContain(path)
  })

  it('deletes the uid-addressable paths without needing the index', async () => {
    const res = await deleteAccount(asUser(), 'pw')

    expect(res.ok).toBe(true)
    expect(deletedPaths).toContain('saves/u1')
    expect(deletedPaths).toContain('endlessLeaderboard/u1')
    expect(deletedPaths).toContain('miniGameLeaderboard/marble/allTime/u1')
    expect(deletedPaths).toContain('miniGameLeaderboard/fishing/allTime/u1')
    expect(deletedPaths).toContain('userIndex/u1')
  })

  it('does not delete the same path twice when the index repeats a direct path', async () => {
    indexPaths = ['saves/u1', 'miniGameLeaderboard/marble/allTime/u1']
    await deleteAccount(asUser(), 'pw')

    expect(deletedPaths.filter(p => p === 'saves/u1')).toHaveLength(1)
    expect(deletedPaths.filter(p => p === 'miniGameLeaderboard/marble/allTime/u1')).toHaveLength(1)
  })

  it('releases the player name when the record still points at this uid', async () => {
    getDocImpl = async path =>
      path === 'playerNames/jarv'
        ? { exists: () => true, data: () => ({ uid: 'u1' }) }
        : { exists: () => false }

    await deleteAccount(asUser(), 'pw')
    expect(deletedPaths).toContain('playerNames/jarv')
  })

  it('leaves the player name alone when someone else now holds it', async () => {
    // playerNames is keyed by name, not uid — a registered player can displace
    // an anonymous holder, so the doc under our name may be theirs by now.
    getDocImpl = async path =>
      path === 'playerNames/jarv'
        ? { exists: () => true, data: () => ({ uid: 'someone-else' }) }
        : { exists: () => false }

    const res = await deleteAccount(asUser(), 'pw')

    expect(deletedPaths).not.toContain('playerNames/jarv')
    expect(res).toEqual({ ok: true, orphanedPaths: 0 })
  })

  it('deletes documents before the auth user, while rules still allow it', async () => {
    indexPaths = ['dailyLeaderboard/2026-08-01/entries/u1']
    await deleteAccount(asUser(), 'pw')

    const lastDelete = events.map(e => e.startsWith('delete:')).lastIndexOf(true)
    expect(events.indexOf('deleteUser')).toBeGreaterThan(lastDelete)
  })

  it('aborts before deleting anything when the password is wrong', async () => {
    reauthImpl = async () => { throw Object.assign(new Error('nope'), { code: 'auth/wrong-password' }) }

    const res = await deleteAccount(asUser(), 'bad')

    expect(res).toEqual({ ok: false, reason: 'wrong-password', message: 'Incorrect password.' })
    expect(deletedPaths).toEqual([])
    expect(events).not.toContain('deleteUser')
  })

  it('reports a stale login without deleting anything', async () => {
    reauthImpl = async () => { throw Object.assign(new Error('old'), { code: 'auth/requires-recent-login' }) }

    const res = await deleteAccount(asUser(), 'pw')

    expect(res.ok).toBe(false)
    expect(res.ok === false && res.reason).toBe('requires-recent-login')
    expect(deletedPaths).toEqual([])
  })

  it('counts documents it could not delete rather than aborting the sweep', async () => {
    indexPaths = ['dailyLeaderboard/2026-08-01/entries/u1']
    deleteDocImpl = async path => {
      if (path === 'saves/u1') throw new Error('offline')
    }

    const res = await deleteAccount(asUser(), 'pw')

    expect(res).toEqual({ ok: true, orphanedPaths: 1 })
    // The failure must not stop the rest — more data removed beats less.
    expect(deletedPaths).toContain('dailyLeaderboard/2026-08-01/entries/u1')
    expect(deletedPaths).toContain('endlessLeaderboard/u1')
  })

  it('treats an unreadable index as an orphan rather than passing silently', async () => {
    indexThrows = true

    const res = await deleteAccount(asUser(), 'pw')

    expect(res).toEqual({ ok: true, orphanedPaths: 1 })
  })

  it('refuses an anonymous user, which has no account to delete', async () => {
    const res = await deleteAccount(asUser({ isAnonymous: true }), 'pw')

    expect(res.ok).toBe(false)
    expect(events).toEqual([])
    expect(deletedPaths).toEqual([])
  })

  it('reports data removed but account kept when deleteUser fails', async () => {
    deleteUserImpl = async () => { throw Object.assign(new Error('boom'), { code: 'auth/internal' }) }

    const res = await deleteAccount(asUser(), 'pw')

    expect(res.ok).toBe(false)
    expect(res.ok === false && res.message).toContain('saved data was removed')
  })
})
