import type { User } from 'firebase/auth'
import { GIFT_OWNER_UID } from './gifts'

/**
 * Whether this account is the game's admin.
 *
 * The owner UID lives in ./gifts for historical reasons — it started life as
 * "who owns the gift registry" — but it is really the one admin identity, so
 * gating reads better through this than through a gifts import.
 *
 * Distinct from `isDevMode()` in ./debug, which is a URL opt-in (`?dev`) any
 * account can use. Dev tooling is gated on either: `isDevMode() || isAdminUser(user)`.
 */
export function isAdminUser(user: User | null | undefined): boolean {
  return !!user && user.uid === GIFT_OWNER_UID
}
