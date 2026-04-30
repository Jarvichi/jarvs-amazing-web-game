import bossAIDefsRaw from '../../data/bossAIs.json'
import { Card, GameState } from '../types'
import { BASE_MAX_MANA } from './constants'
import { deployCard } from './cards'
import { getManaBonus } from './bonusEffects'
import { drawCard } from './helpers'
import { isPlayable } from './opponentAI'

// ─── Boss AI config types ──────────────────────────────────

interface BossAIPriority {
  cardType: 'unit' | 'structure' | 'upgrade'
  isWall?: boolean
  structureEffect?: 'spawn' | 'mana' | 'none' | string
  flying?: boolean
  nameIn?: string[]
  costGte?: number
  costLt?: number
  sortBy?: 'cost_asc' | 'cost_desc'
}

interface BossAIPhaseCondition {
  gameTimeGte?: number
  gameTimeLt?: number
  opponentFieldCountGte?: number
  wavePhaseEven?: boolean
}

interface BossAIPhase {
  condition: BossAIPhaseCondition | null
  priorities: BossAIPriority[]
  manaOverride?: number
  maxPlaysOverride?: number
  announceOnce?: string
}

export interface BossTraitMechanics {
  invulnerableDurationMs?: number
  landingDamage?: number
  landingRadiusTiles?: number
  stunDurationMs?: number
  waveDamage?: number
  wavePushTiles?: number
  pulseDamage?: number
  slowDurationMs?: number
  slowFactor?: number
  splitCount?: number
  hpDivisor?: number
  allMustDie?: boolean
  repositionTarget?: string
  landingTarget?: string
}

export interface BossTraitDef {
  name: string
  implemented: boolean
  trigger: string
  triggerHpPct?: number
  triggerHpPcts?: number[]
  triggerIntervalMs?: number
  triggerGameTimeMs?: number
  type: 'burrow' | 'fly' | 'split' | 'jump_aoe' | 'column_aoe'
  mechanics: BossTraitMechanics
  announceText: string
  landText?: string
  surfaceText?: string
  splitLog?: string
  fireText?: string
}

interface BossAIDef {
  id: string
  intervalMs: number
  idleMessage: string
  maxPlaysPerTurn: number
  openingLog: string[]
  phases: BossAIPhase[]
  trait?: BossTraitDef
}

const BOSS_AI_DEFS: BossAIDef[] = bossAIDefsRaw as BossAIDef[]
const BOSS_AI_MAP: Record<string, BossAIDef> = Object.fromEntries(BOSS_AI_DEFS.map(d => [d.id, d]))

export function getBossAIDef(id: string): BossAIDef | undefined {
  return BOSS_AI_MAP[id]
}


// ─── Generic Boss AI ──────────────────────────────────────

function matchesPriority(c: Card, p: BossAIPriority): boolean {
  if (c.cardType !== p.cardType) return false
  const u = c.unit
  if (p.isWall !== undefined && !!(u?.isWall) !== p.isWall) return false
  if (p.flying !== undefined && !!(u?.flying) !== p.flying) return false
  if (p.nameIn !== undefined && !p.nameIn.includes(c.name)) return false
  if (p.costGte !== undefined && c.cost < p.costGte) return false
  if (p.costLt !== undefined && c.cost >= p.costLt) return false
  if (p.structureEffect !== undefined) {
    if (p.structureEffect === 'none') {
      if (u?.structureEffect) return false
    } else {
      if (u?.structureEffect?.type !== p.structureEffect) return false
    }
  }
  return true
}

function sortByField(cards: Card[], sortBy?: string): Card[] {
  if (sortBy === 'cost_desc') return [...cards].sort((a, b) => b.cost - a.cost)
  if (sortBy === 'cost_asc')  return [...cards].sort((a, b) => a.cost - b.cost)
  return cards
}

function phaseMatches(cond: BossAIPhaseCondition | null, s: GameState): boolean {
  if (cond === null) return true
  if (cond.gameTimeGte !== undefined && s.gameTime < cond.gameTimeGte) return false
  if (cond.gameTimeLt  !== undefined && s.gameTime >= cond.gameTimeLt) return false
  if (cond.opponentFieldCountGte !== undefined) {
    const count = s.field.filter(u => u.owner === 'opponent' && !u.isWall).length
    if (count < cond.opponentFieldCountGte) return false
  }
  if (cond.wavePhaseEven !== undefined) {
    const isEven = Math.floor(s.gameTime / 20000) % 2 === 0
    if (isEven !== cond.wavePhaseEven) return false
  }
  return true
}

export function genericBossAI(s: GameState, log: string[], def: BossAIDef): void {
  const manaBonus = getManaBonus(s.field, 'opponent')
  const phase = def.phases.find(p => phaseMatches(p.condition, s)) ?? def.phases[def.phases.length - 1]

  // Announce once when a timed phase is first entered (within the first second of the trigger)
  if (phase.announceOnce && phase.condition?.gameTimeGte !== undefined) {
    const t = phase.condition.gameTimeGte
    if (s.gameTime >= t && s.gameTime < t + 1000) {
      log.push('!!' + phase.announceOnce)
    }
  }

  // Floor mana to the most expensive card in hand so boss can always play its signature cards
  const maxHandCost = s.opponentHand.reduce((m, c) => Math.max(m, c.cost), 0)
  let mana = phase.manaOverride ?? Math.min(10, Math.max(BASE_MAX_MANA, maxHandCost) + manaBonus)
  const maxPlays = phase.maxPlaysOverride ?? def.maxPlaysPerTurn

  function tryPlay(): boolean {
    const hand = s.opponentHand.filter(c => c.cost <= mana && isPlayable(c, s.gameTime))
    if (hand.length === 0) return false
    for (const priority of phase.priorities) {
      const candidates = sortByField(hand.filter(c => matchesPriority(c, priority)), priority.sortBy)
      const pick = candidates[0]
      if (!pick) continue
      s.opponentHand.splice(s.opponentHand.indexOf(pick), 1)
      mana -= pick.cost
      deployCard(s, pick, 'opponent', log)
      drawCard(s.opponentDeck, s.opponentHand)
      return true
    }
    return false
  }

  let played = 0
  while (played < maxPlays && tryPlay()) played++
  if (played === 0) log.push(def.idleMessage)
}

