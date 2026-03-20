# Real-Time Redesign Plan

## Overview
Convert the turn-based game to a real-time system. Player taps cards to queue them;
they auto-deploy after a countdown. Combat fires automatically every 6 seconds.
Some buildings spawn units on their own timer.

---

## 1. Core Loop (App.tsx)
- `setInterval(100ms)` drives everything via `tick(state, 100)`
- No "End Turn" button

---

## 2. Mana (replaces per-turn grant)
- Starts at 3, max 5 (+1 per Farm)
- Regenerates 1 mana every **3 seconds** (shown as decimal: `3.7/5`)
- Costs are paid immediately on tap

---

## 3. Card Queue
- Tap card → joins queue, mana deducted immediately
- Queue shows as a strip: `[Goblin ▶ 2.1s] [Wall ▶ 4.8s]`
- Countdown finishes → unit deploys to field with slide-in animation
- Multiple cards queue simultaneously; each has its own countdown

**Default deploy times:**
| Type      | Time |
|-----------|------|
| Unit      | 3 s  |
| Structure | 5 s  |
| Upgrade   | 1.5 s|

---

## 4. Auto-Combat
- Timer counts down from **6 s**, shown in divider: `── ⚔ COMBAT IN 4.2s ──`
- Fires `resolveCombat()` (existing logic, unchanged)
- Field flashes briefly on combat

---

## 5. Opponent AI
- Acts every **8 s**, plays 1–2 affordable cards
- Cards go onto field instantly (no queue — they're already "at the front")

---

## 6. Spawner Buildings (new card type)

Buildings can have `structureEffect: { type: 'spawn', unitTemplate, intervalMs }`.
The unit (a `SpawnerUnit`) tracks `spawnTimer: number` in field state.
Each tick decrements `spawnTimer`; when it hits 0 a new unit is spawned adjacent
and the timer resets.

**New cards replacing/adding to deck:**

| Card            | Cost | Structure HP | Spawns          | Interval |
|-----------------|------|-------------|-----------------|----------|
| Barracks        | 2    | 8 HP        | Goblin (2/3)    | 8 s      |
| Arcane Tower    | 3    | 6 HP        | Archer (2/3)    | 10 s     |
| Dragon Lair     | 5    | 10 HP       | Dragon (8/7)    | 20 s     |

Walls and Farm (mana) remain as non-spawner structures.

---

## 7. Types changes (`game/types.ts`)

```typescript
// New structure effect variant
| { type: 'spawn'; unitTemplate: UnitTemplate; intervalMs: number }

// QueuedCard
interface QueuedCard {
  qId: string
  card: Card
  msRemaining: number
  totalMs: number
}

// Unit gains optional spawn tracking
interface Unit {
  // ...existing fields
  spawnTimer?: number   // ms remaining until next spawn (spawner buildings only)
  spawnIntervalMs?: number
  spawnTemplate?: UnitTemplate
}

// GameState replaces turn-based phase & mana fields
interface GameState {
  // ...existing base/field/hand/deck fields
  mana: number
  maxMana: number
  manaAccum: number       // fractional mana (0–1)
  queue: QueuedCard[]
  combatTimer: number     // ms until next combat round
  opponentTimer: number   // ms until opponent acts
  log: string[]
  phase: GamePhase        // 'playing' | 'gameOver'
  turn: number            // combat round counter
}
```

---

## 8. Engine changes (`game/engine.ts`)

Remove: `endTurn()`
Keep: `newGame()`, `hpBar()`, `resolveCombat()`, `checkGameOver()`, `spawnUnit()`
Add:
- `queueCard(state, cardId): GameState` — deducts mana, adds to queue, draws replacement
- `tick(state, deltaMs): GameState` — the main real-time update:
  1. Mana regen
  2. Drain queue (deploy cards whose countdown expired)
  3. Tick spawner buildings (deploy units from Barracks/Towers)
  4. Decrement `combatTimer`; fire combat when it hits 0
  5. Decrement `opponentTimer`; run AI when it hits 0

---

## 9. UI changes

**Battlefield.tsx:**
- Remove End Turn button
- Combat divider becomes `── ⚔ COMBAT IN 4.2s ──` (live countdown)
- Queue strip between player field and log: shows queued cards with progress bars
- Mana shown as `3.7/5` (fractional)

**styles.css:**
- `@keyframes unitEnter` — slide-in from bottom (player) / top (opponent)
- Queue card styling with progress bar fill
- Combat flash animation on `.field-divider--combat`

---

## 10. File change summary

| File | Change |
|------|--------|
| `game/types.ts` | Add QueuedCard, update StructureEffect, Unit, GameState |
| `game/engine.ts` | Remove endTurn, add tick + queueCard |
| `game/cards.ts` | Replace Barracks with spawner buildings (Barracks, Arcane Tower, Dragon Lair) |
| `components/App.tsx` | setInterval tick, remove handleEndTurn |
| `components/Battlefield.tsx` | Queue strip, combat timer, no End Turn btn |
| `styles.css` | Queue styles, enter animation, timer |
