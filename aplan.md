# Plan: Relic Selection Screen + Break Chance (#174)

## What's needed

1. **Explicit relic selection** at act start — RelicSelectScreen already exists, just needs to be shown at the right time (currently auto-equips last earned)
2. **50% break chance** on act completion — equipped relic is removed from the earned list and becomes a broken inventory item
3. **Re-earn** to get it back: completing the act that originally awarded the relic adds it back to `jarv_relics`

**Broken relics are removed from the selection screen entirely.** They become a "Cracked [RelicName]" inventory item. No greyed-out UI needed — simpler.

---

## Storage

No new localStorage key needed. Breaking a relic just calls a new `removeEarnedRelic(name)` helper that removes it from the existing `jarv_relics` array.

---

## Files to Change

| File | Change |
|---|---|
| `web/src/game/relics.ts` | Add `removeEarnedRelic(name)` export |
| `web/src/App.tsx` | Wire break chance in `handleActComplete`; re-earn un-break; `RelicSelectScreen` already works as-is |

No changes needed to `RelicSelectScreen.tsx` or `styles.css` — broken relics simply won't be in the earned list.

---

## Step 1 — `relics.ts`: Add `removeEarnedRelic`

```ts
export function removeEarnedRelic(name: string): void {
  const current = loadEarnedRelics()
  saveEarnedRelics(current.filter(n => n !== name))
}
```

Check whether `saveEarnedRelics` already exists (private helper used by `addEarnedRelic`) — if so, reuse it. If not, add:

```ts
function saveEarnedRelics(names: string[]): void {
  localStorage.setItem(RELICS_KEY, JSON.stringify(names))
}
```

Commit: `feat: add removeEarnedRelic helper to relics.ts`

---

## Step 2 — `App.tsx`: Break chance + re-earn in `handleActComplete`

### 2a — Import

Add `removeEarnedRelic` to the import from `./game/relics`.
Check that `addToInventory` is already imported (from `./game/dailyLogin` or similar) — add if not.

### 2b — Re-earn: un-break when earning the act's relic

In `handleActComplete`, find the `addEarnedRelic(act.rewardRelic)` call and ensure the relic is back in the pool regardless of prior breaks. `addEarnedRelic` already deduplicates, so no extra call needed — it just adds it back if it was removed.

```ts
if (act?.rewardRelic) {
  addEarnedRelic(act.rewardRelic)   // re-adds even if previously broken/removed
}
```

No change needed here — this already works correctly since `removeEarnedRelic` removes from the array and `addEarnedRelic` adds it back.

### 2c — Break chance: 50% on act completion

Each relic has a unique broken item. Define a lookup map:

```ts
const BROKEN_RELIC_ITEMS: Record<string, { name: string; icon: string; desc: string }> = {
  'Bark Shield':   { name: 'Shattered Bark Shield',  icon: '🪵', desc: 'Once deflected a thousand blows. Now just good kindling.' },
  'Iron Standard': { name: 'Bent Iron Standard',     icon: '🚩', desc: 'The banner that inspired legions. Now it just looks sad.' },
  'Soulstone':     { name: 'Cracked Soulstone',      icon: '💎', desc: 'The soul inside got out. Probably fine.' },
  'Prism Lens':    { name: 'Clouded Prism Lens',     icon: '🔮', desc: 'Focused infinite mana. Now focuses nothing. Like most things.' },
}
```

After the `addEarnedRelic` block and **before** the relic select / next-act transition, add:

```ts
// 50% chance: equipped relic breaks on act completion
const equippedRelic = currentRun.activeRelic
if (equippedRelic && equippedRelic !== act?.rewardRelic && Math.random() < 0.5) {
  removeEarnedRelic(equippedRelic)
  const broken = BROKEN_RELIC_ITEMS[equippedRelic]
  addToInventory({
    id: `broken-relic-${equippedRelic.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    name: broken?.name ?? `Cracked ${equippedRelic}`,
    icon: broken?.icon ?? '🪨',
    desc: broken?.desc ?? `A cracked ${equippedRelic} — it held until it didn't.`,
    acquiredDate: new Date().toISOString(),
  })
}
```

**Important:** This must run **after** `addEarnedRelic(act.rewardRelic)` — the newly earned relic should never be the one that breaks (player just earned it). Only the relic they *carried into* the act can break.

**Edge case:** If `equippedRelic === act.rewardRelic` (same relic somehow), the re-earn runs first so it's in the list, then the break check removes it again. To avoid this, guard:

```ts
if (equippedRelic && equippedRelic !== act?.rewardRelic && Math.random() < 0.5) {
```

### 2d — Verify `handleActComplete` has both paths covered

The function has two paths:
- Normal act completion → relic select → next act
- Final act completion → card rest / starter pack

Apply the break check on **both** paths (before any transition in both branches).

Commit: `feat: add relic break chance and re-earn to handleActComplete`

---

## Implementation Notes

- **Read `handleActComplete` in full** before editing — there are two branches (next act vs final act); the break check should appear once, near the top, after `addEarnedRelic` but before any branching
- **Read `relics.ts` in full** to confirm the `RELICS_KEY` constant name and whether `saveEarnedRelics` already exists
- **`addToInventory`** — check current imports in App.tsx; it may already be imported for daily login integration
- **Build check** after each commit
- **Manual test:** Complete Act 1 boss → if relic breaks, check inventory for "Cracked Bark Shield" item; replay Act 1 → Bark Shield reappears on selection screen
