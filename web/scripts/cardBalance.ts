// ─── Card balance formula ────────────────────────────────────────────────────
//
// TypeScript port of the cost-checking half of the power-score model formerly
// in the repo-root `rebalance_cards.py` (retired — #2278). The scoring core
// (`unitPowerScore`, `UPGRADE_WEIGHTS`) is *not* reimplemented here — it's
// imported from `../src/game/deckPower.ts`, the runtime deck-power rating's
// canonical implementation, so this checker and the in-game rating can never
// disagree on what a card is worth. Card shape comes from `RawCardDef`/
// `RawUnitDef`/`TEMPLATES` in `../src/game/cards.ts` for the same reason: a
// schema change can't silently desync this the way the Python reimplementation
// could.
//
// This module only *checks* — `cardBalance.test.ts` fails the build when a
// card's cost drifts more than the tolerance below from the formula.
// Rewriting `cards.json` in place is a separate, explicit act: run
//   npx tsx scripts/cardBalance.ts --rewrite
// rather than a side effect of running the checker.
//
// ════════════════════════════════════════════════════════════
// FORMULAS (constants chosen by the original author — see git history on the
// retired rebalance_cards.py for calibration notes)
// ════════════════════════════════════════════════════════════
//
// Unit mana cost:
//   formula cost = round(unitPowerScore(...) / CDIV), clamped to [1, 8]
//
// Building/spawner mana cost:
//   rate_factor = (7000 / intervalMs)^R
//   hp_factor   = (maxHp / 20)^P
//   formula cost = round(spawnedUnitCost × rate_factor × hp_factor × Q + S), clamped [2, 9]
//
// Buff/upgrade mana cost:
//   formula cost = max(1, round(|amount| × UPGRADE_WEIGHTS[effectType])), clamped [1, 6]

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { RawCardDef, RawUnitDef } from '../src/game/cards'
import { unitPowerScore, UPGRADE_WEIGHTS } from '../src/game/deckPower'

const here = dirname(fileURLToPath(import.meta.url))
export const CARDS_PATH = join(here, '..', 'src', 'data', 'cards.json')

// ── Constants ─────────────────────────────────────────────────────────────

const CDIV = 30.0 // divisor (calibrated so Goblin {atk=3,hp=10,spd=45,rng=5,cd=1000} → 1.0)

const P = 0.25 // hp_factor exponent
const Q = 1.40 // overall scale
const R = 0.50 // spawn-rate exponent
const S = 1.30 // base offset

/** Flag a unit outlier when its score is more than this fraction from its tier median. */
const OUTLIER_THRESHOLD = 0.45
/** Flag a spawner/upgrade card when its cost differs from formula by more than this. */
const STRUCTURE_TOLERANCE = 1

const PROTECTED_PREFIXES = ['boss-', 'hero-', 'weak-']
const PROTECTED_SUFFIXES = ['-weak', '-mini', '-boss']

// ── Formula functions ───────────────────────────────────────────────────────

export function formulaUnitCost(score: number): number {
  return Math.max(1, Math.min(8, Math.round(score / CDIV)))
}

export function buildingFormulaCost(spawnedCardCost: number, intervalMs: number, maxHp: number): number {
  const rateFactor = (7000 / intervalMs) ** R
  const hpFactor = (maxHp / 20) ** P
  const raw = spawnedCardCost * rateFactor * hpFactor
  return Math.max(2, Math.min(9, Math.round(raw * Q + S)))
}

export function upgradeFormulaCost(effectType: string, amount: number): number {
  const weight = (UPGRADE_WEIGHTS as Record<string, number>)[effectType] ?? 0.10
  return Math.max(1, Math.min(6, Math.round(Math.abs(amount) * weight)))
}

function isProtectedTemplate(slug: string): boolean {
  return PROTECTED_PREFIXES.some(p => slug.startsWith(p)) || PROTECTED_SUFFIXES.some(s => slug.endsWith(s))
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const n = s.length
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

/** A wall/non-combat unit has no meaningful power score. */
function isCombatUnit(u: RawUnitDef): boolean {
  return (u.attack ?? 0) > 0 && (u.maxHp ?? 0) > 0 && (u.moveSpeed ?? 0) > 0
}

/**
 * `unitPowerScore` only reads attack/maxHp/moveSpeed/attackRange/attackCooldownMs
 * (all present on `RawUnitDef`) — the cast is for `structureEffect`'s shape,
 * which the score never touches.
 */
function scoreOf(u: RawUnitDef): number {
  return unitPowerScore(u as unknown as Parameters<typeof unitPowerScore>[0])
}

// ── Flags ───────────────────────────────────────────────────────────────────

export interface BalanceFlag {
  part: 'unit' | 'spawner' | 'upgrade'
  cardName: string
  detail: string
}

interface CardsFile {
  templates: Record<string, RawUnitDef>
  cards: RawCardDef[]
}

function loadCardsFile(): CardsFile {
  return JSON.parse(readFileSync(CARDS_PATH, 'utf8')) as CardsFile
}

/**
 * Report-only balance check: every unit/spawner/upgrade card whose cost is
 * more than the tolerance off the formula. Mirrors rebalance_cards.py's three
 * passes but never mutates data — see `rewriteCardsJson` for that.
 */
export function checkBalance(data: CardsFile = loadCardsFile()): BalanceFlag[] {
  const { templates, cards } = data
  const flags: BalanceFlag[] = []

  // ── Unit cards: tier-median outlier check ──
  const cardCostForRef = new Map<string, number>()
  for (const card of cards) {
    if (card.cardType === 'unit' && card.unitRef) cardCostForRef.set(card.unitRef, card.cost)
  }

  const scoresByCost = new Map<number, Array<{ score: number; name: string }>>()
  for (const card of cards) {
    if (card.cardType !== 'unit') continue
    let stats: RawUnitDef | undefined
    if (card.unitRef) {
      const slug = card.unitRef
      if (templates[slug] && !isProtectedTemplate(slug)) stats = templates[slug]
    } else if (card.unit) {
      stats = card.unit
    }
    if (!stats || !isCombatUnit(stats)) continue

    const score = scoreOf(stats)
    const list = scoresByCost.get(card.cost) ?? []
    list.push({ score, name: card.name })
    scoresByCost.set(card.cost, list)
  }

  const tierMedians = new Map<number, number>()
  for (const [cost, entries] of scoresByCost) tierMedians.set(cost, median(entries.map(e => e.score)))

  for (const [cost, entries] of scoresByCost) {
    const target = tierMedians.get(cost) ?? 0
    if (target <= 0) continue
    for (const { score, name } of entries) {
      const deviation = Math.abs(score - target) / target
      if (deviation <= OUTLIER_THRESHOLD) continue
      const direction = score > target ? 'OVER' : 'UNDER'
      flags.push({
        part: 'unit',
        cardName: name,
        detail: `${direction} ${(score / target).toFixed(2)}x — cost ${cost}, formula→${formulaUnitCost(score)}, score=${score.toFixed(1)}, tier target=${target.toFixed(1)}`,
      })
    }
  }

  // ── Spawner structures ──
  for (const card of cards) {
    if (card.cardType !== 'structure') continue
    const se = card.unit?.structureEffect
    if (!se || se.type !== 'spawn') continue
    const spawnedRef = se.unitTemplateRef ?? ''
    const intervalMs = se.intervalMs ?? 10000
    const maxHp = card.unit?.maxHp ?? 20
    const current = card.cost

    let spawnedCost = cardCostForRef.get(spawnedRef)
    if (spawnedCost === undefined) {
      const t = templates[spawnedRef]
      if (!t) continue
      spawnedCost = formulaUnitCost(scoreOf(t))
    }

    const formulaCost = buildingFormulaCost(spawnedCost, intervalMs, maxHp)
    const diff = formulaCost - current
    if (Math.abs(diff) <= STRUCTURE_TOLERANCE) continue
    flags.push({
      part: 'spawner',
      cardName: card.name,
      detail: `current=${current} formula=${formulaCost} (spawns '${spawnedRef}' cost ${spawnedCost}, every ${Math.round(intervalMs / 1000)}s, hp=${maxHp}) diff=${diff > 0 ? '+' : ''}${diff}`,
    })
  }

  // ── Upgrade / buff cards ──
  for (const card of cards) {
    if (card.cardType !== 'upgrade') continue
    const ue = card.upgradeEffect
    if (!ue || !ue.type || !ue.amount) continue
    const formulaCost = upgradeFormulaCost(ue.type, ue.amount)
    const diff = formulaCost - card.cost
    if (Math.abs(diff) <= STRUCTURE_TOLERANCE) continue
    flags.push({
      part: 'upgrade',
      cardName: card.name,
      detail: `current=${card.cost} formula=${formulaCost} (${ue.type} ×${ue.amount}) diff=${diff > 0 ? '+' : ''}${diff}`,
    })
  }

  return flags
}

// ── Explicit rewrite mode (opt-in, never run by the checker) ────────────────

function rewriteCardsJson(): void {
  const data = loadCardsFile()
  const flags = checkBalance(data)
  // Only apply the same "diff ≤ 1 auto-applies, else flag for manual review"
  // rule the Python version used for spawner/upgrade costs. Unit stat nudging
  // (the Python version's adjust_stat) is deliberately not ported here — it
  // mutated template stats shared by other cards, which is a bigger, more
  // opinionated act than a mana-cost nudge and is not required by #2278's
  // acceptance criteria (a check, not an auto-fixer, for units).
  let applied = 0
  for (const card of data.cards) {
    if (card.cardType === 'structure') {
      const se = card.unit?.structureEffect
      if (!se || se.type !== 'spawn') continue
      const spawnedRef = se.unitTemplateRef ?? ''
      const spawnedCost = data.cards.find(c => c.unitRef === spawnedRef)?.cost
        ?? (data.templates[spawnedRef] ? formulaUnitCost(scoreOf(data.templates[spawnedRef])) : undefined)
      if (spawnedCost === undefined) continue
      const formulaCost = buildingFormulaCost(spawnedCost, se.intervalMs ?? 10000, card.unit?.maxHp ?? 20)
      if (Math.abs(formulaCost - card.cost) === 1) { card.cost = formulaCost; applied++ }
    } else if (card.cardType === 'upgrade' && card.upgradeEffect?.type && card.upgradeEffect.amount) {
      const formulaCost = upgradeFormulaCost(card.upgradeEffect.type, card.upgradeEffect.amount)
      if (Math.abs(formulaCost - card.cost) === 1) { card.cost = formulaCost; applied++ }
    }
  }
  writeFileSync(CARDS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`Rewrote ${applied} card cost(s) that were exactly 1 off formula.`)
  console.log(`${flags.length} flag(s) remain (including anything >1 off, which rewrite never auto-applies) — see \`npx tsx scripts/cardBalance.ts\` for the report.`)
}

function printReport(): void {
  const flags = checkBalance()
  for (const part of ['unit', 'spawner', 'upgrade'] as const) {
    const partFlags = flags.filter(f => f.part === part)
    console.log(`\n${part.toUpperCase()} flags: ${partFlags.length}`)
    for (const f of partFlags) console.log(`  [${f.cardName}] ${f.detail}`)
  }
  console.log(`\nTotal: ${flags.length}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--rewrite')) rewriteCardsJson()
  else printReport()
}
