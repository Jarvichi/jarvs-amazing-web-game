import { CardRarity, Archetype } from './types'
import type { RoadDef, TerrainObstacle, BattlefieldDecorItem, TerrainPathDef } from './engine/terrain'
import { loadPlayerStats } from './playerStats'
import { logError } from '../logger'
import { getCardCatalog } from './cards'
import { addConsumable, removeConsumable, getConsumables } from './itemStore'
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

// Consumable stash — delegates to itemStore.ts (addConsumable / getConsumables).
// These names are kept for backward compatibility with existing callers.

export function loadConsumableStash(): RunConsumable[] {
  return getConsumables()
}

export function addToConsumableStash(id: string, count = 1): void {
  addConsumable(id, count)
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

/** Drain the stash into a run's consumables list and clear the stash.
 *  Only drains battle consumables (ids present in ALL_CONSUMABLES).
 *  Persistent items like arcade tickets are excluded — see itemStore.ts. */
function drainStashIntoRun(consumables: RunConsumable[]): RunConsumable[] {
  const stash = getConsumables()
  if (stash.length === 0) return consumables
  const battleIds = new Set(ALL_CONSUMABLES.map(c => c.id))
  const battleStash = stash.filter(s => battleIds.has(s.id))
  if (battleStash.length === 0) return consumables
  const merged = [...consumables]
  for (const s of battleStash) {
    const existing = merged.find(c => c.id === s.id)
    if (existing) {
      existing.count += s.count
    } else {
      merged.push({ ...s })
    }
    removeConsumable(s.id, s.count)
  }
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

export type NodeType = 'battle' | 'elite' | 'boss' | 'rest' | 'event' | 'merchant' | 'memory' | 'town' | 'castle' | 'camp' | 'cave' | 'port'


export interface QuestNode {
  id: string
  type: NodeType
  label: string
  description: string
  row: number        // 0 = start row; increases toward boss
  col: number        // column index within this row
  rowCols: number    // total columns in this row (for layout)
  decorTiles?:      number[]
  decorOffsets?:   [number, number][]
  // World map positioning (supersedes row/col/rowCols when present)
  x?: number
  y?: number
  // Bidirectional connections for world maps (supersedes childIds when present)
  connections?: string[]
  // World map (freeform) only: hand-authored bend points for a specific
  // outgoing edge, keyed by the target id (must be present in `connections`).
  // The route is steered through these pixel points, in order, before
  // reaching the target, using the same elbow (H/V/H) logic as an edge with
  // no waypoints. Purely cosmetic — never affects gating/traversal (still
  // driven by `connections`/`requiredClears`). Consumed only by the freeform
  // world-map renderer in NodeMapRederer.tsx.
  connectionWaypoints?: Record<string, { x: number; y: number }[]>
  // World map status: locked until these node IDs are cleared
  requiredClears?: string[]
  // Hub location key — reference into LOCATION_REGISTRY
  locationKey?: string
  // World battle nodes: points to a campaign act+node to launch
  battleConfig?: { actId: string; nodeId: string }

  childIds: string[]
  handicap?: number  // opponent handicap for battle/elite/boss
  restHeal?: number  // HP healed at rest nodes
  bossAI?: string        // 'thornlord' etc. — triggers a specific boss AI
  bossCard?: string      // card name to deploy when opponent base falls (phase 2)
  bossName?: string      // display name for the boss (overrides bossCard name in UI)
  bossHpMultiplier?: number  // multiplier applied to boss card unit's HP (default 10)
  eventConfig?: NodeEventConfig
  fragmentId?: string
  characterEncounter?: string
  bossDialogue?: string[]  // lines the boss speaks before the fight
  bossIntro?: CutscenePanel[]  // cutscene panels shown before boss dialogue
  /** Preset enemy deck — card names in order. Makes each node deterministic and learnable. */
  enemyDeck?: string[]
  /** Visual background theme for this node's battlefield ('forest' | 'ruins' | 'camp' | 'citadel' | 'ashen'). */
  environment?: string
  /** Battlefield road paths for this node, overriding the act's `roads`. Rendered visually; also affects unit movement when `roadFollowing` is true. */
  roads?: RoadDef[]
  /** When true, mobile units path onto the nearest `roads` entry and follow it toward the enemy base instead of walking a straight line. Overrides the act's `roadFollowing`. No effect if `roads` is empty/absent. */
  roadFollowing?: boolean
  /** Battlefield terrain obstacles for this node, overriding the act's `terrain` and replacing the procedurally-generated default. Affects unit avoidance, same as procedural terrain. */
  terrain?: TerrainObstacle[]
  /** Manually-authored decor sprite placements for this node's battlefield, overriding the act's `decor`. When non-empty, replaces the procedural decor scatter. */
  decor?: BattlefieldDecorItem[]
  /** Path-drawn blocking terrain (rivers, tree lines, mountain ridges) for this node, overriding the act's `terrainPaths`. Expands into extra TerrainObstacle circles at battle start — see expandTerrainPathsToObstacles. */
  terrainPaths?: TerrainPathDef[]
  /** When true, this node's battle enforces hard tile-based terrain/road blocking
   *  (see game/engine/terrainGrid.ts) instead of legacy soft avoidance. Overrides
   *  the act's `terrainValidated`. Set exclusively by the battlefield editor's
   *  "validate on save" step — not intended for hand-authoring. */
  terrainValidated?: boolean
  /** Override opponent play interval (ms). Replaces handicap-derived default. */
  opponentIntervalMs?: number
  /** Override opponent base HP. Replaces engine default (95 for bosses, 82 for others). */
  opponentBaseHp?: number
}

// ─── Event system ─────────────────────────────────────────

export type SingleEventEffect =
  | { type: 'healHp';          amount: number }
  | { type: 'damageHp';        amount: number }
  | { type: 'gainCrystals';    amount: number }
  | { type: 'gainCard';        rarity: CardRarity }
  | { type: 'gainItem';        itemId?: string }
  | { type: 'gainLife';        amount: number }
  | { type: 'nothing' }

/** An effect that applies multiple SingleEventEffects in sequence. */
export type EventEffect = SingleEventEffect | { type: 'compound'; effects: SingleEventEffect[] }

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

export { MERCHANT_PRICES } from './economy'

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
  image?: string  // path relative to /public, e.g. "cutscenes/act1-intro-1.svg"
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

export interface WorldMap {
  nodes: Record<string, QuestNode>
  startNodeIds: string[]
  /** Visual environment theme — drives battlefield background CSS class and terrain types. */
  environment?: string  

  /**
   * Override the random seed used for terrain scatter on this act's node map.
   * Useful for tuning layouts without pinning exact positions.
   * If omitted, the seed is derived from the act id.
   */
  terrainSeed?: number

  /**
   * Explicit terrain item placements. When present, replaces the random scatter
   * for this act entirely. Each item needs x/y (pixels, relative to map size),
   * scale (1 = default), and kind (mountain | tree | deadtree | crystal |
   * mushroom | lava | wave | cloud | tower | pillar | dune).
   * A kind of "river" here is ignored — use the `rivers` field instead.
   */
  terrainItems?: Array<{ kind: string; x: number; y: number; scale: number }>

  /**
   * Explicit river paths. When present, these bezier curves are drawn instead
   * of the auto-generated river. Each entry specifies the start point (x1,y1),
   * end point (x2,y2), and two bezier control points (cx1,cy1) and (cx2,cy2).
   * All values are pixel coordinates relative to the map canvas size.
   */
  rivers?: Array<{ x1: number; y1: number; x2: number; y2: number; cx1: number; cy1: number; cx2: number; cy2: number }>

  /**
   * Default battlefield road paths for battles in this act, in game-unit coords
   * (x 0–500 forward base→base, y -80..80 lateral) — the same space as
   * TerrainObstacle. Rendered on the combat lane only (not the node-map
   * screen); a QuestNode's own `roads` overrides this per-node. Also affects
   * unit movement when `roadFollowing` is true.
   */
  roads?: RoadDef[]

  /**
   * When true, mobile units path onto the nearest `roads` entry and follow it
   * toward the enemy base instead of walking a straight line. A QuestNode's
   * own `roadFollowing` overrides this per-node. No effect if `roads` is
   * empty/absent.
   */
  roadFollowing?: boolean

  /**
   * Default battlefield terrain obstacles for battles in this act, in the same
   * game-unit coord space as `roads`. When present, replaces the procedurally
   * generated default (see `generateTerrain` in `game/engine/terrain.ts`) for
   * battles in this act; a QuestNode's own `terrain` overrides this per-node.
   * Affects unit avoidance, same as procedural terrain.
   */
  terrain?: TerrainObstacle[]

  /**
   * Default manually-authored decor sprite placements for battles in this act
   * (see BattlefieldDecorItem). When present and non-empty, replaces the
   * procedural decor scatter (buildDecorGfx) for battles in this act; a
   * QuestNode's own `decor` overrides this per-node.
   */
  decor?: BattlefieldDecorItem[]

  /**
   * Default path-drawn blocking terrain for battles in this act (see
   * TerrainPathDef). Expands into extra TerrainObstacle circles alongside
   * `terrain` at battle start; a QuestNode's own `terrainPaths` overrides this
   * per-node.
   */
  terrainPaths?: TerrainPathDef[]

  /** Default terrain-validation flag for battles in this act (see
   *  QuestNode.terrainValidated); a node's own `terrainValidated` overrides
   *  this per-node. */
  terrainValidated?: boolean

}

export interface Act extends WorldMap {
  id: string
  title: string
  subtitle: string
  rewardRelic: string
  rewardRelicDesc: string

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

// ─── Total battles started counter (all modes) ───────────
const BATTLE_COUNT_KEY = 'jarv_battle_count'

export function loadBattleCount(): number {
  try { return parseInt(localStorage.getItem(BATTLE_COUNT_KEY) ?? '0', 10) || 0 }
  catch { return 0 }
}

export function incrementBattleCount(): number {
  const next = loadBattleCount() + 1
  try { localStorage.setItem(BATTLE_COUNT_KEY, String(next)) } catch { /* ignore */ }
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
  return rule.panels.map((p, i) => ({
    title: resolvePlaceholders(p.title, n, act),
    text:  resolvePlaceholders(p.text,  n, act),
    image: p.image ?? act.intro?.[i]?.image,
  }))
}

/** Thin wrapper for backward compatibility — new code should call resolveActIntro directly. */
export async function getAct1Intro(runCount: number): Promise<CutscenePanel[]> {
  const act1 = await loadAct('act1')
  return resolveActIntro(act1, runCount)
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
  pendingActComplete?: boolean  // true while waiting on the act-complete screen (survives page refresh)
  pendingRelicSelect?: boolean  // true while waiting on the relic-select screen between acts (survives page refresh)
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
  runSeed: number              // stable random seed for this run (used for per-run node visibility rolls)
  archetype?: Archetype        // playstyle chosen on the character screen; set at run creation
}

const RUN_KEY = 'jarv_run'

/**
 * Parses the saved run and migrates/repairs fields that don't need act data.
 * Does NOT validate actId/node ids against the act's node map — callers that
 * need the fully act-validated run should use loadRun() instead. Safe to call
 * synchronously (e.g. from a render body or a useState initializer).
 */
export function loadRunRaw(): RunState | null {
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
    const stashBeforeDrain = loadConsumableStash()
    parsed.consumables = drainStashIntoRun(parsed.consumables)
    if (stashBeforeDrain.length > 0) saveRun(parsed)
    if (typeof parsed.activeModifierCount !== 'number') parsed.activeModifierCount = 0
    if (typeof parsed.runSeed !== 'number') parsed.runSeed = Math.random() * 0xffffffff | 0
    if (typeof parsed.maxLives !== 'number' || parsed.maxLives < 1) parsed.maxLives = 3
    if (typeof parsed.livesRemaining !== 'number') parsed.livesRemaining = parsed.maxLives
    parsed.livesRemaining = Math.max(0, Math.min(parsed.maxLives, parsed.livesRemaining))

    return parsed
  } catch (e) {
    // Corrupt JSON — clear and start fresh
    logError('loadRun: corrupt saved run — clearing and starting fresh', { error: String(e) })
    try { localStorage.removeItem(RUN_KEY) } catch { /* ignore */ }
    return null
  }
}

/**
 * Full act-validated load: loadRunRaw() plus the repairs that need the act's
 * node map (dropping stale node ids, un-skipping convergence-bug victims,
 * clearing a stale already-complete run). Async because the act may need to
 * be fetched.
 */
export async function loadRun(): Promise<RunState | null> {
  const parsed = loadRunRaw()
  if (!parsed) return null

  // Ensure actId is valid
  const act = await loadAct(parsed.actId).catch(() => undefined)
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

  // Repair saves corrupted by the convergence-node skip bug (fixed in skipSiblings):
  // A node Y was incorrectly skipped if any of its completed parents has no other completed child.
  // Such a node is still reachable and must be un-skipped so the map isn't deadlocked.
  {
    const completedSet = new Set(parsed.completedNodeIds)
    const parentMap = buildParentMap(act.nodes)
    const toUnSkip = parsed.skippedNodeIds.filter(nodeId => {
      const parents = parentMap[nodeId] ?? []
      return parents.some(pid => {
        if (!completedSet.has(pid)) return false
        return !act.nodes[pid].childIds.some(cid => cid !== nodeId && completedSet.has(cid))
      })
    })
    if (toUnSkip.length > 0) {
      const unSkipSet = new Set(toUnSkip)
      parsed.skippedNodeIds = parsed.skippedNodeIds.filter(id => !unSkipSet.has(id))
      saveRun(parsed)
    }
  }

  // If act is already complete with no pendingNode, clear run so a fresh one starts —
  // unless pendingActComplete is set (player is on the act-complete screen) or
  // pendingRelicSelect is set (player exited mid relic-select between acts).
  if (isActComplete(act, parsed) && !parsed.pendingNodeId && !parsed.pendingActComplete && !parsed.pendingRelicSelect) {
    console.warn('[run] Act already complete — clearing stale run')
    localStorage.removeItem(RUN_KEY)
    return null
  }

  return parsed
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
  const pStats = loadPlayerStats()
  return {
    actId,
    completedNodeIds: [],
    skippedNodeIds: [],
    pendingNodeId: null,
    playerHp: pStats.maxHp,
    maxHp: pStats.maxHp,
    livesRemaining: pStats.maxLives,
    maxLives: pStats.maxLives,
    cardPlayCounts: {},
    nodeFailCounts: {},
    earnedCards: [],
    activeRelic: null,
    crystalBonus: 0,
    consumables: drainStashIntoRun([]),
    activeModifierCount,
    runSeed: Math.random() * 0xffffffff | 0,
    archetype: loadPlayerArchetype() ?? undefined,
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

/** Derives a reverse map { nodeId → parentIds[] } from childIds. */
function buildParentMap(nodes: Record<string, QuestNode>): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const node of Object.values(nodes)) {
    for (const cid of node.childIds) {
      if (!map[cid]) map[cid] = []
      map[cid].push(node.id)
    }
  }
  return map
}

/**
 * Returns the IDs of nodes the player can currently select.
 * A node is available if it is not done and at least one parent is completed.
 * Start nodes (no parents) are available only at the very beginning.
 */
export function getAvailableNodeIds(nodes: Record<string, QuestNode>, run: RunState): string[] {
  const completed = new Set(run.completedNodeIds)
  const skipped   = new Set(run.skippedNodeIds)
  const done      = new Set([...completed, ...skipped])
  const parentMap = buildParentMap(nodes)

  return Object.values(nodes)
    .filter(node => {
      if (done.has(node.id))            return false
      if (node.id === run.pendingNodeId) return false
      const parents = parentMap[node.id] ?? []
      if (parents.length === 0)         return completed.size === 0
      return parents.some(pid => completed.has(pid))
    })
    .map(n => n.id)
}

/**
 * When the player picks one node from a set of sibling options, the others
 * in the same parent→children group get marked as skipped.
 */
export function skipSiblings(nodes: Record<string, QuestNode>, chosenId: string, run: RunState): RunState {
  const parentMap = buildParentMap(nodes)
  const parents = parentMap[chosenId] ?? []
  // Never skip a node that is also a child of the chosen node — it's still reachable.
  const chosenChildren = new Set(nodes[chosenId]?.childIds ?? [])
  const siblings: string[] = []
  for (const pid of parents) {
    const parent = nodes[pid]
    for (const cid of parent.childIds) {
      if (cid !== chosenId && !run.completedNodeIds.includes(cid) && !run.skippedNodeIds.includes(cid) && !chosenChildren.has(cid)) {
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
//
// Act JSON is heavy (~30-50KB each, ~582KB combined) and only one act is ever
// in play at a time, so each act is dynamically imported on first use and
// cached rather than statically imported up front. See loadAct/getCachedAct.
// New acts: add a loader entry here — no other wiring needed.

const ACT_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  act1:      () => import('../data/acts/act1.json'),
  act2:      () => import('../data/acts/act2.json'),
  act3:      () => import('../data/acts/act3.json'),
  act4:      () => import('../data/acts/act4.json'),
  act5:      () => import('../data/acts/act5.json'),
  act6:      () => import('../data/acts/act6.json'),
  act7:      () => import('../data/acts/act7.json'),
  act8:      () => import('../data/acts/act8.json'),
  act9:      () => import('../data/acts/act9.json'),
  act10:     () => import('../data/acts/act10.json'),
  act11:     () => import('../data/acts/act11.json'),
  act12:     () => import('../data/acts/act12.json'),
  act13:     () => import('../data/acts/act13.json'),
  actfinale: () => import('../data/acts/actfinale.json'),
  c2act1:    () => import('../data/acts/c2act1.json'),
  c2act2:    () => import('../data/acts/c2act2.json'),
  c2act3:    () => import('../data/acts/c2act3.json'),
  c2act4:    () => import('../data/acts/c2act4.json'),
  c2act5:    () => import('../data/acts/c2act5.json'),
  c2act6:    () => import('../data/acts/c2act6.json'),
  c2act7:    () => import('../data/acts/c2act7.json'),
  c2act8:    () => import('../data/acts/c2act8.json'),
  c2act9:    () => import('../data/acts/c2act9.json'),
  c2act10:   () => import('../data/acts/c2act10.json'),
  c2act11:   () => import('../data/acts/c2act11.json'),
  c2act12:   () => import('../data/acts/c2act12.json'),
  c2act13:   () => import('../data/acts/c2act13.json'),
  c2finale:  () => import('../data/acts/c2finale.json'),
  /** Standalone battles launched from the world map — never part of campaign progression. */
  world:     () => import('../data/acts/worldbattles.json'),
}

/** All campaign act ids, in authored order (excludes the standalone 'world' battles map). */
export const ACT_IDS: string[] = Object.keys(ACT_LOADERS).filter(id => id !== 'world')

const actPromiseCache  = new Map<string, Promise<Act>>()
const resolvedActCache = new Map<string, Act>()

/** Loads (and caches) an act's data by id. Rejects if actId is unknown. */
export function loadAct(actId: string): Promise<Act> {
  const cached = actPromiseCache.get(actId)
  if (cached) return cached

  const loader = ACT_LOADERS[actId]
  if (!loader) {
    const rejected = Promise.reject(new Error(`Unknown actId: ${actId}`))
    actPromiseCache.set(actId, rejected)
    return rejected
  }

  const promise = loader().then(m => {
    const act = m.default as Act
    resolvedActCache.set(actId, act)
    return act
  })
  actPromiseCache.set(actId, promise)
  return promise
}

/** Synchronous, no-fetch read of an already-loaded act. Undefined if not loaded yet. */
export function getCachedAct(actId: string): Act | undefined {
  return resolvedActCache.get(actId)
}

// ─── Campaigns ────────────────────────────────────────────

export interface CampaignDef {
  id: string
  name: string
  /** Act started when the player begins this campaign fresh. */
  startActId: string
  /** Completing this act completes the campaign. */
  finaleActId: string
}

/** The story arcs, in order. Acts belong to campaign 2 iff their id starts with 'c2'. */
export const CAMPAIGNS: CampaignDef[] = [
  { id: 'c1', name: 'The Shattered Dominion', startActId: 'act1',   finaleActId: 'actfinale' },
  { id: 'c2', name: 'The Forgotten Kingdom',  startActId: 'c2act1', finaleActId: 'c2finale' },
]

export function getCampaign(campaignId: string): CampaignDef | null {
  return CAMPAIGNS.find(c => c.id === campaignId) ?? null
}

/** The campaign an act belongs to. Standalone maps (world battles) return campaign 1. */
export function getCampaignForAct(actId: string): CampaignDef {
  return actId.startsWith('c2') ? CAMPAIGNS[1] : CAMPAIGNS[0]
}

/** True once the player has beaten the campaign's finale act at least once. */
export function isCampaignComplete(campaignId: string): boolean {
  const campaign = getCampaign(campaignId)
  if (!campaign) return false
  return loadActCount(campaign.finaleActId) > 0
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
export async function getNextAct(actId: string): Promise<Act | null> {
  const cur = await loadAct(actId).catch(() => undefined)
  const nextId = cur?.nextActId
  if (!nextId) return null
  return loadAct(nextId).catch(() => null)
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
export const BOSS_AVATAR_SLUGS = [
  'boss-thornlord', 'boss-kragg', 'boss-ashwalker', 'boss-archivist',
  'boss-tidal-sovereign', 'boss-cloudmarshal', 'boss-cinderwarlord', 'boss-rootqueen',
  'boss-paleengine', 'boss-dunebaron', 'boss-elderwarden', 'boss-harbormaster',
  'boss-grandautomaton', 'boss-paleherald', 'boss-tollwarden', 'boss-gleanerqueen',
  'boss-nameeater', 'boss-lamplighter',
] as const
export const AVATAR_SLUGS = [...BASE_AVATAR_SLUGS, ...STREAK_AVATAR_SLUGS, ...BOSS_AVATAR_SLUGS] as const
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

export const BOSS_AVATAR_LABELS: Record<string, string> = {
  'boss-thornlord':       'The Thornlord',
  'boss-kragg':           'Warlord Kragg',
  'boss-ashwalker':       'The Ashwalker',
  'boss-archivist':       'The Archivist',
  'boss-tidal-sovereign': 'Tidal Sovereign',
  'boss-cloudmarshal':    'The Cloudmarshal',
  'boss-cinderwarlord':   'The Cinderwarlord',
  'boss-rootqueen':       'The Root Queen',
  'boss-paleengine':      'The Pale Engine',
  'boss-dunebaron':       'The Dune Baron',
  'boss-elderwarden':     'The Elder Warden',
  'boss-harbormaster':    'The Harbormaster',
  'boss-grandautomaton':  'The Grand Automaton',
  'boss-paleherald':      'The Pale Herald',
  'boss-tollwarden':      'The Toll Warden',
  'boss-gleanerqueen':    'The Gleaner Queen',
  'boss-nameeater':       'The Name-Eater',
  'boss-lamplighter':     'The Lamplighter General',
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

// ─── Archetypes ───────────────────────────────────────────

export interface ArchetypeDef {
  id: Archetype
  name: string
  icon: string
  identity: string
  passive: string
}

export const ARCHETYPE_DEFS: ArchetypeDef[] = [
  {
    id:       'siege_commander',
    name:     'Siege Commander',
    icon:     '🏰',
    identity: 'Structures win wars',
    passive:  'Structures cost 1 less mana. Structure HP +20%.',
  },
  {
    id:       'swarm_tactician',
    name:     'Swarm Tactician',
    icon:     '🐝',
    identity: 'Quantity is quality',
    passive:  'Units cost 1 less when 4+ are on the field. +5% ATK per unit alive.',
  },
  {
    id:       'arcane_scholar',
    name:     'Arcane Scholar',
    icon:     '📜',
    identity: 'Upgrades shape reality',
    passive:  'Upgrade cards have double effect. Draw +1 card after each upgrade played.',
  },
]

/** Archetype IDs that are always available (no unlock required). */
const ALWAYS_UNLOCKED: Archetype[] = ['siege_commander', 'swarm_tactician']

export function getArchetypeDefs(campaignCompletions: number): (ArchetypeDef & { locked: boolean })[] {
  return ARCHETYPE_DEFS.map(def => ({
    ...def,
    locked: !ALWAYS_UNLOCKED.includes(def.id) && campaignCompletions === 0,
  }))
}

/** Maps each archetype to the starter pack ID that best fits its playstyle. */
export const ARCHETYPE_STARTER_PACK: Record<Archetype, string> = {
  siege_commander: 'fortress',
  swarm_tactician: 'swarm',
  arcane_scholar:  'balanced',
}

const PLAYER_ARCHETYPE_KEY = 'jarv_archetype'
const VALID_ARCHETYPES: Archetype[] = ['siege_commander', 'swarm_tactician', 'arcane_scholar']

export function loadPlayerArchetype(): Archetype | null {
  try {
    const v = localStorage.getItem(PLAYER_ARCHETYPE_KEY)
    if (v && (VALID_ARCHETYPES as string[]).includes(v)) return v as Archetype
  } catch { /* ignore */ }
  return null
}

export function savePlayerArchetype(a: Archetype): void {
  try { localStorage.setItem(PLAYER_ARCHETYPE_KEY, a) } catch { /* ignore */ }
}
