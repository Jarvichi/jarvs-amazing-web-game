// ─── Seeded randomness helpers ────────────────────────────────────────────────
//
// Deterministic hashing / PRNG / shuffling shared by the daily and weekly
// challenge systems. Same seed in → same sequence out, for every player.

/** FNV-1a 32-bit hash. */
export function hashStr(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

/** Mulberry32 seeded PRNG. */
export function makeSeededRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (Math.imul(s ^ (s >>> 15), s | 1) ^ ((s ^ (Math.imul(s ^ (s >>> 7), s | 61))) >>> 14)) >>> 0
    return s / 4294967296
  }
}

export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
