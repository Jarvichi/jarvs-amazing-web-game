// ─── Farming Simulation ────────────────────────────────────────────────────────
// Arable land outside the city walls. Production buildings relocated here earn
// a 50 % resource bonus but are raided twice as often and have minimal defence.
// Workers come from the city population. Resources are shipped to the city pool.

import { logError } from '../logger'
import {
  ResourceType, ResourceStock,
  getBuildingProduces, getBuildingConsumes, currentSeason, SEASON_INFO,
  CELL_PX,
  DEFAULT_BUILDER_COUNT, MAX_BUILDER_COUNT, BUILDER_HIRE_COSTS,
  CityState, CityCell, CarrierState, RoadWearMap,
} from './cityBuilder'
import type { CardRarity } from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

export const FARM_COLS = 4
export const FARM_ROWS = 4
export const FARM_CELLS = FARM_COLS * FARM_ROWS

/** Maximum farm grid size (same as city). */
export const MAX_FARM_SIZE = 8

/** Free farmer slots on a new farm (mirrors DEFAULT_BUILDER_COUNT). */
export const DEFAULT_FARMER_COUNT = DEFAULT_BUILDER_COUNT
/** Maximum farmer slots purchasable (mirrors MAX_BUILDER_COUNT). */
export const MAX_FARMER_COUNT = MAX_BUILDER_COUNT

/** Expansion costs keyed by current row count (same as city, ~10× cheaper). */
export const FARM_EXPANSION_COSTS: Record<number, { gold: number; resources: Partial<ResourceStock> }> = {
  4: { gold: 100_000,   resources: { wood: 500,  ore: 200, planks: 100  } },
  5: { gold: 500_000,   resources: { wood: 1500, ore: 600, planks: 300  } },
  6: { gold: 2_000_000, resources: { wood: 3000, ore: 1200, planks: 600 } },
  7: { gold: 5_000_000, resources: { wood: 5000, ore: 2000, planks: 1000 } },
}

/** Production multiplier applied to farm buildings vs their city equivalent. */
const FARM_PRODUCTION_BONUS = 1.5

/** Defence contributed per assigned farm worker. */
const WORKER_DEFENSE = 2

/** Production multiplier bonus per farm worker (+5 % each). */
const WORKER_PROD_BONUS = 0.05

/** Base raid interval in ms (3 hours — twice as frequent as city's 6 h). */
const BASE_RAID_INTERVAL_MS = 3 * 3600 * 1000
/** Random jitter added to each raid interval (up to 2 hours). */
const RAID_INTERVAL_JITTER_MS = 2 * 3600 * 1000

/** Max offline minutes tracked (same as city). */
const MAX_OFFLINE_MINUTES = 480
/** Sub-step for offline catch-up (5-minute chunks). */
const FARM_STEP_MS = 5 * 60_000

/** Resources per farm plot that accumulate before shipping to the city. */
const SHIP_THRESHOLD = 5

/** Chronicle log cap. */
const CHRONICLE_MAX = 30

const STORAGE_KEY = 'jarv_farming_sim'

// ── Road wear constants (mirror city values) ─────────────────────────────────
const ROAD_DECAY_PER_MIN    = 0.3   // wear lost per minute on unused edges (same as city)
const ROAD_WEAR_PER_CARRIER = 0.4   // wear per carrier route per minute (same as city)
const ROAD_WEAR_WALKER_BG   = 3.0   // background wear per adjacent occupied-pair per minute

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FarmPlot {
  cardName:  string
  rarity:    CardRarity
  stock:     Partial<ResourceStock>
}

export interface FarmRaidEvent {
  at:              number
  power:           number
  defense:         number
  outcome:         'repelled' | 'partial' | 'defeated'
  stolenResources: Partial<ResourceStock>
  destroyedPlots:  string[]
}

export interface FarmState {
  plots:      (FarmPlot | undefined)[]
  rows:       number
  cols:       number
  workers:    number
  /** Purchased farmer slots (default 2 free, up to MAX_FARMER_COUNT). */
  maxWorkers: number
  lastTick:   number
  nextRaidAt: number
  lastRaid:   FarmRaidEvent | null
  chronicle:  string[]
  resources:  ResourceStock
  carriers:   CarrierState[]
  roadWear:   RoadWearMap
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyResources(): ResourceStock {
  return { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 }
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function addFarmChronicle(state: FarmState, msg: string): FarmState {
  const entry = `[${fmtTime(Date.now())}] ${msg}`
  const chronicle = [entry, ...(state.chronicle ?? [])].slice(0, CHRONICLE_MAX)
  return { ...state, chronicle }
}

// ── Farm → CityState adapter ──────────────────────────────────────────────────

/** Convert FarmState to a CityState for use with CityGrid and carrier animation. */
export function buildFarmCity(farm: FarmState): CityState {
  const rows = farm.rows ?? FARM_ROWS
  const cols = farm.cols ?? FARM_COLS
  const cells = rows * cols

  // Use the farm's live road wear so roads build up and decay organically,
  // matching the city view's behaviour (wear driven by carrier routes + decay).
  const roadWear: RoadWearMap = farm.roadWear ?? {
    h: Array(cells).fill(0),
    v: Array(cells).fill(0),
  }

  // Each plot shows the full farm resource pool for its produced resources
  // (not divided by producer count — the farm is a collective operation).
  // Consumed resources are also shown so Windmill animation, inspect modal, etc.
  // reflect actual availability (e.g. stock.wheat drives Windmill speed).
  const grid = farm.plots.map(p => {
    if (!p) return undefined
    const produces = getBuildingProduces(p.cardName)
    const consumes = getBuildingConsumes(p.cardName)
    const stock: Partial<Record<ResourceType, number>> = {}
    for (const [res, rate] of Object.entries(produces) as [ResourceType, number][]) {
      if ((rate ?? 0) > 0) {
        // Always show icon for producing buildings — buffer frequently resets to 0 after shipping
        stock[res] = Math.max(farm.resources[res] ?? 0, 0.1)
      }
    }
    for (const [res, rate] of Object.entries(consumes) as [ResourceType, number][]) {
      if ((rate ?? 0) > 0 && !(res in stock)) {
        const farmAmt = farm.resources[res] ?? 0
        if (farmAmt >= 0.01) stock[res] = farmAmt
      }
    }
    return { cardName: p.cardName, rarity: p.rarity, stock } as CityCell
  })

  return {
    grid, rows, cols,
    gold: 0,
    resources: { ...farm.resources, bread: 1 },
    lastTick: farm.lastTick,
    happiness: {},
    nextAttackAt: 0,
    fortifications: [],
    builderQueue: [],
    builderCount: 0,
    lastAttack: null,
    chronicle: [],
    completedMilestones: [],
    attacksProcessed: 0,
    tradeOffer: null,
    activeCaravan: null,
    history: [],
    zones: [],
    activeDisaster: null,
    nextDisasterAt: 0,
    roadWear,
    carriers: farm.carriers ?? [],
  }
}

// ── Default / load / save ─────────────────────────────────────────────────────

function defaultFarmState(): FarmState {
  return {
    plots:      Array(FARM_CELLS).fill(undefined),
    rows:       FARM_ROWS,
    cols:       FARM_COLS,
    workers:    0,
    maxWorkers: DEFAULT_FARMER_COUNT,
    lastTick:   Date.now(),
    nextRaidAt: Date.now() + BASE_RAID_INTERVAL_MS + Math.random() * RAID_INTERVAL_JITTER_MS,
    lastRaid:   null,
    chronicle:  [],
    resources:  emptyResources(),
    carriers:   [],
    roadWear:   { h: Array(FARM_CELLS).fill(0), v: Array(FARM_CELLS).fill(0) },
  }
}

export function loadFarmState(): FarmState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultFarmState()
    const parsed = JSON.parse(raw) as Partial<FarmState>
    const savedRows = parsed.rows ?? FARM_ROWS
    const savedCols = parsed.cols ?? FARM_COLS
    // Migrate old 6×4 default to square: trim extra cols down to rows×rows
    const rows = savedRows
    const cols = savedCols > savedRows ? savedRows : savedCols
    const savedPlots = (parsed.plots ?? []) as (FarmPlot | undefined)[]
    let plots: (FarmPlot | undefined)[]
    if (savedCols !== cols) {
      plots = Array(rows * cols).fill(undefined)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p = savedPlots[r * savedCols + c]
          plots[r * cols + c] = p ? { ...p, stock: p.stock ?? {} } : undefined
        }
      }
    } else {
      const cells = rows * cols
      plots = (savedPlots.length < cells
        ? [...savedPlots, ...Array(cells - savedPlots.length).fill(undefined)]
        : savedPlots
      ).map((p: FarmPlot | undefined) => p ? { ...p, stock: p.stock ?? {} } : p)
    }
    const savedRes = (parsed.resources ?? {}) as Partial<ResourceStock>
    const cells = rows * cols
    return {
      plots,
      rows,
      cols,
      workers:    parsed.workers    ?? 0,
      maxWorkers: parsed.maxWorkers ?? DEFAULT_FARMER_COUNT,
      lastTick:   parsed.lastTick   ?? Date.now(),
      nextRaidAt: parsed.nextRaidAt ?? Date.now() + BASE_RAID_INTERVAL_MS,
      lastRaid:   parsed.lastRaid   ?? null,
      chronicle:  parsed.chronicle  ?? [],
      resources: {
        wheat:  savedRes.wheat  ?? 0,
        wood:   savedRes.wood   ?? 0,
        ore:    savedRes.ore    ?? 0,
        bread:  savedRes.bread  ?? 0,
        planks: savedRes.planks ?? 0,
        metal:  savedRes.metal  ?? 0,
      },
      carriers: [],
      roadWear: (parsed as Partial<FarmState>).roadWear ?? { h: Array(cells).fill(0), v: Array(cells).fill(0) },
    }
  } catch (err) {
    logError('loadFarmState failed', err as Record<string, unknown>)
    return defaultFarmState()
  }
}

export function saveFarmState(state: FarmState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    logError('saveFarmState failed', err as Record<string, unknown>)
  }
}

// ── Unlock & placement guards ─────────────────────────────────────────────────

/** Farm unlocks when the city reaches a population of 10. */
export function isFarmUnlocked(cityPop: number): boolean {
  return cityPop >= 10
}

/** Returns true if the given building card is a pure production building
 *  that may be placed on the farm (no spawner units, must produce ≥1 resource). */
export function canPlaceOnFarm(cardName: string, isSpawner: boolean): boolean {
  if (isSpawner) return false
  const produces = getBuildingProduces(cardName)
  return Object.values(produces).some(v => (v ?? 0) > 0)
}

// ── Farm aggregate stats ──────────────────────────────────────────────────────

/** Production rates (per minute) for the entire farm, including worker bonus and season. */
export function getFarmProductionRate(state: FarmState, nowMs = Date.now()): Partial<ResourceStock> {
  const rates: Partial<ResourceStock> = {}
  const si = SEASON_INFO[currentSeason(nowMs)]
  const workerMult = 1 + state.workers * WORKER_PROD_BONUS

  for (const plot of state.plots) {
    if (!plot) continue
    const produces = getBuildingProduces(plot.cardName)
    for (const [res, rate] of Object.entries(produces) as [ResourceType, number][]) {
      const seasonMult = res === 'wheat' ? 1 + si.wheat
                       : res === 'wood'  ? 1 + si.wood
                       : res === 'ore'   ? 1 + si.ore
                       : 1
      const amount = rate * FARM_PRODUCTION_BONUS * Math.max(0, seasonMult) * workerMult
      rates[res as ResourceType] = (rates[res as ResourceType] ?? 0) + amount
    }
  }
  return rates
}

/** Defence value of the farm (based solely on assigned workers). */
export function farmDefense(state: FarmState): number {
  return state.workers * WORKER_DEFENSE
}

/** Number of production plots occupied. */
export function farmPlotCount(state: FarmState): number {
  return state.plots.filter(p => p != null).length
}

// ── Plot placement / removal ──────────────────────────────────────────────────

export function placeFarmBuilding(state: FarmState, index: number, plot: FarmPlot): FarmState {
  if (state.plots[index]) return state
  const plots = [...state.plots]
  plots[index] = { ...plot, stock: {} }
  let next = { ...state, plots }
  next = addFarmChronicle(next, `🌾 ${plot.cardName} placed on the farm`)
  return next
}

export function removeFarmBuilding(state: FarmState, index: number): { state: FarmState; returnedResources: Partial<ResourceStock> } {
  const plot = state.plots[index]
  if (!plot) return { state, returnedResources: {} }
  const returnedResources = { ...plot.stock }
  const plots = [...state.plots]
  plots[index] = undefined
  let next = { ...state, plots }
  next = addFarmChronicle(next, `🏗 ${plot.cardName} moved back to city`)
  return { state: next, returnedResources }
}

// ── Farm expansion ────────────────────────────────────────────────────────────

export function canAffordFarmExpansion(
  state: FarmState,
  gold: number,
  resources: ResourceStock,
): boolean {
  const rows = state.rows ?? FARM_ROWS
  if (rows >= MAX_FARM_SIZE) return false
  const cost = FARM_EXPANSION_COSTS[rows]
  if (!cost) return false
  if (gold < cost.gold) return false
  for (const [res, amt] of Object.entries(cost.resources) as [ResourceType, number][]) {
    if ((resources[res] ?? 0) < amt) return false
  }
  return true
}

export function expandFarm(state: FarmState): FarmState {
  const rows = state.rows ?? FARM_ROWS
  const cols = state.cols ?? FARM_COLS
  if (rows >= MAX_FARM_SIZE) return state
  const newRows = rows + 1
  const newCols = cols < MAX_FARM_SIZE ? cols + 1 : cols
  const newCells = newRows * newCols
  const plots: (FarmPlot | undefined)[] = Array(newCells).fill(undefined)
  // Copy existing plots into the new (larger) grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const oldIdx = r * cols + c
      const newIdx = r * newCols + c
      plots[newIdx] = state.plots[oldIdx]
    }
  }
  let next: FarmState = { ...state, rows: newRows, cols: newCols, plots, carriers: [], roadWear: { h: Array(newCells).fill(0), v: Array(newCells).fill(0) } }
  next = addFarmChronicle(next, `🏗 Farm expanded to ${newRows}×${newCols}`)
  return next
}

// ── Worker assignment ─────────────────────────────────────────────────────────

/** Gold cost to hire the next farmer slot beyond the free DEFAULT_FARMER_COUNT. */
export function nextFarmerCost(state: FarmState): number | null {
  const current = state.maxWorkers ?? DEFAULT_FARMER_COUNT
  if (current >= MAX_FARMER_COUNT) return null
  const extras = current - DEFAULT_FARMER_COUNT
  if (extras < 0 || extras >= BUILDER_HIRE_COSTS.length) return null
  return BUILDER_HIRE_COSTS[extras]
}

/** Unlock one additional farmer slot (gold deducted by caller from CityState). */
export function hireFarmer(state: FarmState): FarmState {
  return { ...state, maxWorkers: (state.maxWorkers ?? DEFAULT_FARMER_COUNT) + 1 }
}

/** Assign one city resident as a farm worker (capped at maxWorkers). */
export function assignWorker(state: FarmState): FarmState {
  const max = state.maxWorkers ?? DEFAULT_FARMER_COUNT
  if (state.workers >= max) return state
  return { ...state, workers: state.workers + 1 }
}

/** Unassign one farm worker (min 0). */
export function unassignWorker(state: FarmState): FarmState {
  return { ...state, workers: Math.max(0, state.workers - 1) }
}

// ── Raid processing ───────────────────────────────────────────────────────────

function processFarmRaid(state: FarmState): FarmState {
  const defense = farmDefense(state)
  const occupied = state.plots.filter(p => p != null).length
  const power = 15 + occupied * 4 + Math.floor(Math.random() * 20)

  const ratio = defense / Math.max(power, 1)
  let outcome: FarmRaidEvent['outcome']
  const stolenResources: Partial<ResourceStock> = {}
  const destroyedPlots: string[] = []

  const newResources = { ...state.resources }
  const newPlots = [...state.plots]

  if (ratio >= 1.0) {
    outcome = 'repelled'
  } else if (ratio >= 0.5) {
    outcome = 'partial'
    for (const [res, amt] of Object.entries(newResources) as [ResourceType, number][]) {
      const stolen = Math.floor(amt * 0.25)
      if (stolen > 0) { stolenResources[res] = stolen; newResources[res] = amt - stolen }
    }
    // Damage one plot's stock
    const occupiedIndices = newPlots.map((p, i) => p ? i : -1).filter(i => i >= 0)
    if (occupiedIndices.length > 0) {
      const target = occupiedIndices[Math.floor(Math.random() * occupiedIndices.length)]
      const plot = newPlots[target]!
      const damaged = { ...plot, stock: Object.fromEntries(
        Object.entries(plot.stock).map(([k, v]) => [k, Math.floor((v as number) * 0.5)])
      ) as Partial<ResourceStock> }
      newPlots[target] = damaged
    }
  } else {
    outcome = 'defeated'
    for (const [res, amt] of Object.entries(newResources) as [ResourceType, number][]) {
      const stolen = Math.floor(amt * 0.5)
      if (stolen > 0) { stolenResources[res] = stolen; newResources[res] = Math.max(0, amt - stolen) }
    }
    // Destroy 1–3 plots
    const occupiedIndices = newPlots.map((p, i) => p ? i : -1).filter(i => i >= 0)
    const toDestroy = Math.min(occupiedIndices.length, 1 + Math.floor(Math.random() * 3))
    const shuffled = [...occupiedIndices].sort(() => Math.random() - 0.5)
    for (let k = 0; k < toDestroy; k++) {
      const idx = shuffled[k]
      destroyedPlots.push(newPlots[idx]!.cardName)
      newPlots[idx] = undefined
    }
  }

  const event: FarmRaidEvent = {
    at: Date.now(),
    power, defense, outcome, stolenResources, destroyedPlots,
  }

  const msg =
    outcome === 'repelled' ? '⚔ Farm raid repelled — no damage!' :
    outcome === 'partial'  ? `⚠ Farm raided — resources stolen` :
    `💀 Farm overrun — ${destroyedPlots.length} building${destroyedPlots.length > 1 ? 's' : ''} destroyed`

  let next = addFarmChronicle(
    { ...state, resources: newResources, plots: newPlots },
    msg,
  )
  next = {
    ...next,
    lastRaid:   event,
    nextRaidAt: Date.now() + BASE_RAID_INTERVAL_MS + Math.random() * RAID_INTERVAL_JITTER_MS,
  }
  return next
}

// ── Road wear helpers ─────────────────────────────────────────────────────────

/** Add wear to every edge on the Manhattan path from→to (mirrors city wearPath). */
function farmWearPath(from: number, to: number, roadWear: RoadWearMap, cols: number, amount: number): void {
  let c = from % cols, r = Math.floor(from / cols)
  const tc = to % cols, tr = Math.floor(to / cols)
  while (c !== tc || r !== tr) {
    const pc = c, pr = r
    if (c !== tc) c += c < tc ? 1 : -1; else r += r < tr ? 1 : -1
    const lo = Math.min(pr * cols + pc, r * cols + c)
    const hi = Math.max(pr * cols + pc, r * cols + c)
    if (hi === lo + 1) roadWear.h[lo] = Math.min(100, (roadWear.h[lo] ?? 0) + amount)
    else               roadWear.v[lo] = Math.min(100, (roadWear.v[lo] ?? 0) + amount)
  }
}

// ── Tick ──────────────────────────────────────────────────────────────────────

/**
 * Advances the farm simulation forward to `nowMs`.
 *
 * Returns:
 * - `nextState`: updated FarmState (save this to localStorage)
 * - `resourcesForCity`: resources produced this tick that should be added to CityState.resources
 */
export function tickFarm(
  state: FarmState,
  nowMs = Date.now(),
): { nextState: FarmState; resourcesForCity: Partial<ResourceStock> } {
  const elapsed = nowMs - state.lastTick

  // Sub-step for long offline gaps so production accumulates correctly
  if (elapsed > FARM_STEP_MS * 1.5) {
    const steps = Math.min(Math.ceil(elapsed / FARM_STEP_MS), MAX_OFFLINE_MINUTES / 5)
    const stepMs = elapsed / steps
    let current = state
    const totalForCity: Partial<ResourceStock> = {}

    for (let i = 0; i < steps; i++) {
      const { nextState, resourcesForCity } = tickFarm(current, state.lastTick + stepMs * (i + 1))
      current = nextState
      for (const [res, amt] of Object.entries(resourcesForCity) as [ResourceType, number][]) {
        totalForCity[res as ResourceType] = (totalForCity[res as ResourceType] ?? 0) + amt
      }
    }
    return { nextState: current, resourcesForCity: totalForCity }
  }

  const minutes = Math.min(elapsed / 60_000, MAX_OFFLINE_MINUTES)

  // ── 1. Production — write to farm resource pool ──────────────────────────────
  const rates = getFarmProductionRate(state, nowMs)
  const newResources = { ...state.resources }
  for (const [res, rate] of Object.entries(rates) as [ResourceType, number][]) {
    newResources[res as ResourceType] = (newResources[res as ResourceType] ?? 0) + rate * minutes
  }

  let next: FarmState = { ...state, resources: newResources, lastTick: nowMs }

  // ── 2. Check for raid ────────────────────────────────────────────────────────
  if (nowMs >= state.nextRaidAt) {
    next = processFarmRaid(next)
  }

  // ── 3. Road wear — mirrors city carrier + decay logic ───────────────────────
  {
    const cols = next.cols ?? FARM_COLS
    const rows = next.rows ?? FARM_ROWS
    const rw: RoadWearMap = {
      h: [...(next.roadWear?.h ?? [])],
      v: [...(next.roadWear?.v ?? [])],
    }

    // a) Background wear: adjacent occupied-plot pairs (farmers moving between plots)
    for (let i = 0; i < next.plots.length; i++) {
      if (!next.plots[i]) continue
      const col = i % cols, row = Math.floor(i / cols)
      if (col < cols - 1 && next.plots[i + 1]) {
        rw.h[i] = Math.min(100, (rw.h[i] ?? 0) + ROAD_WEAR_WALKER_BG * minutes)
      }
      if (row < rows - 1 && next.plots[i + cols]) {
        rw.v[i] = Math.min(100, (rw.v[i] ?? 0) + ROAD_WEAR_WALKER_BG * minutes)
      }
    }

    // b) Carrier-route wear: producer→nearest-consumer (same pairs the visual goblins use)
    for (let i = 0; i < next.plots.length; i++) {
      const plot = next.plots[i]
      if (!plot) continue
      const produces = getBuildingProduces(plot.cardName)
      for (const [res, rate] of Object.entries(produces) as [ResourceType, number][]) {
        if (!(rate > 0)) continue
        for (let j = 0; j < next.plots.length; j++) {
          if (i === j) continue
          const other = next.plots[j]
          if (!other) continue
          if (!((getBuildingConsumes(other.cardName)[res] ?? 0) > 0)) continue
          farmWearPath(i, j, rw, cols, ROAD_WEAR_PER_CARRIER * minutes)
          break
        }
      }
    }

    // c) Decay all edges (unused roads revert to grass)
    for (let idx = 0; idx < rw.h.length; idx++) {
      if (rw.h[idx] > 0) rw.h[idx] = Math.max(0, rw.h[idx] - ROAD_DECAY_PER_MIN * minutes)
    }
    for (let idx = 0; idx < rw.v.length; idx++) {
      if (rw.v[idx] > 0) rw.v[idx] = Math.max(0, rw.v[idx] - ROAD_DECAY_PER_MIN * minutes)
    }

    next = { ...next, roadWear: rw }
  }

  // ── 4. Ship resources to the city (above threshold) ──────────────────────────
  const resourcesForCity: Partial<ResourceStock> = {}
  const shipped = { ...next.resources }
  let anyShipped = false

  for (const [res, amt] of Object.entries(next.resources) as [ResourceType, number][]) {
    if (amt >= SHIP_THRESHOLD) {
      resourcesForCity[res as ResourceType] = Math.floor(amt)
      shipped[res as ResourceType] = 0
      anyShipped = true
    }
  }

  if (anyShipped) {
    next = { ...next, resources: shipped }
  }

  return { nextState: next, resourcesForCity }
}

// ── Neighbour helper (same as city) ──────────────────────────────────────────

export function getFarmNeighbourIndices(index: number, rows = FARM_ROWS, cols = FARM_COLS): number[] {
  const row = Math.floor(index / cols)
  const col = index % cols
  const result: number[] = []
  if (col > 0)           result.push(index - 1)
  if (col < cols - 1)    result.push(index + 1)
  if (row > 0)           result.push(index - cols)
  if (row < rows - 1)    result.push(index + cols)
  return result
}

/** Cell centre in overlay pixels — mirrors cityBuilder.cellCenter for FARM_COLS. */
export function farmCellCenter(idx: number): { x: number; y: number } {
  const col = idx % FARM_COLS
  const row = Math.floor(idx / FARM_COLS)
  return { x: (col + 0.5) * CELL_PX, y: (row + 0.5) * CELL_PX }
}
