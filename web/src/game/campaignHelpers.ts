import { QuestNode, Act, ReplayModifier } from './questline'
import { NewGameOptions, MAX_HANDICAP } from './engine'

export const HANDICAP_KEY = 'jarvs_handicap'

export function loadHandicap(): number {
  try {
    const v = localStorage.getItem(HANDICAP_KEY)
    if (v !== null) return Math.min(MAX_HANDICAP, Math.max(0, parseInt(v, 10)))
  } catch { /* ignore */ }
  return 0
}

/**
 * Compute the NewGameOptions fields that depend on node data, act modifiers,
 * and the player's run count. Run count drives a scaling handicap reduction
 * so repeat runs get a bit easier:
 *
 *   run 1 → handicap 7, HP 82
 *   run 2 → handicap 5, HP 92
 *   run 3 → handicap 3, HP 102
 *   run 4 → handicap 1, HP 112
 *   run 5+ → handicap 0, HP 122+
 */
export function resolvedNodeOpts(
  node: QuestNode,
  act: Act | undefined,
  runCount: number,
  modifiers: ReplayModifier[],
): Omit<NewGameOptions, 'playerCards'> {
  const extra = Math.max(0, runCount - 1)
  const handicapReduction = Math.min(extra * 2, MAX_HANDICAP)

  // Stack modifier values
  let hpPctBonus = 0
  let intervalReduction = 0
  let handBonus = 0
  for (const m of modifiers) {
    if (m.type === 'enemyHpPercent') hpPctBonus += m.value
    if (m.type === 'enemyIntervalReduction') intervalReduction += m.value
    if (m.type === 'enemyHandBonus') handBonus += m.value
  }

  const adjustedHandicap = Math.max(0, (node.handicap ?? 0) - handicapReduction)
  // Boss default HP is 95; non-boss 82 (mirrors engine.ts defaults)
  const defaultHp = node.bossAI ? 95 : 82
  const baseHp = node.opponentBaseHp ?? defaultHp
  const adjustedHp = Math.round(baseHp * (1 + hpPctBonus / 100))

  // When a modifier reduces interval, fall back to 4000ms base if node didn't specify one
  const baseInterval = node.opponentIntervalMs ?? (intervalReduction > 0 ? 4000 : undefined)
  const adjustedInterval = baseInterval !== undefined
    ? Math.max(1000, baseInterval - intervalReduction)
    : undefined

  // Boss shockwave kill pct: starts at 50%, increases by 10% per run, capped at 100%
  const bossSpawnKillPct = node.bossAI
    ? Math.min(1.0, 0.5 + (runCount - 1) * 0.1)
    : undefined

  return {
    opponentHandicap: adjustedHandicap,
    bossAI: node.bossAI,
    bossCard: node.bossCard,
    bossName: node.bossName,
    bossHpMultiplier: node.bossHpMultiplier,
    enemyDeckNames: node.enemyDeck,
    terrainSeed: node.id,
    environment: node.environment ?? act?.environment,
    opponentIntervalMs: adjustedInterval,
    opponentBaseHp: adjustedHp,
    opponentStartCards: handBonus,
    bossSpawnKillPct,
  }
}
