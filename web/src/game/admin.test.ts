import { describe, it, expect } from 'vitest'
import type { User } from 'firebase/auth'
import { isAdminUser } from './admin'
import { GIFT_OWNER_UID } from './gifts'

const asUser = (uid: string) => ({ uid }) as User

describe('isAdminUser', () => {
  it('accepts the owner uid', () => {
    expect(isAdminUser(asUser(GIFT_OWNER_UID))).toBe(true)
  })

  it('rejects any other account', () => {
    // Anonymous sign-in always yields a uid (see hooks/useAuth), so "has a
    // user" must never be mistaken for "is the admin".
    expect(isAdminUser(asUser('some-other-uid'))).toBe(false)
  })

  it('rejects a missing user rather than throwing', () => {
    expect(isAdminUser(null)).toBe(false)
    expect(isAdminUser(undefined)).toBe(false)
  })
})
