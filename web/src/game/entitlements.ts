// ─── Real-money entitlement seam (#2092) ───────────────────────────────────
// The single answer to "does this player own X" for real-money purchases,
// so adding IAP later is a body swap here rather than a refactor across call
// sites. Later this gets backed by @revenuecat/purchases-capacitor with
// server-side receipt validation in Firebase.
//
// Not for the in-game soft-currency shops (MerchantScreen.tsx, ShopScreen.tsx,
// game/hub/reputation.ts) — those are game economy, not real-money purchases,
// and neither store's IAP rules apply to them.

export type Entitlement = 'supporter' | 'cosmetic-pack'

export async function hasEntitlement(_e: Entitlement): Promise<boolean> { return false }
export async function purchase(_e: Entitlement): Promise<'unavailable'> { return 'unavailable' }
export async function restorePurchases(): Promise<void> { /* no-op */ }
