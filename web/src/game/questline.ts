import { CardRarity } from './types'
import { logError } from '../logger'
import { getCardCatalog } from './cards'
import act1Data from '../data/acts/act1.json'
import act2Data from '../data/acts/act2.json'
import act3Data from '../data/acts/act3.json'
import act4Data from '../data/acts/act4.json'
import act5Data from '../data/acts/act5.json'
import act6Data from '../data/acts/act6.json'
import act7Data from '../data/acts/act7.json'
import act8Data  from '../data/acts/act8.json'
import act9Data  from '../data/acts/act9.json'
import act10Data from '../data/acts/act10.json'
import consumablesData from '../data/consumables.json'

// ─── Consumables ──────────────────────────────────────────

export interface ConsumableDef {
  id: string
  name: string
  icon: string
  desc: string
  lore: string
  healAmount?: number
  livesAmount?: number
  price: number
}

export const ALL_CONSUMABLES: ConsumableDef[] = consumablesData as ConsumableDef[]

export interface RunConsumable {
  id: string
  count: number
}

const CONSUMABLE_STASH_KEY = 'jarv_consumable_stash'

export function loadConsumableStash(): RunConsumable[] {
  try { return JSON.parse(localStorage.getItem(CONSUMABLE_STASH_KEY) ?? '[]') }
  catch { return [] }
}

export function saveConsumableStash(stash: RunConsumable[]): void {
  try { localStorage.setItem(CONSUMABLE_STASH_KEY, JSON.stringify(stash)) }
  catch (e) { logError('saveConsumableStash failed', { error: String(e) }) }
}

export function addToConsumableStash(id: string, count = 1): void {
  const stash = loadConsumableStash()
  const existing = stash.find(c => c.id === id)
  if (existing) {
    existing.count += count
  } else {
    stash.push({ id, count })
  }
  saveConsumableStash(stash)
}

/** Read the active run's consumables from localStorage without touching the stash. */
export function loadRunConsumables(): RunConsumable[] {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RunState
    return Array.isArray(parsed.consumables) ? parsed.consumables : []
  } catch {
    return []
  }
}

/** Drain the stash into a run's consumables list and clear the stash. */
function drainStashIntoRun(consumables: RunConsumable[]): RunConsumable[] {
  const stash = loadConsumableStash()
  if (stash.length === 0) return consumables
  const merged = [...consumables]
  for (const s of stash) {
    const existing = merged.find(c => c.id === s.id)
    if (existing) {
      existing.count += s.count
    } else {
      merged.push({ ...s })
    }
  }
  saveConsumableStash([])
  return merged
}

/** Apply a consumable to a run, returning the updated run (or null if not found). */
export function useConsumable(run: RunState, id: string): RunState | null {
  const idx = run.consumables.findIndex(c => c.id === id && c.count > 0)
  if (idx === -1) return null
  const def = ALL_CONSUMABLES.find(c => c.id === id)
  if (!def) return null

  const consumables = run.consumables.map((c, i) =>
    i === idx ? { ...c, count: c.count - 1 } : c
  ).filter(c => c.count > 0)

  let playerHp = run.playerHp
  let livesRemaining = run.livesRemaining
  let maxLives = run.maxLives

  if (def.healAmount) {
    playerHp = Math.min(run.maxHp, run.playerHp + def.healAmount)
  }
  if (def.livesAmount) {
    const newMax = Math.min(LIVES_MAX, run.maxLives + def.livesAmount)
    livesRemaining = Math.min(newMax, run.livesRemaining + def.livesAmount)
    maxLives = newMax
  }

  return { ...run, consumables, playerHp, livesRemaining, maxLives }
}

// ─── Replay modifier types ────────────────────────────────

export type ReplayModifierType =
  | 'enemyHpPercent'       // % increase applied to opponent base HP
  | 'enemyIntervalReduction' // ms reduction to opponent play interval (faster AI)
  | 'enemyHandBonus'       // opponent starts with N extra cards in hand
  | 'crystalBonus'         // extra crystals awarded after every battle

export interface ReplayModifier {
  type: ReplayModifierType
  value: number
  label: string            // short display string, e.g. "+15% enemy HP"
}

// ─── Node & Act types ─────────────────────────────────────

export type NodeType = 'battle' | 'elite' | 'boss' | 'rest' | 'event' | 'merchant'

export interface QuestNode {
  id: string
  type: NodeType
  label: string
  description: string
  row: number        // 0 = start row; increases toward boss
  col: number        // column index within this row
  rowCols: number    // total columns in this row (for layout)
  parentIds: string[]
  childIds: string[]
  handicap?: number  // opponent handicap for battle/elite/boss
  restHeal?: number  // HP healed at rest nodes
  bossAI?: string        // 'thornlord' etc. — triggers a specific boss AI
  bossCard?: string      // card name to deploy when opponent base falls (phase 2)
  bossName?: string      // display name for the boss (overrides bossCard name in UI)
  bossHpMultiplier?: number  // multiplier applied to boss card unit's HP (default 10)
  eventConfig?: NodeEventConfig
  bossDialogue?: string[]  // lines the boss speaks before the fight
  /** Preset enemy deck — card names in order. Makes each node deterministic and learnable. */
  enemyDeck?: string[]
  /** Visual background theme for this node's battlefield ('forest' | 'ruins' | 'camp' | 'citadel' | 'ashen'). */
  environment?: string
  /** Override opponent play interval (ms). Replaces handicap-derived default. */
  opponentIntervalMs?: number
  /** Override opponent base HP. Replaces engine default (95 for bosses, 82 for others). */
  opponentBaseHp?: number
}

// ─── Event system ─────────────────────────────────────────

export type EventEffect =
  | { type: 'healHp';          amount: number }
  | { type: 'damageHp';        amount: number }
  | { type: 'gainCrystals';    amount: number }
  | { type: 'gainCard';        rarity: CardRarity }
  | { type: 'gainItem';        itemId?: string }
  | { type: 'gainLife';        amount: number }
  | { type: 'nothing' }

export interface EventChoice {
  label: string        // short action label e.g. "Leave an offering"
  consequence: string  // what the player sees as outcome e.g. "Heal 8 HP"
  effect: EventEffect
}

export interface EventData {
  id: string
  title: string
  description: string
  choices: EventChoice[]
}

/**
 * Per-node event configuration embedded in the act JSON.
 * When present, overrides any eventId lookup so that each node can have
 * its own title, description, and choice pools.
 */
export interface NodeEventConfig {
  title: string
  description: string
  /** One pool per choice slot; one entry is randomly picked from each pool. */
  pools: EventChoice[][]
}

/** Builds an EventData from an inline NodeEventConfig. */
export function generateEventFromConfig(id: string, config: NodeEventConfig): EventData {
  return {
    id,
    title:       config.title,
    description: config.description,
    choices:     config.pools.map(pool => pickRandom(pool)),
  }
}

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// ─── Merchant ─────────────────────────────────────────────

export const MERCHANT_PRICES: Record<CardRarity, number> = {
  common:    40,
  uncommon:  90,
  rare:      200,
  legendary: 400,
}

/** Generates 3 card names for a merchant node: 1 common, 1 uncommon, 1 rare (shuffled). */
export function generateMerchantCards(): string[] {
  const catalog = getCardCatalog()
  const pool    = (r: CardRarity) => catalog.filter(c => c.rarity === r)
  const pick    = (r: CardRarity) => {
    const p = pool(r)
    return p[Math.floor(Math.random() * p.length)].name
  }
  const cards = [pick('common'), pick('uncommon'), pick('rare')]
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

// ─── Cutscene & dialogue ──────────────────────────────────

export interface CutscenePanel {
  title: string
  text: string
}

// ─── Intro rule system ────────────────────────────────────

/** Matches a run count against a simple condition. */
export interface RuleCondition {
  op: 'eq' | 'gte' | 'range'
  value?: number   // used by 'eq' and 'gte'
  min?: number     // used by 'range'
  max?: number     // used by 'range'
}

/**
 * A single rule in an act's intro rule set.
 * `panels` title/text may contain substitution tags — see resolveActIntro.
 */
export interface IntroRule {
  condition: RuleCondition
  panels: CutscenePanel[]
}

export interface Act {
  id: string
  title: string
  subtitle: string
  nodes: Record<string, QuestNode>
  startNodeIds: string[]
  rewardRelic: string
  rewardRelicDesc: string
  /** Visual environment theme — drives battlefield background CSS class and terrain types. */
  environment?: string
  /** Card tags that appear as rewards in this act (e.g. "forest", "citadel"). Empty = all cards eligible. */
  rewardTags?: string[]
  intro?: CutscenePanel[]   // shown on run 1 (fallback when no rule matches)
  outro?: CutscenePanel[]   // shown every time the boss is defeated

  /**
   * Named string arrays for seeded random picks.
   * Referenced in panel text/title via {pool:name:seedOffset}.
   */
  variantPools?: Record<string, string[]>

  /**
   * Template strings for dynamic mid-run opening lines.
   * May contain {n} and {ordinalLower}. Selected via n % length.
   * Referenced in panel text via {midRunTemplate}.
   */
  midRunTemplates?: string[]

  /**
   * Ordered list of run-count rules. The first matching rule's panels are shown.
   * Falls back to `intro` if no rule matches (i.e. run 1).
   */
  introRules?: IntroRule[]

  /** The actId that follows this one in the campaign, if any. */
  nextActId?: string

  /**
   * Music track IDs for different contexts in this act.
   * References keys in MUSIC_TRACKS from sound.ts.
   * Falls back to the global default if omitted.
   */
  mapMusicId?: string
  battleMusicId?: string
  bossMusicId?: string

  /**
   * Ordered list of modifiers applied on successive replays.
   * Modifier[0] activates on replay 2, modifier[1] on replay 3, etc.
   * All modifiers up to the current replay index stack additively.
   */
  replayModifiers?: ReplayModifier[]
}

// ─── Run counter ──────────────────────────────────────────

const RUN_COUNT_KEY = 'jarv_run_count'

export function loadRunCount(): number {
  try { return parseInt(localStorage.getItem(RUN_COUNT_KEY) ?? '0', 10) || 0 }
  catch { return 0 }
}

export function incrementRunCount(): number {
  const next = loadRunCount() + 1
  try { localStorage.setItem(RUN_COUNT_KEY, String(next)) } catch { /* ignore */ }
  return next
}

// ─── Per-act completion counter ───────────────────────────

const ACT_COUNTS_KEY = 'jarv_act_counts'

function loadActCounts(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(ACT_COUNTS_KEY) ?? '{}') as Record<string, number> }
  catch { return {} }
}

/** How many times the player has completed this act. */
export function loadActCount(actId: string): number {
  return loadActCounts()[actId] ?? 0
}

/** Increment the completion count for an act and return the new value. */
export function incrementActCount(actId: string): number {
  const counts = loadActCounts()
  counts[actId] = (counts[actId] ?? 0) + 1
  try { localStorage.setItem(ACT_COUNTS_KEY, JSON.stringify(counts)) } catch { /* ignore */ }
  return counts[actId]
}

/** Returns the stacked modifiers active for replay N (1-indexed completions). */
export function getActiveModifiers(act: Act, completionCount: number): ReplayModifier[] {
  if (!act.replayModifiers || completionCount === 0) return []
  // modifier[i] activates from replay i+2 onward, stacking with all prior
  return act.replayModifiers.slice(0, completionCount)
}

/** Returns modifiers by explicit count rather than completion count — used when player has chosen a tier. */
export function getModifiersByCount(act: Act, count: number): ReplayModifier[] {
  if (!act.replayModifiers || count <= 0) return []
  return act.replayModifiers.slice(0, count)
}

/** Returns the total number of replay modifiers defined for an act. */
export function getModifierMax(act: Act): number {
  return act.replayModifiers?.length ?? 0
}

// ─── Intro seen-tracking ──────────────────────────────────

const SEEN_INTROS_KEY = 'jarv_seen_intros'

export function hasSeenIntro(actId: string): boolean {
  try { return (JSON.parse(localStorage.getItem(SEEN_INTROS_KEY) ?? '[]') as string[]).includes(actId) }
  catch { return false }
}

export function markIntroSeen(actId: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_INTROS_KEY) ?? '[]') as string[]
    if (!seen.includes(actId)) localStorage.setItem(SEEN_INTROS_KEY, JSON.stringify([...seen, actId]))
  } catch { /* ignore */ }
}

// ─── Intro rule engine ────────────────────────────────────

/** Seeded pseudo-random — stable per (runCount, offset) pair. */
function seededPick<T>(arr: T[], n: number, offset = 0): T {
  const x = Math.sin(n * 127.1 + offset * 311.7) * 43758.5453123
  return arr[Math.floor((x - Math.floor(x)) * arr.length)]
}

function matchesCondition(cond: RuleCondition, n: number): boolean {
  switch (cond.op) {
    case 'eq':    return n === cond.value
    case 'gte':   return n >= (cond.value ?? 0)
    case 'range': return n >= (cond.min ?? 0) && n <= (cond.max ?? Infinity)
  }
}

/**
 * Substitutes tags in a template string:
 *   {pool:name:offset}  → seeded pick from act.variantPools[name]
 *   {midRunTemplate}    → entry from act.midRunTemplates at n % length, with {n}/{ordinalLower} resolved
 *   {ORDINAL}           → ordinalWord(n), e.g. "FIFTH"
 *   {ordinalLower}      → ordinalWord(n).toLowerCase(), e.g. "fifth"
 *   {n}                 → run count as a number
 */
function resolvePlaceholders(template: string, n: number, act: Act): string {
  const ordinal = ordinalWord(n)
  const pools   = act.variantPools    ?? {}
  const midTmpl = act.midRunTemplates ?? []

  return template
    .replace(/{ORDINAL}/g,      ordinal)
    .replace(/{ordinalLower}/g, ordinal.toLowerCase())
    .replace(/{n}/g,            String(n))
    .replace(/{midRunTemplate}/g, () => {
      if (midTmpl.length === 0) return ''
      return midTmpl[n % midTmpl.length]
        .replace(/{ORDINAL}/g,      ordinal)
        .replace(/{ordinalLower}/g, ordinal.toLowerCase())
        .replace(/{n}/g,            String(n))
    })
    .replace(/{pool:([^:}]+):(\d+)}/g, (_, poolName, offsetStr) => {
      const pool = pools[poolName] ?? []
      if (pool.length === 0) return ''
      return seededPick(pool, n, parseInt(offsetStr, 10))
    })
}

/**
 * Returns the intro panels for an act based on run count.
 * Uses act.introRules (data-driven); falls back to act.intro for run 1.
 * Generic — new acts need only JSON, no new TypeScript.
 */
export function resolveActIntro(act: Act, n: number): CutscenePanel[] {
  if (n <= 1 || !act.introRules?.length) return act.intro ?? []
  const rule = act.introRules.find(r => matchesCondition(r.condition, n))
  if (!rule) return act.intro ?? []
  return rule.panels.map(p => ({
    title: resolvePlaceholders(p.title, n, act),
    text:  resolvePlaceholders(p.text,  n, act),
  }))
}

/** Thin wrapper for backward compatibility — new code should call resolveActIntro directly. */
export function getAct1Intro(runCount: number): CutscenePanel[] {
  return resolveActIntro(ACT_1, runCount)
}

// ─── Ordinal helper ───────────────────────────────────────────────────────────
function ordinalWord(n: number): string {
  const words: Record<number, string> = {
    5:  'FIFTH',    6:  'SIXTH',     7:  'SEVENTH',    8: 'EIGHTH',
    9:  'NINTH',   10: 'TENTH',     11: 'ELEVENTH',   12: 'TWELFTH',
    13: 'THIRTEENTH', 14: 'FOURTEENTH', 15: 'FIFTEENTH', 16: 'SIXTEENTH',
    17: 'SEVENTEENTH', 18: 'EIGHTEENTH', 19: 'NINETEENTH', 20: 'TWENTIETH',
    21: 'TWENTY-FIRST', 22: 'TWENTY-SECOND', 23: 'TWENTY-THIRD',
    24: 'TWENTY-FOURTH', 30: 'THIRTIETH', 40: 'FORTIETH',
  }
  if (words[n]) return words[n]
  const suffix = (n % 10 === 1 && n % 100 !== 11) ? 'ST'
               : (n % 10 === 2 && n % 100 !== 12) ? 'ND'
               : (n % 10 === 3 && n % 100 !== 13) ? 'RD'
               : 'TH'
  return `${n}${suffix}`
}

// ─── Run state ────────────────────────────────────────────

export interface RunState {
  actId: string
  completedNodeIds: string[]
  skippedNodeIds: string[]     // nodes in branches the player didn't take
  pendingNodeId: string | null // node currently in battle
  pendingActComplete?: boolean // true while waiting on the act-complete screen (survives page refresh)
  playerHp: number
  maxHp: number
  livesRemaining: number       // attempts left before run fails (3 at run start; resets to 3 at act end)
  maxLives: number             // upper cap for livesRemaining (starts 3, relics/events can raise up to 9)
  cardPlayCounts: Record<string, number>  // cumulative plays per card name this act
  nodeFailCounts: Record<string, number>  // times each node has been lost
  earnedCards: string[]        // card names won as battle rewards this run (usable in subsequent battles)
  activeRelic: string | null   // name of the relic earned at the end of the last act (null = none)
  crystalBonus: number         // extra crystals awarded after each battle (from replay modifiers)
  consumables: RunConsumable[] // consumable items held during this run
  activeModifierCount: number  // how many replay modifiers from the act's list are active this run
}

const RUN_KEY = 'jarv_run'

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RunState

    // ── Validate and repair ────────────────────────────────────────────────────
    // Ensure required fields exist (migrate old saves)
    if (!parsed.cardPlayCounts) parsed.cardPlayCounts = {}
    if (!parsed.nodeFailCounts) parsed.nodeFailCounts = {}
    if (!Array.isArray(parsed.completedNodeIds)) parsed.completedNodeIds = []
    if (!Array.isArray(parsed.skippedNodeIds)) parsed.skippedNodeIds = []
    if (!Array.isArray(parsed.earnedCards)) parsed.earnedCards = []
    if ((parsed as { activeRelic?: unknown }).activeRelic === undefined) parsed.activeRelic = null
    if (typeof parsed.playerHp !== 'number' || isNaN(parsed.playerHp)) parsed.playerHp = 50
    if (typeof parsed.maxHp !== 'number' || isNaN(parsed.maxHp) || parsed.maxHp <= 0) parsed.maxHp = 50
    parsed.playerHp = Math.max(1, Math.min(parsed.maxHp, parsed.playerHp))
    // Migrate: lives system (added later — default 3/3 for old saves)
    if (typeof parsed.crystalBonus !== 'number') parsed.crystalBonus = 0
    if (!Array.isArray(parsed.consumables)) parsed.consumables = []
    parsed.consumables = drainStashIntoRun(parsed.consumables)
    if (typeof parsed.activeModifierCount !== 'number') parsed.activeModifierCount = 0
    if (typeof parsed.maxLives !== 'number' || parsed.maxLives < 1) parsed.maxLives = 3
    if (typeof parsed.livesRemaining !== 'number') parsed.livesRemaining = parsed.maxLives
    parsed.livesRemaining = Math.max(0, Math.min(parsed.maxLives, parsed.livesRemaining))

    // Ensure actId is valid
    const act = ACTS[parsed.actId]
    if (!act) {
      console.warn('[run] Invalid actId — clearing run')
      localStorage.removeItem(RUN_KEY)
      return null
    }

    // Remove any node IDs that don't exist in the act
    const validIds = new Set(Object.keys(act.nodes))
    parsed.completedNodeIds = parsed.completedNodeIds.filter(id => validIds.has(id))
    parsed.skippedNodeIds   = parsed.skippedNodeIds.filter(id => validIds.has(id))
    if (parsed.pendingNodeId && !validIds.has(parsed.pendingNodeId)) {
      parsed.pendingNodeId = null
    }

    // If act is already complete with no pendingNode, clear run so a fresh one starts —
    // unless pendingActComplete is set, which means the player is on the act-complete
    // screen and hasn't clicked Continue yet (e.g. they refreshed the page mid-transition).
    if (isActComplete(act, parsed) && !parsed.pendingNodeId && !parsed.pendingActComplete) {
      console.warn('[run] Act already complete — clearing stale run')
      localStorage.removeItem(RUN_KEY)
      return null
    }

    return parsed
  } catch {
    // Corrupt JSON — clear and start fresh
    try { localStorage.removeItem(RUN_KEY) } catch { /* ignore */ }
    return null
  }
}

export function saveRun(run: RunState): void {
  try { localStorage.setItem(RUN_KEY, JSON.stringify(run)) }
  catch (e) { logError('saveRun failed', { actId: run.actId, error: String(e) }) }
}

export function clearRun(): void {
  // Return any unused consumables to the stash so they aren't lost when a run ends.
  const raw = localStorage.getItem(RUN_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RunState
      if (Array.isArray(parsed.consumables)) {
        for (const c of parsed.consumables) {
          if (c.count > 0) addToConsumableStash(c.id, c.count)
        }
      }
    } catch { /* ignore — run data is being cleared anyway */ }
  }
  localStorage.removeItem(RUN_KEY)
}

const LAST_RUN_FAILED_KEY = 'jarv_last_run_failed'

export function setLastRunFailed(): void {
  try { localStorage.setItem(LAST_RUN_FAILED_KEY, '1') } catch { /* ignore */ }
}

export function loadLastRunFailed(): boolean {
  try { return localStorage.getItem(LAST_RUN_FAILED_KEY) === '1' }
  catch { return false }
}

export function clearLastRunFailed(): void {
  localStorage.removeItem(LAST_RUN_FAILED_KEY)
}

export const LIVES_START = 3
export const LIVES_MAX   = 9

export function newRun(actId: string, activeModifierCount = 0): RunState {
  return {
    actId,
    completedNodeIds: [],
    skippedNodeIds: [],
    pendingNodeId: null,
    playerHp: 50,
    maxHp: 50,
    livesRemaining: LIVES_START,
    maxLives: LIVES_START,
    cardPlayCounts: {},
    nodeFailCounts: {},
    earnedCards: [],
    activeRelic: null,
    crystalBonus: 0,
    consumables: drainStashIntoRun([]),
    activeModifierCount,
  }
}

// ─── Card Fatigue ─────────────────────────────────────────

const FATIGUED_KEY = 'jarv_fatigued'

export function loadFatigued(): string[] {
  try { return JSON.parse(localStorage.getItem(FATIGUED_KEY) ?? '[]') }
  catch { return [] }
}

export function saveFatigued(names: string[]): void {
  try { localStorage.setItem(FATIGUED_KEY, JSON.stringify(names)) }
  catch (e) { logError('saveFatigued failed', { error: String(e) }) }
}

export function clearFatigued(): void {
  localStorage.removeItem(FATIGUED_KEY)
}

/** Returns the top N most-played card names from a run's cardPlayCounts. */
export function getTopPlayedCards(counts: Record<string, number>, n = 3): string[] {
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([name]) => name)
}

// ─── Map logic ────────────────────────────────────────────

/**
 * Returns the IDs of nodes the player can currently select.
 * A node is available if it is not done and at least one parent is completed.
 * Start nodes (no parents) are available only at the very beginning.
 */
export function getAvailableNodeIds(act: Act, run: RunState): string[] {
  const completed = new Set(run.completedNodeIds)
  const skipped   = new Set(run.skippedNodeIds)
  const done      = new Set([...completed, ...skipped])

  return Object.values(act.nodes)
    .filter(node => {
      if (done.has(node.id))           return false
      if (node.id === run.pendingNodeId) return false
      if (node.parentIds.length === 0)   return completed.size === 0
      return node.parentIds.some(pid => completed.has(pid))
    })
    .map(n => n.id)
}

/**
 * When the player picks one node from a set of sibling options, the others
 * in the same parent→children group get marked as skipped.
 */
export function skipSiblings(act: Act, chosenId: string, run: RunState): RunState {
  const node = act.nodes[chosenId]
  const siblings: string[] = []
  for (const pid of node.parentIds) {
    const parent = act.nodes[pid]
    for (const cid of parent.childIds) {
      if (cid !== chosenId && !run.completedNodeIds.includes(cid) && !run.skippedNodeIds.includes(cid)) {
        siblings.push(cid)
      }
    }
  }
  if (siblings.length === 0) return run
  return { ...run, skippedNodeIds: [...run.skippedNodeIds, ...siblings] }
}

export function isActComplete(act: Act, run: RunState): boolean {
  const completed = new Set(run.completedNodeIds)
  return Object.values(act.nodes).some(n => n.type === 'boss' && completed.has(n.id))
}

// ─── Card reward generation ───────────────────────────────

/**
 * Returns 3 card names as reward options based on node type:
 * battle → 2 commons + 1 uncommon
 * elite  → 1 uncommon + 2 rares
 * boss   → 1 rare + 1 legendary + 1 uncommon
 */
/**
 * Generate card reward choices after a battle.
 * @param nodeType  battle | elite | boss — determines rarity pool and choice count
 * @param actTags   Optional act reward tags (e.g. ["forest"]). When provided,
 *                  cards matching any tag get a 3× weight boost so themed cards
 *                  surface more often. Falls back to any card if pool is empty.
 */
export function generateRewardChoices(nodeType: NodeType, actTags?: string[]): string[] {
  const catalog = getCardCatalog()

  // Weighted pool: act-themed cards appear 3× as often
  function pool(r: CardRarity): string[] {
    const base = catalog.filter(c => c.rarity === r)
    if (!actTags?.length) return base.map(c => c.name)
    const weighted: string[] = []
    for (const c of base) {
      const cardTags: string[] = (c as unknown as { tags?: string[] }).tags ?? []
      const boost = cardTags.some(t => actTags.includes(t)) ? 3 : 1
      for (let i = 0; i < boost; i++) weighted.push(c.name)
    }
    return weighted.length ? weighted : base.map(c => c.name)
  }

  function pick(r: CardRarity): string {
    const p = pool(r)
    return p[Math.floor(Math.random() * p.length)]
  }

  // battle = 1 choice; elite = 3 choices skewed rare; boss = 3 choices skewed legendary
  const rawChoices: string[] =
    nodeType === 'boss'  ? [pick('rare'), pick('legendary'), pick('rare')]
    : nodeType === 'elite' ? [pick('uncommon'), pick('rare'), pick('rare')]
    :                        [pick('common')]  // single card for regular battles

  // Deduplicate
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const name of rawChoices) {
    if (!seen.has(name)) { seen.add(name); deduped.push(name) }
    else {
      const rarity = catalog.find(c => c.name === name)?.rarity ?? 'common'
      const fallback = catalog.filter(c => c.rarity === rarity && !seen.has(c.name))[0]
      if (fallback) { seen.add(fallback.name); deduped.push(fallback.name) }
      else deduped.push(name)
    }
  }
  return deduped
}

/** Rarity pool for each wave completed in endless mode. Rarity escalates with wave number. */
function endlessRewardRarities(wave: number): CardRarity[] {
  if (wave >= 8) return ['legendary', 'legendary', 'legendary']
  if (wave >= 7) return ['legendary', 'legendary', 'rare']
  if (wave >= 6) return ['legendary', 'rare', 'rare']
  if (wave >= 5) return ['rare', 'rare', 'rare']
  if (wave >= 4) return ['rare', 'rare', 'uncommon']
  if (wave >= 3) return ['rare', 'uncommon', 'uncommon']
  if (wave >= 2) return ['uncommon', 'common', 'common']
  return ['common', 'common', 'common']
}

export function generateEndlessRewardChoices(wave: number): string[] {
  const catalog = getCardCatalog()
  const rarities = endlessRewardRarities(wave)

  function pick(r: CardRarity): string {
    const pool = catalog.filter(c => c.rarity === r)
    return pool[Math.floor(Math.random() * pool.length)].name
  }

  const seen = new Set<string>()
  const choices: string[] = []
  for (const r of rarities) {
    let name = pick(r)
    // Avoid duplicates — try once more then give up
    if (seen.has(name)) {
      const fallback = catalog.filter(c => c.rarity === r && !seen.has(c.name))[0]
      if (fallback) name = fallback.name
    }
    seen.add(name)
    choices.push(name)
  }
  return choices
}

// ─── Acts ─────────────────────────────────────────────────

export const ACT_1: Act = act1Data as Act
export const ACT_2: Act = act2Data as Act
export const ACT_3: Act = act3Data as Act
export const ACT_4: Act = act4Data as Act
export const ACT_5: Act = act5Data as Act
export const ACT_6: Act = act6Data as Act
export const ACT_7: Act = act7Data as Act
export const ACT_8:  Act = act8Data  as Act
export const ACT_9:  Act = act9Data  as Act
export const ACT_10: Act = act10Data as Act

export const ACTS: Record<string, Act> = {
  act1:  ACT_1,
  act2:  ACT_2,
  act3:  ACT_3,
  act4:  ACT_4,
  act5:  ACT_5,
  act6:  ACT_6,
  act7:  ACT_7,
  act8:  ACT_8,
  act9:  ACT_9,
  act10: ACT_10,
}

// ─── Node history (persistent across runs) ───────────────

const NODE_HISTORY_KEY = 'jarv_node_history'

/**
 * Returns the set of "{actId}:{nodeId}" strings for nodes the player has
 * completed at least once across all runs.  Used by the node-peek modal to
 * decide whether to reveal the opponent's deck.
 */
export function loadNodeHistory(): Set<string> {
  try {
    const raw = localStorage.getItem(NODE_HISTORY_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch { return new Set() }
}

/** Record that the player has finished this node (persists forever). */
export function recordNodeComplete(actId: string, nodeId: string): void {
  try {
    const history = loadNodeHistory()
    const key = `${actId}:${nodeId}`
    if (history.has(key)) return   // already recorded — skip the write
    history.add(key)
    localStorage.setItem(NODE_HISTORY_KEY, JSON.stringify([...history]))
  } catch { /* ignore */ }
}

/** Returns the act that follows this one in the campaign, or null if it's the last. */
export function getNextAct(actId: string): Act | null {
  const order = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6']
  const idx = order.indexOf(actId)
  if (idx < 0 || idx === order.length - 1) return null
  return ACTS[order[idx + 1]] ?? null
}

// ─── Player character ─────────────────────────────────────────────────────────

const PLAYER_NAME_KEY   = 'jarv_player_name'
const PLAYER_AVATAR_KEY    = 'jarv_player_avatar'
const UNLOCKED_AVATARS_KEY = 'jarv_unlocked_avatars'

/** Base avatars always available; streak avatars are unlocked via achievements. */
export const BASE_AVATAR_SLUGS   = ['jarv', 'jarv-red', 'jarv-green', 'jarv-gold'] as const
export const STREAK_AVATAR_SLUGS = [
  'streak-iron', 'streak-flame', 'streak-shadow', 'streak-dragon',
  'streak-celestial', 'streak-void', 'streak-crystal', 'streak-fracture',
] as const
export const AVATAR_SLUGS = [...BASE_AVATAR_SLUGS, ...STREAK_AVATAR_SLUGS] as const
export type AvatarSlug = typeof AVATAR_SLUGS[number]

export const STREAK_AVATAR_LABELS: Record<string, string> = {
  'streak-iron':      'Iron Wanderer',
  'streak-flame':     'Flame Walker',
  'streak-shadow':    'Shadow Lord',
  'streak-dragon':    'Dragon Rider',
  'streak-celestial': 'Celestial Guardian',
  'streak-void':      'Void Master',
  'streak-crystal':   'Crystal Champion',
  'streak-fracture':  'Fracture Lord',
}

export function loadUnlockedAvatars(): string[] {
  try {
    const raw = localStorage.getItem(UNLOCKED_AVATARS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
export function addUnlockedAvatar(slug: string): void {
  const current = loadUnlockedAvatars()
  if (!current.includes(slug)) {
    try { localStorage.setItem(UNLOCKED_AVATARS_KEY, JSON.stringify([...current, slug])) } catch { /* ignore */ }
  }
}
export function isAvatarUnlocked(slug: string): boolean {
  if ((BASE_AVATAR_SLUGS as readonly string[]).includes(slug)) return true
  return loadUnlockedAvatars().includes(slug)
}

export function loadPlayerName(): string {
  try { return localStorage.getItem(PLAYER_NAME_KEY) || 'Jarv' } catch { return 'Jarv' }
}
export function savePlayerName(name: string): void {
  try { localStorage.setItem(PLAYER_NAME_KEY, name.trim() || 'Jarv') } catch { /* ignore */ }
}

export function loadPlayerAvatar(): AvatarSlug {
  try {
    const v = localStorage.getItem(PLAYER_AVATAR_KEY)
    if (v && (AVATAR_SLUGS as readonly string[]).includes(v) && isAvatarUnlocked(v)) return v as AvatarSlug
  } catch { /* ignore */ }
  return 'jarv'
}
export function savePlayerAvatar(slug: AvatarSlug): void {
  try { localStorage.setItem(PLAYER_AVATAR_KEY, slug) } catch { /* ignore */ }
}


/** Replace "Jarv" (default name) with the player's chosen name in panel text. */
export function applyPlayerName(panels: CutscenePanel[]): CutscenePanel[] {
  const name = loadPlayerName()
  if (name === 'Jarv') return panels
  return panels.map(p => ({ ...p, text: p.text.replace(/\bJarv\b/g, name) }))
}
