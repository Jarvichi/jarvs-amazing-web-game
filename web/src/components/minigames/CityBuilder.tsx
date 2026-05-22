// ─── City Builder ─────────────────────────────────────────────────────────────
// Idle city: place owned structure cards on a grid. Spawn buildings show their
// unit walking around the city. Resources are produced and consumed over time.
// Happiness is driven by food and defence.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getCardCatalog } from '../../game/cards'
import {
  loadCollection, saveCollection, getOwnedCount,
  getMasteryXp, masteryLevel, masteryXpForLevel, masteryProgress,
  CollectionEntry,
} from '../../game/collection'
import {
  CITY_COLS, CITY_ROWS, CELL_PX, MAX_CITY_ROWS,
  CityCell, CityState, BuildQueueEntry, ResourceType, AttackEvent,
  FORT_MAX_HP, FORT_BUILD_MINUTES, EXPANSION_COSTS, MAX_TOTAL_FORTS,
  DEFAULT_BUILDER_COUNT, MAX_BUILDER_COUNT,
  canAffordFortification, canQueueFortification,
  loadCityState, saveCityState, tickCity,
  placeCard, placeCoreBuild, removeCard, reoccupyBuilding,
  CoreBuilding, canAffordCoreBuild,
  addFortification, removeFortification,
  expandCity, canAffordExpansion,
  goldIncomeRate, goldNetRate,
  cityDefense, cityPopulation, getCityFoodScore,
  canAffordPlacement,
  resourceProductionRate, resourceConsumptionRate,
  levelUpCost, levelUpCard,
  getBuildingProduces, isDefenceCard,
  spawnerUnitCount,
  getNeighbourIndices,
  nextBuilderCost, buyBuilder,
  checkMilestones, MilestoneDef,
  WAREHOUSE_PATTERN,
  currentSeason,
  dispatchCaravan,
  extinguishFire, curePlague,
  findFastestPath, ROAD_SPEED_MULT, RoadWearMap,
  roadTier,
  GOLD_SYMBOL,
} from '../../game/cityBuilder'
import { AnimatedSpriteImg } from '../ui/SpriteImg'
import { Card, UnitTemplate } from '../../game/types'
import { TowerDefence, TowerPool } from './TowerDefence'
import { Fortifications } from './citybuilder/Fortifications'
import { Walker, WalkerTask, TaskType, ResidentThought, PersonalityTrait, residentName, rageDescription, getUnitRequirements } from './citybuilder/walkerTypes'
import { CardPicker } from './citybuilder/CardPicker'
import { BuildingUpgradeList } from './citybuilder/BuildingUpgradeList'
import { LevelUpDetail } from './citybuilder/LevelUpDetail'
import { AttackReportModal } from './citybuilder/AttackReportModal'
import { ResidentInfoModal } from './citybuilder/ResidentInfoModal'
import { BuildingInspectModal } from './citybuilder/BuildingInspectModal'
import { CityGrid } from './citybuilder/CityGrid'
import { CityPerimeter } from './citybuilder/CityPerimeter'
import { AttackStrip } from './citybuilder/AttackStrip'
import { ResourceStrip } from './citybuilder/ResourceStrip'
import { ChroniclePanel } from './citybuilder/ChroniclePanel'
import { MilestoneBanner } from './citybuilder/MilestoneBanner'
import { TradeRouteModal } from './citybuilder/TradeRouteModal'
import { StatsScreen } from './citybuilder/StatsScreen'
import { ZoneEditor } from './citybuilder/ZoneEditor'
import { DisasterModal } from './citybuilder/DisasterModal'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Toolbar, ToolbarButton, ToolbarDropdown } from '../ui/Toolbar'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { FarmingSim } from './FarmingSim'
import { isFarmUnlocked, loadFarmState, saveFarmState, tickFarm, getFarmProductionRate } from '../../game/farmingSim'


// ── Resident thought lines ────────────────────────────────────────────────────

const HAPPY_THOUGHTS = [
  'Lovely day in the city!',
  'I feel right at home here.',
  'Things couldn\'t be better.',
  'This is a fine place to live.',
  'I\'m quite content, all things considered.',
]

const FOOD_THOUGHTS = [
  'I\'m absolutely starving!',
  'When\'s the next harvest?',
  'My stomach is growling...',
  'Could really go for a meal right now.',
]

const DEFENCE_THOUGHTS = [
  'Those walls look rather thin.',
  'I don\'t feel very safe around here.',
  'Has anyone seen the guards?',
  'I sleep with one eye open.',
]

const AFFINITY_THOUGHTS = (wanted: string) => [
  `I really wish there was a ${wanted} next door.`,
  `A ${wanted} neighbour would make all the difference.`,
  `No ${wanted} nearby — I can\'t settle like this.`,
]

const LEAVING_THOUGHTS = [
  'I\'ve had enough. I\'m leaving.',
  'That\'s it — I\'m packing my bags.',
  'This city doesn\'t deserve me.',
]

function buildResidentThoughts(
  city: CityState,
  population: number,
  walkers: Walker[] = [],
): ResidentThought[] {
  const thoughts: ResidentThought[] = []
  const pop = Math.max(population, 1)
  const foodScore = getCityFoodScore(city)
  const defenseScore = Math.min(100, (cityDefense(city) / pop) * 8)
  const gridRows = city.rows ?? CITY_ROWS
  const gridCols = city.cols ?? CITY_COLS

  for (let i = 0; i < city.grid.length; i++) {
    const cell = city.grid[i]
    if (!cell?.spawnedUnitName) continue
    const happiness = city.happiness[i] ?? 100
    const count = spawnerUnitCount(city, cell.cardName)

    for (let u = 0; u < count; u++) {
      const name = residentName(cell.spawnedUnitName, i, u)
      const seed = (i * 17 + u * 31 + Math.floor(Date.now() / 15_000)) % 1000

      let thought: string
      let happy = true

      const wantedNeighbour = cell.affinityWith ?? cell.spawnedUnitName
      const neighbourMet = getNeighbourIndices(i, gridRows, gridCols).some(ni => {
        const nc = city.grid[ni]
        return nc?.spawnedUnitName === wantedNeighbour && (city.happiness[ni] ?? 100) > 0
      })

      if (happiness === 0) {
        thought = LEAVING_THOUGHTS[seed % LEAVING_THOUGHTS.length]
        happy = false
      } else if (!neighbourMet) {
        const lines = AFFINITY_THOUGHTS(wantedNeighbour)
        thought = lines[seed % lines.length]
        happy = false
      } else if (foodScore < 50) {
        thought = FOOD_THOUGHTS[seed % FOOD_THOUGHTS.length]
        happy = false
      } else if (defenseScore < 50) {
        thought = DEFENCE_THOUGHTS[seed % DEFENCE_THOUGHTS.length]
        happy = false
      } else {
        const walker = walkers.find(wk => wk.cellIndex === i && wk.unitIndex === u)
        if (happiness === 100 && walker && walker.task.type !== 'idle') {
          thought = walker.task.label
        } else {
          thought = HAPPY_THOUGHTS[seed % HAPPY_THOUGHTS.length]
        }
      }

      thoughts.push({ name, unitName: cell.spawnedUnitName, thought, happy })
    }
  }
  for (let i = thoughts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [thoughts[i], thoughts[j]] = [thoughts[j], thoughts[i]]
  }
  return thoughts.slice(0, 5)
}

// ── Builder walker (construction) ─────────────────────────────────────────────

const BUILDER_SPEED = 1.1  // slightly faster than residents
const RING_UNIT_SIZE = 14   // smaller sprite on the ring view
const RING_ARRIVE_DIST = 12

// Slot → [row, col] in the 4-column ring grid:
//   row 0: cols 0-3  (slots 0-3, top)
//   row 1: col 0 (slot 4) and col 3 (slot 5)
//   row 2: col 0 (slot 6) and col 3 (slot 7)
//   row 3: cols 0-3  (slots 8-11, bottom)
const SLOT_GRID_POS: [number, number][] = [
  [0, 0], [0, 1], [0, 2], [0, 3],
  [1, 0], [1, 3],
  [2, 0], [2, 3],
  [3, 0], [3, 1], [3, 2], [3, 3],
]

export interface VisualCarrier {
  id:       string
  carrying: Partial<Record<ResourceType, number>>
  x: number; y: number; vx: number; vy: number
  waypoints: { x: number; y: number }[]
  scale: number
  phase: 'outbound' | 'returning'
  /** pixel coords of the pickup point (fromCell centre) */
  pickX: number; pickY: number
  /** pixel coords of the drop-off point (toCell centre) */
  dropX: number; dropY: number
}

export interface BuilderWalker {
  queueIndex: number
  cardName: string
  // City-world position
  x: number; y: number; vx: number; vy: number
  phase: 'fetching' | 'delivering'
  targetX: number; targetY: number
  waypoints: { x: number; y: number }[]
  label: string
  // Ring-view position (independent animation, own phase)
  ringX: number; ringY: number
  ringVx: number; ringVy: number
  ringPhase: 'fetching' | 'delivering'
  ringTargetX: number; ringTargetY: number
}

function pickRingTarget(
  phase: 'fetching' | 'delivering',
  queueIndex: number,
  city: CityState,
  ringW: number,
  ringH: number,
): { targetX: number; targetY: number } {
  if (phase === 'delivering') {
    const slotIndex = Math.min(city.fortifications.length + queueIndex, 11)
    const [row, col] = SLOT_GRID_POS[slotIndex]
    return {
      targetX: (col + 0.3 + Math.random() * 0.4) / 4 * ringW,
      targetY: (row + 0.3 + Math.random() * 0.4) / 4 * ringH,
    }
  } else {
    // Fetch from inside the city thumbnail (cols 1-2, rows 1-2 of the 4x4 ring)
    const cityRows = city.rows ?? CITY_ROWS
    const cityCols = city.cols ?? CITY_COLS
    const resourceCells = city.grid
      .map((cell, i) => ({ cell, i }))
      .filter(({ cell }) => cell && !cell.spawnedUnitName && Object.values(getBuildingProduces(cell.cardName)).some(v => (v ?? 0) > 0))
    if (resourceCells.length > 0) {
      const { i } = resourceCells[Math.floor(Math.random() * resourceCells.length)]
      const gCol = i % cityCols
      const gRow = Math.floor(i / cityCols)
      return {
        targetX: ringW * (0.25 + (gCol + 0.3 + Math.random() * 0.4) / cityCols * 0.5),
        targetY: ringH * (0.25 + (gRow + 0.3 + Math.random() * 0.4) / cityRows * 0.5),
      }
    }
    return { targetX: ringW * (0.3 + Math.random() * 0.4), targetY: ringH * (0.3 + Math.random() * 0.4) }
  }
}

function makeBuilderWalker(queueIndex: number, cardName: string, overlayW: number, overlayH: number): BuilderWalker {
  const ringW = CITY_COLS * CELL_PX
  const ringH = CITY_ROWS * CELL_PX
  return {
    queueIndex,
    cardName,
    x: Math.random() * Math.max(1, overlayW - UNIT_SIZE),
    y: Math.random() * Math.max(1, overlayH * 0.5),
    vx: 0, vy: 0,
    phase: 'fetching',
    targetX: Math.random() * overlayW,
    targetY: Math.random() * overlayH * 0.7,
    waypoints: [],
    label: '🪵 Fetching materials',
    ringX: ringW * (0.3 + Math.random() * 0.4),
    ringY: ringH * (0.3 + Math.random() * 0.4),
    ringVx: 0, ringVy: 0,
    ringPhase: 'fetching',
    ringTargetX: ringW * 0.5,
    ringTargetY: ringH * 0.5,
  }
}

function pickBuilderTarget(
  phase: BuilderWalker['phase'],
  city: CityState,
  overlayW: number,
  overlayH: number,
): { targetX: number; targetY: number; nextPhase: BuilderWalker['phase']; label: string } {
  if (phase === 'fetching') {
    const cityRows = city.rows ?? CITY_ROWS
    const cityCols = city.cols ?? CITY_COLS
    const allCells = city.grid.map((cell, i) => ({ cell, i })).filter(({ cell }) => cell && !cell.spawnedUnitName)
    // Prefer warehouses with materials stocked, then fall back to any producer
    const warehouses = allCells.filter(({ cell }) => WAREHOUSE_PATTERN.test(cell!.cardName) &&
      Object.values(cell!.stock ?? {}).some(v => (v ?? 0) >= 1))
    const producers  = allCells.filter(({ cell }) => Object.values(getBuildingProduces(cell!.cardName)).some(v => (v ?? 0) > 0))
    const candidates = warehouses.length > 0 ? warehouses : producers
    if (candidates.length > 0) {
      const { i } = candidates[Math.floor(Math.random() * candidates.length)]
      const col = i % cityCols
      const row = Math.floor(i / cityCols)
      return {
        targetX: (col + 0.3 + Math.random() * 0.4) * (overlayW / cityCols),
        targetY: (row + 0.3 + Math.random() * 0.4) * (overlayH / cityRows),
        nextPhase: 'delivering',
        label: warehouses.length > 0 ? '📦 Collecting from warehouse' : '🪵 Fetching materials',
      }
    }
    // No suitable buildings — wander
    return {
      targetX: overlayW * (0.2 + Math.random() * 0.6),
      targetY: overlayH * (0.2 + Math.random() * 0.6),
      nextPhase: 'delivering',
      label: '⛏ Gathering supplies',
    }
  } else {
    // Fetched — deliver to the fort wall (bottom edge of overlay)
    return {
      targetX: overlayW * (0.1 + Math.random() * 0.8),
      targetY: overlayH - UNIT_SIZE * 0.5,
      nextPhase: 'fetching',
      label: '🏗 Building the wall',
    }
  }
}

// ── Walking unit state ────────────────────────────────────────────────────────

const UNIT_SIZE = 20
const SPEED = 0.8
const ARRIVE_DIST = 14   // pixels — close enough to count as "arrived"
const IDLE_TASK_TICKS = 80   // ~8 s of random wandering before picking a new task
const IDLE_WANDER_TICKS_MIN = 20  // ticks between wander cell picks
const IDLE_WANDER_TICKS_RANGE = 30
const REST_TICKS_MIN = 4 * IDLE_TASK_TICKS   // ~32 s — at least 4 task cycles at home
const REST_TICKS_MAX = 7 * IDLE_TASK_TICKS   // ~56 s
const BUBBLE_TICKS = 30   // 3 s — how long a task bubble stays visible
const CHAT_TICKS = 80   // 8 s — how long two walkers chat when they meet
const CHAT_DIST = ARRIVE_DIST * 2.5  // proximity to trigger chat
const CHAT_EMOJIS = ['😅', '😬', '😢', '🤔', '🥳', '🥱', '😎', '🤣', '😍', '🥰', '🤩', '😤', '🤬', '🤯', '🥵']
const ATTACK_WARN_MS = 30 * 60 * 1000  // show panic tasks when attack < 30 min away
const PATROL_DEFENSE_PER_WALKER = 1     // residents give minimal defence — build fortifications
const TASK_RESOURCE_GOLD: Partial<Record<ResourceType, number>> = {
  wheat: 2, wood: 2, ore: 3, bread: 4, planks: 4, metal: 5,
}


// Compute edge-following waypoints from (fromX,fromY) to (toX,toY) through cell-border midpoints
/**
 * Routes any walker via the road grid.
 *
 * Every cell has one exit/entry point: the centre of the path immediately
 * below it — (col+0.5)×cellW, (row+1)×cellH.
 *
 * A journey from A to B always follows this shape:
 *   1. Walk straight down from the source cell centre to its exit point.
 *   2. Walk along the horizontal road to the nearest vertical road junction.
 *   3. Walk along the vertical road to the destination row's horizontal road.
 *   4. Walk along that horizontal road to the destination entry point.
 *   5. Walk straight up into the destination cell centre.
 *
 * Only steps 1 and 5 leave the road network (inside the building cell).
 */
export function computeRoadWaypoints(
  fromX: number, fromY: number,
  toX: number, toY: number,
  overlayW: number, overlayH: number,
  cityRows: number,
  _roadWear: RoadWearMap,
  cityCols: number,
): { x: number; y: number }[] {
  const cellW = overlayW / cityCols
  const cellH = overlayH / cityRows
  const fc = Math.max(0, Math.min(cityCols - 1, Math.floor(fromX / cellW)))
  const fr = Math.max(0, Math.min(cityRows - 1, Math.floor(fromY / cellH)))
  const tc = Math.max(0, Math.min(cityCols - 1, Math.floor(toX / cellW)))
  const tr = Math.max(0, Math.min(cityRows - 1, Math.floor(toY / cellH)))
  if (fc === tc && fr === tr) return []

  // Exit point = centre of road gap immediately below source cell (clamped to overlay)
  const srcExX = (fc + 0.5) * cellW
  const srcExY = Math.min((fr + 1) * cellH, overlayH - UNIT_SIZE)
  // Entry point = centre of road gap immediately below destination cell (clamped)
  const dstEnX = (tc + 0.5) * cellW
  const dstEnY = Math.min((tr + 1) * cellH, overlayH - UNIT_SIZE)

  const pts: { x: number; y: number }[] = []

  // Step 1: exit source building downward to exit point
  pts.push({ x: srcExX, y: srcExY })

  if (fr === tr) {
    // Same row: already on the same horizontal road — walk straight across
    if (Math.abs(srcExX - dstEnX) > 0.5) pts.push({ x: dstEnX, y: srcExY })
  } else {
    // Different rows: route via a vertical road junction.
    // Choose the vertical road on the side facing the destination column.
    const vx = tc >= fc
      ? Math.min((fc + 1) * cellW, (cityCols - 1) * cellW)  // right border of source col
      : Math.max(fc * cellW, cellW)                           // left border of source col
    if (Math.abs(srcExX - vx) > 0.5)   pts.push({ x: vx, y: srcExY  }) // along src horizontal road
    if (Math.abs(srcExY - dstEnY) > 0.5) pts.push({ x: vx, y: dstEnY }) // down/up vertical road
    if (Math.abs(vx - dstEnX) > 0.5)   pts.push({ x: dstEnX, y: dstEnY }) // along dst horizontal road
  }

  // Step 5: enter destination building upward from entry point
  pts.push({ x: toX, y: toY })
  return pts
}

function makeWalker(cellIndex: number, unitIndex: number, unitName: string, affinityWith?: string, w = CITY_COLS * CELL_PX, h = CITY_ROWS * CELL_PX): Walker {
  const angle = Math.random() * Math.PI * 2
  // Deterministic trait so the same resident always has the same personality
  const traitSeed = (cellIndex * 13 + unitIndex * 7 + unitName.charCodeAt(0)) % 5
  const TRAITS: PersonalityTrait[] = ['brave', 'glutton', 'industrious', 'sociable', 'reclusive']
  return {
    cellIndex,
    unitIndex,
    unitName,
    affinityWith,
    x: Math.random() * Math.max(1, w - UNIT_SIZE),
    y: Math.random() * Math.max(1, h - UNIT_SIZE),
    vx: Math.cos(angle) * SPEED,
    vy: Math.sin(angle) * SPEED,
    turnTimer: 20 + Math.floor(Math.random() * 30),
    task: { type: 'idle', label: '🚶 Taking a stroll' },
    taskTimer: Math.floor(Math.random() * IDLE_TASK_TICKS),
    bubbleTimer: 0,
    hidden: false,
    hiddenTimer: 0,
    trait: TRAITS[traitSeed],
    waypoints: [],
  }
}

// ── Task selection ────────────────────────────────────────────────────────────

function pickTask(
  w: Walker,
  allWalkers: Walker[],
  city: CityState,
  overlayW: number,
  overlayH: number,
): WalkerTask {
  const cityRows = city.rows ?? CITY_ROWS
  const cityCols = city.cols ?? CITY_COLS

  function cellPos(idx: number) {
    return {
      x: ((idx % cityCols) + 0.5) * (overlayW / cityCols),
      y: (Math.floor(idx / cityCols) + 0.5) * (overlayH / cityRows),
    }
  }

  const home = cellPos(w.cellIndex)

  // Perimeter cells (shared by patrol and panic tasks)
  const perimCells: { col: number; row: number }[] = []
  for (let col = 0; col < cityCols; col++) {
    perimCells.push({ col, row: 0 }, { col, row: cityRows - 1 })
  }
  for (let row = 1; row < cityRows - 1; row++) {
    perimCells.push({ col: 0, row }, { col: cityCols - 1, row })
  }

  // ── Attack imminent: residents panic ─────────────────────────────────────────
  const msToAttack = city.nextAttackAt - Date.now()
  if (msToAttack > 0 && msToAttack <= ATTACK_WARN_MS) {
    const perim = perimCells[Math.floor(Math.random() * perimCells.length)]
    const defendTarget = {
      targetX: (perim.col + 0.5) * (overlayW / cityCols),
      targetY: (perim.row + 0.5) * (overlayH / cityRows),
    }
    const panicTasks: WalkerTask[] = [
      { type: 'resting', label: '🏠 Taking shelter!', targetX: home.x, targetY: home.y },
      { type: 'resting', label: '🏠 Hiding at home!', targetX: home.x, targetY: home.y },
      { type: 'patrolling', label: '⚔ Preparing to defend!', ...defendTarget },
      { type: 'patrolling', label: '🛡 Defending the walls!', ...defendTarget },
    ]
    return panicTasks[Math.floor(Math.random() * panicTasks.length)]
  }

  // ── Normal task selection ─────────────────────────────────────────────────────
  const available: WalkerTask[] = []

  // Idle — always available
  available.push({ type: 'idle', label: '🚶 Taking a stroll' })

  // Resting — return to home building
  available.push({ type: 'resting', label: '💤 Heading home', targetX: home.x, targetY: home.y })

  // Eating — walk to best available food source: warehouse with stock → bread producer → wheat producer
  const warehousesWithFood = city.grid
    .map((cell, i) => ({ cell, i }))
    .filter(({ cell }) => cell && !cell.spawnedUnitName &&
      /warehouse|barn|granary|silo|storehouse|vault/i.test(cell.cardName) &&
      ((cell.stock?.bread ?? 0) > 1 || (cell.stock?.wheat ?? 0) > 1))
  const breadProducers = city.grid
    .map((cell, i) => ({ cell, i }))
    .filter(({ cell }) => cell && !cell.spawnedUnitName && (getBuildingProduces(cell.cardName).bread ?? 0) > 0)
  const wheatProducers = city.grid
    .map((cell, i) => ({ cell, i }))
    .filter(({ cell }) => cell && !cell.spawnedUnitName && (getBuildingProduces(cell.cardName).wheat ?? 0) > 0)
  const foodSources = warehousesWithFood.length > 0 ? warehousesWithFood
    : breadProducers.length > 0 ? breadProducers
    : wheatProducers
  if (foodSources.length > 0) {
    const { i } = foodSources[Math.floor(Math.random() * foodSources.length)]
    const pos = cellPos(i)
    const foodResource = warehousesWithFood.length > 0 || breadProducers.length > 0 ? 'bread' : 'wheat'
    available.push({ type: 'eating', label: '🌾 Getting food', targetX: pos.x, targetY: pos.y, resource: foodResource })
  }

  // Patrolling — walk to a random perimeter cell
  const perim = perimCells[Math.floor(Math.random() * perimCells.length)]
  available.push({
    type: 'patrolling',
    label: '🛡 Patrolling the walls',
    targetX: (perim.col + 0.5) * (overlayW / cityCols),
    targetY: (perim.row + 0.5) * (overlayH / cityRows),
  })

  // Gathering — walk to a resource-producing building
  const resourceJobs: { key: ResourceType; label: string }[] = [
    { key: 'wood', label: '🪵 Chopping wood' },
    { key: 'ore', label: '⛏ Mining ore' },
    { key: 'planks', label: '🪵 Fetching planks' },
    { key: 'metal', label: '⚙ Getting metal' },
    { key: 'bread', label: '🍞 Buying bread' },
  ]
  for (const { key, label } of resourceJobs) {
    const producers = city.grid
      .map((cell, i) => ({ cell, i }))
      .filter(({ cell }) => cell && !cell.spawnedUnitName && (getBuildingProduces(cell.cardName)[key] ?? 0) > 0)
    if (producers.length > 0) {
      const { i } = producers[Math.floor(Math.random() * producers.length)]
      const pos = cellPos(i)
      available.push({ type: 'gathering', label, targetX: pos.x, targetY: pos.y, resource: key })
    }
  }

  // Visiting — both walkers meet at the exit point below the target's cell
  const others = allWalkers.filter(
    other => !(other.cellIndex === w.cellIndex && other.unitIndex === w.unitIndex) && !other.hidden,
  )
  if (others.length > 0) {
    const target = others[Math.floor(Math.random() * others.length)]
    const name = residentName(target.unitName, target.cellIndex, target.unitIndex)
    const cellW = overlayW / cityCols, cellH = overlayH / cityRows
    const tCol = Math.max(0, Math.min(cityCols - 1, Math.floor(target.x / cellW)))
    const tRow = Math.max(0, Math.min(cityRows - 1, Math.floor(target.y / cellH)))
    // Meeting point = exit of target's cell (clamped to overlay)
    const meetX = (tCol + 0.5) * cellW
    const meetY = Math.min((tRow + 1) * cellH, overlayH - UNIT_SIZE)
    available.push({
      type: 'visiting',
      label: `👋 Visiting ${name.split(' ')[0]}`,
      targetX: meetX,
      targetY: meetY,
      targetWalkerKey: `${target.cellIndex}-${target.unitIndex}`,
    })
  }

  // Playing — wander to a random open spot
  available.push({
    type: 'playing',
    label: '🎉 Playing around',
    targetX: Math.random() * Math.max(1, overlayW - UNIT_SIZE),
    targetY: Math.random() * Math.max(1, overlayH - UNIT_SIZE),
  })

  // Weight tasks by personality trait
  function traitWeight(task: WalkerTask, trait: PersonalityTrait | undefined): number {
    if (!trait) return 1
    switch (trait) {
      case 'brave':       return task.type === 'patrolling' ? 4 : task.type === 'resting' ? 0.3 : 1
      case 'glutton':     return task.type === 'eating'     ? 5 : 1
      case 'industrious': return task.type === 'gathering'  ? 5 : task.type === 'idle' ? 0.3 : 1
      case 'sociable':    return (task.type === 'visiting' || task.type === 'chatting') ? 4 : 1
      case 'reclusive':   return task.type === 'resting'  ? 4 : task.type === 'idle' ? 2
                               : task.type === 'visiting' ? 0.2 : 1
      default: return 1
    }
  }
  const weights = available.map(t => traitWeight(t, w.trait))
  const total   = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < available.length; i++) {
    r -= weights[i]
    if (r <= 0) return available[i]
  }
  return available[available.length - 1]
}

// ── Attack countdown helpers ──────────────────────────────────────────────────

export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'IMMINENT'
  const totalMin = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// ── City tower pool ───────────────────────────────────────────────────────────

function buildCityTowerPool(city: CityState): TowerPool[] {
  const catalog = getCardCatalog()
  const counts: Record<string, number> = {}

  for (let i = 0; i < city.grid.length; i++) {
    const cell = city.grid[i]
    if (!cell?.spawnedUnitName) continue
    if ((city.happiness[i] ?? 100) <= 0) continue
    const unitCount = spawnerUnitCount(city, cell.cardName)
    counts[cell.spawnedUnitName] = (counts[cell.spawnedUnitName] ?? 0) + unitCount
  }

  const pool: TowerPool[] = []
  for (const [unitName, total] of Object.entries(counts)) {
    let template: UnitTemplate | undefined
    let buildingName: string | undefined
    // Prefer the spawner building card over a plain unit card
    for (const card of catalog) {
      if (card.unit?.structureEffect?.type === 'spawn') {
        const se = card.unit.structureEffect as { type: 'spawn'; unitTemplate: UnitTemplate }
        if (se.unitTemplate.name === unitName) { template = se.unitTemplate; buildingName = card.name; break }
      }
    }
    if (!template) {
      for (const card of catalog) {
        if (card.unit?.name === unitName) { template = card.unit; buildingName = card.name; break }
      }
    }
    if (template && buildingName) pool.push({ template, total, buildingName })
  }
  return pool
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
}

type SubScreen = 'city' | 'picker' | 'upgrade' | 'levelup' | 'fortify' | 'towerdefence' | 'chronicle' | 'stats' | 'zones' | 'farming'

export function CityBuilder({ onBack }: Props) {
  const [city, setCity] = useState<CityState>(() => tickCity(loadCityState()))
  const [screen, setScreen] = useState<SubScreen>('city')
  const [pendingMilestone, setPendingMilestone] = useState<MilestoneDef | null>(null)
  const [showTrade, setShowTrade] = useState(false)
  const [showDisaster, setShowDisaster] = useState(false)
  const [pickerIndex, setPickerIndex] = useState<number>(0)
  const [levelCard, setLevelCard] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [walkers, setWalkers] = useState<Walker[]>([])
  const [builderWalkers, setBuilderWalkers] = useState<BuilderWalker[]>([])
  const [visualCarriers, setVisualCarriers] = useState<VisualCarrier[]>([])
  const [activeBrush, setActiveBrush] = useState<{ name: string; card?: Card; coreBuild?: CoreBuilding } | null>(null)
  const visualCarriersRef = useRef<VisualCarrier[]>([])
  const [selectedWalker, setSelectedWalker] = useState<{ cellIndex: number; unitIndex: number } | null>(null)
  const [selectedBuildingCell, setSelectedBuildingCell] = useState<number | null>(null)
  const [buildingTab, setBuildingTab] = useState<'residents' | 'upgrade'>('residents')
  const [pickerSearch, setPickerSearch] = useState('')
  const [upgradeSearch, setUpgradeSearch] = useState('')
  const [bulldozerMode, setBulldozerMode] = useState(false)
  const bulldozerRef = useRef(false)
  const [residentThoughts, setResidentThoughts] = useState<ResidentThought[]>([])
  const [attackReport, setAttackReport] = useState<AttackEvent | null>(null)
  const attackShownRef = useRef<number | null>(
    (() => {
      try {
        const stored = localStorage.getItem('city-attack-shown-at')
        return stored ? Number(stored) : null
      } catch { return null }
    })()
  )
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [fortSlotSel, setFortSlotSel] = useState<number | null>(null)
  const [showFarmLockModal, setShowFarmLockModal] = useState(false)
  const [showExpandModal, setShowExpandModal] = useState(false)
  const worldRef = useRef<HTMLDivElement>(null)
  const worldDimsRef = useRef({ w: CITY_COLS * CELL_PX, h: CITY_ROWS * CELL_PX })
  const fortRingRef = useRef<HTMLDivElement>(null)
  const fortRingDimsRef = useRef({ w: CITY_COLS * CELL_PX, h: CITY_ROWS * CELL_PX })
  const cityRef = useRef(city)
  const walkersRef = useRef(walkers)
  const builderWalkersRef = useRef(builderWalkers)
  const screenRef = useRef(screen)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function save(next: CityState) {
    const { state: checked, newlyCompleted } = checkMilestones(next)
    setCity(checked)
    saveCityState(checked)
    if (newlyCompleted.length > 0 && !pendingMilestone) {
      setPendingMilestone(newlyCompleted[0])
    }
  }

  // Keep refs in sync so the animation loop and intervals always see the latest state
  useEffect(() => { cityRef.current = city }, [city])
  useEffect(() => { walkersRef.current = walkers }, [walkers])
  useEffect(() => { builderWalkersRef.current = builderWalkers }, [builderWalkers])
  useEffect(() => { screenRef.current = screen }, [screen])

  // Show attack report when a new attack is detected
  useEffect(() => {
    if (city.lastAttack && city.lastAttack.at !== attackShownRef.current) {
      setAttackReport(city.lastAttack)
      attackShownRef.current = city.lastAttack.at
      try { localStorage.setItem('city-attack-shown-at', String(city.lastAttack.at)) } catch { /* ignore */ }
    }
  }, [city.lastAttack])

  // Reset building modal to residents tab when returning to city screen
  useEffect(() => {
    if (screen === 'city') setBuildingTab('residents')
  }, [screen])

  // Update countdown clock every minute
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Track actual grid pixel dimensions for walker bounds.
  // Re-run on screen changes so the observer re-attaches to the remounted city-world div
  // and ignores the zero-size callback fired when the div is removed from the DOM.
  useEffect(() => {
    const el = worldRef.current
    if (!el) return
    const update = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        worldDimsRef.current = { w: el.clientWidth, h: el.clientHeight }
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  // Track fort ring dimensions
  useEffect(() => {
    const el = fortRingRef.current
    if (!el) return
    const update = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        fortRingDimsRef.current = { w: el.clientWidth, h: el.clientHeight }
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  // ── Sync walkers when grid changes ───────────────────────────────────────────

  useEffect(() => {
    setWalkers(prev => {
      const next: Walker[] = []
      for (let i = 0; i < city.grid.length; i++) {
        const cell = city.grid[i]
        if (!cell?.spawnedUnitName) continue
        if ((city.happiness[i] ?? 100) === 0) continue
        const count = spawnerUnitCount(city, cell.cardName)
        for (let u = 0; u < count; u++) {
          const existing = prev.find(w => w.cellIndex === i && w.unitIndex === u && w.unitName === cell.spawnedUnitName)
          const { w: dw, h: dh } = worldDimsRef.current
          const effectiveDw = dw || CITY_COLS * CELL_PX
          const effectiveDh = dh || CITY_ROWS * CELL_PX
          next.push(existing ?? makeWalker(i, u, cell.spawnedUnitName, cell.affinityWith, effectiveDw, effectiveDh))
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.grid])

  // ── Sync builder walkers when queue changes ───────────────────────────────────

  useEffect(() => {
    setBuilderWalkers(prev => {
      const { w: dw, h: dh } = worldDimsRef.current
      const overlayW = dw || CITY_COLS * CELL_PX
      const overlayH = dh || CITY_ROWS * CELL_PX
      return city.builderQueue.map((entry, i) => {
        const existing = prev.find(b => b.queueIndex === i && b.cardName === entry.cardName)
        return existing ?? makeBuilderWalker(i, entry.cardName, overlayW, overlayH)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.builderQueue])

  // ── Animation loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      const { w: _w, h: _h } = worldDimsRef.current
      const overlayW = _w || CITY_COLS * CELL_PX
      const overlayH = _h || CITY_ROWS * CELL_PX

      setWalkers(prev => {
        // ── Pass 0: find walkers that are the target of a visiting task ──────
        const visitTargetKeys = new Set<string>()
        for (const w of prev) {
          if (w.task.type === 'visiting' && w.task.targetWalkerKey) {
            visitTargetKeys.add(w.task.targetWalkerKey)
          }
        }

        // ── Pass 1: find visiting walkers close enough to trigger chat ────────
        const chatPairs = new Map<string, string>()  // walkerKey → emoji
        for (const w of prev) {
          if (w.hidden || w.task.type !== 'visiting' || !w.task.targetWalkerKey) continue
          const wKey = `${w.cellIndex}-${w.unitIndex}`
          if (chatPairs.has(wKey)) continue
          const [ci, ui] = w.task.targetWalkerKey.split('-').map(Number)
          const target = prev.find(o => o.cellIndex === ci && o.unitIndex === ui && !o.hidden)
          if (!target || target.task.type === 'chatting') continue
          const dx = target.x - w.x
          const dy = target.y - w.y
          if (Math.sqrt(dx * dx + dy * dy) < CHAT_DIST) {
            const tKey = `${target.cellIndex}-${target.unitIndex}`
            chatPairs.set(wKey, CHAT_EMOJIS[Math.floor(Math.random() * CHAT_EMOJIS.length)])
            chatPairs.set(tKey, CHAT_EMOJIS[Math.floor(Math.random() * CHAT_EMOJIS.length)])
          }
        }

        // ── Pass 2: update each walker ────────────────────────────────────────
        const cityRows = cityRef.current?.rows ?? CITY_ROWS
        const cityCols = cityRef.current?.cols ?? CITY_COLS
        function wayptsFor(task: WalkerTask, fx: number, fy: number) {
          if (task.type === 'idle' || task.type === 'chatting' || task.targetX === undefined) return []
          const rw = (cityRef.current?.roadWear as RoadWearMap | undefined) ?? { h: [], v: [] }
          return computeRoadWaypoints(fx, fy, task.targetX, task.targetY!, overlayW, overlayH, cityRows, rw, cityCols)
        }

        return prev.map(w => {
          const wKey = `${w.cellIndex}-${w.unitIndex}`

          // ── Resting at home ────────────────────────────────────────────────
          if (w.hidden) {
            const hiddenTimer = w.hiddenTimer - 1
            if (hiddenTimer <= 0) {
              const task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
              const bubbleTimer = task.type !== 'idle' ? BUBBLE_TICKS : 0
              return {
                ...w, hidden: false, hiddenTimer: 0,
                task, taskTimer: task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0,
                bubbleTimer, waypoints: wayptsFor(task, w.x, w.y),
              }
            }
            return { ...w, hiddenTimer }
          }

          // ── Start chatting (triggered by Pass 1) ───────────────────────────
          if (chatPairs.has(wKey) && w.task.type !== 'chatting') {
            return {
              ...w, vx: 0, vy: 0,
              task: { type: 'chatting', label: chatPairs.get(wKey)! },
              taskTimer: CHAT_TICKS,
              bubbleTimer: CHAT_TICKS,
              waypoints: [],
            }
          }

          let { x, y, vx, vy, turnTimer, task, taskTimer, bubbleTimer } = w
          let waypoints = w.waypoints ?? []
          bubbleTimer = Math.max(0, bubbleTimer - 1)

          // ── Chatting: count down, then resume ──────────────────────────────
          if (task.type === 'chatting') {
            taskTimer--
            if (taskTimer <= 0) {
              task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
              taskTimer = task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0
              bubbleTimer = BUBBLE_TICKS
              waypoints = wayptsFor(task, x, y)
              const angle = Math.random() * Math.PI * 2
              vx = Math.cos(angle) * SPEED
              vy = Math.sin(angle) * SPEED
            }
            return { ...w, vx, vy, task, taskTimer, bubbleTimer, waypoints }
          }

          // ── Visiting: abandon if target has hidden ─────────────────────────
          if (task.type === 'visiting' && task.targetWalkerKey) {
            const [ci, ui] = task.targetWalkerKey.split('-').map(Number)
            const targetGone = !prev.find(o => o.cellIndex === ci && o.unitIndex === ui && !o.hidden)
            if (targetGone) {
              task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
              taskTimer = task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0
              if (task.type !== 'idle') bubbleTimer = BUBBLE_TICKS
              waypoints = wayptsFor(task, x, y)
            }
          }

          // ── If being visited while idle, walk to own exit point to meet ──────
          if (task.type === 'idle' && visitTargetKeys.has(wKey) && waypoints.length === 0) {
            const cellW = overlayW / cityCols, cellH = overlayH / cityRows
            const col = Math.max(0, Math.min(cityCols - 1, Math.floor(x / cellW)))
            const row = Math.max(0, Math.min(cityRows - 1, Math.floor(y / cellH)))
            const exitX = (col + 0.5) * cellW
            const exitY = Math.min((row + 1) * cellH, overlayH - UNIT_SIZE)
            waypoints = [{ x: exitX, y: exitY }]
          }

          // ── Idle: count down and pick a new task when timer expires ────────
          if (task.type === 'idle') {
            taskTimer--
            if (taskTimer <= 0) {
              task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
              taskTimer = task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0
              if (task.type !== 'idle') bubbleTimer = BUBBLE_TICKS
              waypoints = wayptsFor(task, x, y)
            }
            // Grid-following wander: navigate to a random adjacent cell via gap waypoints
            if (task.type === 'idle') {
              if (waypoints.length > 0) {
                // Follow current wander path
                const next = waypoints[0]
                const dx = next.x - x, dy = next.y - y
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < ARRIVE_DIST) {
                  waypoints = waypoints.slice(1)
                  turnTimer = 0  // immediately pick next cell
                } else {
                  vx = (dx / dist) * SPEED
                  vy = (dy / dist) * SPEED
                }
              }
              if (waypoints.length === 0) {
                turnTimer--
                if (turnTimer <= 0) {
                  const cellW = overlayW / cityCols
                  const cellH = overlayH / cityRows
                  const cc = Math.max(0, Math.min(cityRows - 1, Math.floor(y / cellH))) * cityCols +
                             Math.max(0, Math.min(cityCols - 1, Math.floor(x / cellW)))
                  const ns = getNeighbourIndices(cc, cityRows, cityCols)
                  const pick = ns[Math.floor(Math.random() * ns.length)] ?? cc
                  // Target neighbour cell centre — routing handles exit/entry via road gaps
                  const tx = (pick % cityCols + 0.5) * cellW
                  const ty = (Math.floor(pick / cityCols) + 0.5) * cellH
                  const rw = (cityRef.current?.roadWear as RoadWearMap | undefined) ?? { h: [], v: [] }
                  const wps = computeRoadWaypoints(x, y, tx, ty, overlayW, overlayH, cityRows, rw, cityCols)
                  waypoints = wps.length > 0 ? wps : [{ x: tx, y: ty }]
                  turnTimer = IDLE_WANDER_TICKS_MIN + Math.floor(Math.random() * IDLE_WANDER_TICKS_RANGE)
                }
              }
            }
          }

          // ── Directed movement (waypoint-following) ─────────────────────────
          if (task.type !== 'idle' && task.type !== 'chatting' && task.targetX !== undefined && task.targetY !== undefined) {
            const useWaypoints = true
            const currentTarget = (useWaypoints && waypoints.length > 0)
              ? waypoints[0]
              : { x: task.targetX, y: task.targetY }

            const dx = currentTarget.x - x
            const dy = currentTarget.y - y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist < ARRIVE_DIST) {
              if (useWaypoints && waypoints.length > 0) {
                // Pop waypoint, aim at next
                waypoints = waypoints.slice(1)
                const next = waypoints.length > 0 ? waypoints[0] : { x: task.targetX, y: task.targetY }
                const ndx = next.x - x, ndy = next.y - y
                const nd  = Math.sqrt(ndx * ndx + ndy * ndy)
                const nextSpd = (waypoints.length > 0 ? (waypoints[0].speed ?? 1) : 1)
                if (nd > 1) { vx = (ndx / nd) * SPEED * nextSpd; vy = (ndy / nd) * SPEED * nextSpd }
              } else if (task.type === 'resting') {
                return {
                  ...w, x, y, vx: 0, vy: 0, task, bubbleTimer,
                  hidden: true, waypoints: [],
                  hiddenTimer: REST_TICKS_MIN + Math.floor(Math.random() * (REST_TICKS_MAX - REST_TICKS_MIN)),
                }
              } else {
                vx = 0; vy = 0
                task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
                taskTimer = task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0
                if (task.type !== 'idle') bubbleTimer = BUBBLE_TICKS
                waypoints = wayptsFor(task, x, y)
              }
            } else {
              const curSpd = (currentTarget as { speed?: number }).speed ?? 1
              vx = (dx / dist) * SPEED * curSpd
              vy = (dy / dist) * SPEED * curSpd
            }
          }

          // ── Apply movement ─────────────────────────────────────────────────
          x += vx
          y += vy
          if (x < 0) { x = 0; vx = Math.abs(vx) }
          if (x > overlayW - UNIT_SIZE) { x = overlayW - UNIT_SIZE; vx = -Math.abs(vx) }
          if (y < 0) { y = 0; vy = Math.abs(vy) }
          if (y > overlayH - UNIT_SIZE) { y = overlayH - UNIT_SIZE; vy = -Math.abs(vy) }

          return { ...w, x, y, vx, vy, turnTimer, task, taskTimer, bubbleTimer, waypoints }
        })
      })

      // Animate builder walkers
      setBuilderWalkers(prev => prev.map(b => {
        let { x, y, vx, vy, phase, targetX, targetY, label,
          ringX, ringY, ringVx, ringVy, ringPhase, ringTargetX, ringTargetY } = b
        let waypoints = b.waypoints ?? []
        const { w: rw, h: rh } = fortRingDimsRef.current
        const bRw = (cityRef.current?.roadWear as RoadWearMap | undefined) ?? { h: [], v: [] }

        // ── City-world movement (road-following waypoints) ─────────────────
        const currentWP = waypoints.length > 0 ? waypoints[0] : { x: targetX, y: targetY }
        const dx = currentWP.x - x, dy = currentWP.y - y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < ARRIVE_DIST) {
          if (waypoints.length > 0) {
            waypoints = waypoints.slice(1)
          } else {
            const next = pickBuilderTarget(phase, cityRef.current, overlayW, overlayH)
            phase = next.nextPhase; targetX = next.targetX; targetY = next.targetY; label = next.label
            waypoints = computeRoadWaypoints(x, y, targetX, targetY, overlayW, overlayH, cityRows, bRw, cityCols)
          }
        }
        if (dist > 1) { vx = (dx / dist) * BUILDER_SPEED; vy = (dy / dist) * BUILDER_SPEED }
        x += vx; y += vy
        x = Math.max(0, Math.min(overlayW - UNIT_SIZE, x))
        y = Math.max(0, Math.min(overlayH - UNIT_SIZE, y))

        // ── Ring-view movement (independent phase, correct slot targets) ────
        const rdx = ringTargetX - ringX, rdy = ringTargetY - ringY
        const rdist = Math.sqrt(rdx * rdx + rdy * rdy)
        if (rdist < RING_ARRIVE_DIST) {
          ringPhase = ringPhase === 'fetching' ? 'delivering' : 'fetching'
          const rt = pickRingTarget(ringPhase, b.queueIndex, cityRef.current, rw || CITY_COLS * CELL_PX, rh || CITY_ROWS * CELL_PX)
          ringTargetX = rt.targetX; ringTargetY = rt.targetY
        }
        if (rdist > 1) { ringVx = (rdx / rdist) * BUILDER_SPEED; ringVy = (rdy / rdist) * BUILDER_SPEED }
        ringX += ringVx; ringY += ringVy
        ringX = Math.max(0, Math.min((rw || CITY_COLS * CELL_PX) - RING_UNIT_SIZE, ringX))
        ringY = Math.max(0, Math.min((rh || CITY_ROWS * CELL_PX) - RING_UNIT_SIZE, ringY))

        return {
          ...b, x, y, vx, vy, phase, targetX, targetY, waypoints, label,
          ringX, ringY, ringVx, ringVy, ringPhase, ringTargetX, ringTargetY
        }
      }))

      // ── Animate resource carriers ─────────────────────────────────────────────
      const gameCarriers = cityRef.current?.carriers ?? []
      const gameCarrierIds = new Set(gameCarriers.map(c => c.id))
      const cityRows = cityRef.current?.rows ?? CITY_ROWS
      const cityCols = cityRef.current?.cols ?? CITY_COLS

      // Sync: keep carriers still in game state OR still finishing their shrink-out animation
      let nextVis = visualCarriersRef.current.filter(vc => gameCarrierIds.has(vc.id) || vc.scale > 0)

      // Spawn new carriers — goblin starts at toCell (consumer) and walks outbound to fromCell (producer)
      const visIds = new Set(nextVis.map(vc => vc.id))
      for (const gc of gameCarriers) {
        if (visIds.has(gc.id)) continue
        const c1 = gc.fromCell % cityCols, r1 = Math.floor(gc.fromCell / cityCols)
        const pickX = (c1 + 0.5) * overlayW / cityCols
        const pickY = (r1 + 0.5) * overlayH / cityRows
        const c2 = gc.toCell % cityCols, r2 = Math.floor(gc.toCell / cityCols)
        const dropX = (c2 + 0.5) * overlayW / cityCols
        const dropY = (r2 + 0.5) * overlayH / cityRows
        // Outbound: start at drop-off (consumer), walk to pick-up (producer)
        const rw = (cityRef.current?.roadWear as RoadWearMap | undefined) ?? { h: [], v: [] }
        const wps = computeRoadWaypoints(dropX, dropY, pickX, pickY, overlayW, overlayH, cityRows, rw, cityCols)
        const first = wps.length > 0 ? wps[0] : { x: pickX, y: pickY }
        const dd = Math.sqrt((first.x - dropX) ** 2 + (first.y - dropY) ** 2)
        nextVis.push({
          id: gc.id, carrying: gc.carrying,
          x: dropX, y: dropY,
          vx: dd > 0 ? (first.x - dropX) / dd * SPEED : 0,
          vy: dd > 0 ? (first.y - dropY) / dd * SPEED : 0,
          waypoints: wps,
          scale: 0,
          phase: 'outbound',
          pickX, pickY, dropX, dropY,
        })
      }

      // Move each carrier toward its current phase target
      nextVis = nextVis.map(vc => {
        const phaseDestX = vc.phase === 'outbound' ? vc.pickX : vc.dropX
        const phaseDestY = vc.phase === 'outbound' ? vc.pickY : vc.dropY
        const target = vc.waypoints.length > 0 ? vc.waypoints[0] : { x: phaseDestX, y: phaseDestY }
        let { x, y, vx, vy } = vc
        let waypoints = vc.waypoints
        let scale = vc.scale
        let phase = vc.phase
        // Scale up from spawn building before moving
        if (scale < 1 && waypoints.length === 0 && Math.sqrt((target.x - x) ** 2 + (target.y - y) ** 2) < ARRIVE_DIST) {
          // already at destination — skip to shrink
        } else if (scale < 1) {
          scale = Math.min(1, scale + 0.1)
          return { ...vc, waypoints, scale }
        }
        const dx = target.x - x, dy = target.y - y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < ARRIVE_DIST && waypoints.length > 0) {
          waypoints = waypoints.slice(1)
          const next = waypoints.length > 0 ? waypoints[0] : { x: phaseDestX, y: phaseDestY }
          const nd = Math.sqrt((next.x - x) ** 2 + (next.y - y) ** 2)
          if (nd > 0) { vx = (next.x - x) / nd * SPEED; vy = (next.y - y) / nd * SPEED }
        } else if (dist < ARRIVE_DIST && phase === 'outbound') {
          // Arrived at producer — switch to returning, compute return waypoints
          const rw2 = (cityRef.current?.roadWear as RoadWearMap | undefined) ?? { h: [], v: [] }
          const wps = computeRoadWaypoints(x, y, vc.dropX, vc.dropY, overlayW, overlayH, cityRows, rw2, cityCols)
          const first = wps.length > 0 ? wps[0] : { x: vc.dropX, y: vc.dropY }
          const nd = Math.sqrt((first.x - x) ** 2 + (first.y - y) ** 2)
          phase = 'returning'
          waypoints = wps
          if (nd > 0) { vx = (first.x - x) / nd * SPEED; vy = (first.y - y) / nd * SPEED }
        } else if (dist < ARRIVE_DIST && phase === 'returning') {
          // Arrived at consumer — shrink into building
          vx = 0; vy = 0
          scale = Math.max(0, scale - 0.1)
        } else if (dist > 0) {
          vx = dx / dist * SPEED; vy = dy / dist * SPEED
        }
        x += vx; y += vy
        return { ...vc, x, y, vx, vy, waypoints, scale, phase }
      })

      visualCarriersRef.current = nextVis
      setVisualCarriers([...nextVis])
    }, 100)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { bulldozerRef.current = bulldozerMode }, [bulldozerMode])

  // ── Gold + resource tick (every 10 s while screen is open) ───────────────────

  useEffect(() => {
    const id = setInterval(() => {
      if (bulldozerRef.current) return
      setCity(prev => {
        let next = tickCity(prev)

        // Tick the farm and apply its output to city resources when farm screen
        // is not open (FarmingSim handles its own tick when the farm is visible).
        if (screenRef.current !== 'farming' && isFarmUnlocked(cityPopulation(next))) {
          const farmState = loadFarmState()
          const { nextState: nextFarm, resourcesForCity } = tickFarm(farmState)
          saveFarmState(nextFarm)
          const hasResources = Object.values(resourcesForCity).some(v => (v ?? 0) > 0)
          if (hasResources) {
            const newRes = { ...next.resources }
            for (const [res, amt] of Object.entries(resourcesForCity) as [ResourceType, number][]) {
              newRes[res] = Math.round((newRes[res] ?? 0) + amt)
            }
            next = { ...next, resources: newRes }
          }
        }

        saveCityState(next)
        return next
      })
    }, 10_000)
    return () => clearInterval(id)
  }, [])

  // ── Resident thoughts (rebuild every 15 s and on city change) ────────────────

  useEffect(() => {
    setResidentThoughts(buildResidentThoughts(city, cityPopulation(city), walkersRef.current))
    // walkersRef.current used intentionally — avoids rebuilding every animation tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city])

  useEffect(() => {
    const id = setInterval(() => {
      setCity(prev => {
        setResidentThoughts(buildResidentThoughts(prev, cityPopulation(prev), walkersRef.current))
        return prev
      })
    }, 15_000)
    return () => clearInterval(id)
  }, [])

  // ── Resident task economy (every 5 s) ────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      const ws = walkersRef.current
      let goldDelta = 0
      const resDelta: Partial<Record<ResourceType, number>> = {}
      let patrolCount = 0

      for (const w of ws) {
        if (w.hidden) continue
        if (w.task.type === 'patrolling') {
          patrolCount++
        } else if ((w.task.type === 'eating' || w.task.type === 'gathering') && w.task.resource) {
          const res = w.task.resource as ResourceType
          resDelta[res] = (resDelta[res] ?? 0) - 1
          goldDelta += TASK_RESOURCE_GOLD[res] ?? 2
        }
      }

      if (goldDelta !== 0 || Object.keys(resDelta).length > 0 || patrolCount >= 0) {
        setCity(prev => {
          const newResources = { ...prev.resources }
          for (const [key, delta] of Object.entries(resDelta) as [ResourceType, number][]) {
            newResources[key] = Math.max(0, newResources[key] + delta)
          }
          return {
            ...prev,
            gold: Math.max(0, prev.gold + goldDelta),
            resources: newResources,
            patrolBonus: patrolCount * PATROL_DEFENSE_PER_WALKER,
          }
        })
      }
    }, 5_000)
    return () => clearInterval(id)
  }, [])

  // ── Cell interaction ──────────────────────────────────────────────────────────

  function applyBrush(index: number) {
    if (!activeBrush || city.grid[index]) return
    if (activeBrush.card) {
      const card = activeBrush.card
      const spawnEffect = card.unit?.structureEffect
      const isSpawner = spawnEffect?.type === 'spawn'
      if (isSpawner && !canAffordPlacement(city, card.rarity)) return
      const spawnedUnitName = isSpawner
        ? (spawnEffect as { type: 'spawn'; unitTemplate: { name: string }; intervalMs: number }).unitTemplate.name
        : undefined
      const affinityWith = isSpawner
        ? (spawnEffect as { type: 'spawn'; unitTemplate: { affinity?: { withName: string } }; intervalMs: number }).unitTemplate.affinity?.withName
        : card.unit?.affinity?.withName
      save(placeCard(city, index, { cardName: card.name, rarity: card.rarity, spawnedUnitName, affinityWith, stock: {} }))
    } else if (activeBrush.coreBuild) {
      const building = activeBrush.coreBuild
      if (!canAffordCoreBuild(city, building)) return
      save(placeCoreBuild(city, index, building))
    }
  }

  function handleCellTap(index: number) {
    if (activeBrush && !city.grid[index]) {
      applyBrush(index)
      return
    }
    if (city.grid[index]) {
      if (bulldozerMode) {
        const cell = city.grid[index]!
        save(removeCard(city, index))
        showToast(`${cell.cardName} demolished.`)
      } else {
        setBuildingTab('residents')
        setSelectedBuildingCell(index)
      }
    } else {
      setPickerIndex(index)
      setScreen('picker')
    }
  }

  const handlePaint = useCallback((index: number) => {
    if (!activeBrush || city.grid[index]) return
    if (activeBrush.card) {
      const card = activeBrush.card
      const spawnEffect = card.unit?.structureEffect
      const isSpawner = spawnEffect?.type === 'spawn'
      if (isSpawner && !canAffordPlacement(cityRef.current, card.rarity)) return
      const spawnedUnitName = isSpawner
        ? (spawnEffect as { type: 'spawn'; unitTemplate: { name: string }; intervalMs: number }).unitTemplate.name
        : undefined
      const affinityWith = isSpawner
        ? (spawnEffect as { type: 'spawn'; unitTemplate: { affinity?: { withName: string } }; intervalMs: number }).unitTemplate.affinity?.withName
        : card.unit?.affinity?.withName
      save(placeCard(cityRef.current, index, { cardName: card.name, rarity: card.rarity, spawnedUnitName, affinityWith, stock: {} }))
    } else if (activeBrush.coreBuild) {
      const building = activeBrush.coreBuild
      if (!canAffordCoreBuild(cityRef.current, building)) return
      save(placeCoreBuild(cityRef.current, index, building))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrush])

  function toggleBulldozer() {
    setBulldozerMode(prev => !prev)
    setSelectedBuildingCell(null)
    setSelectedWalker(null)
    setActiveBrush(null)
  }

  // ── Place a card ──────────────────────────────────────────────────────────────

  const handlePickCard = useCallback((card: Card) => {
    const spawnEffect = card.unit?.structureEffect
    const isSpawner = spawnEffect?.type === 'spawn'
    const spawnedUnitName = isSpawner
      ? (spawnEffect as { type: 'spawn'; unitTemplate: { name: string }; intervalMs: number }).unitTemplate.name
      : undefined

    if (isSpawner && !canAffordPlacement(city, card.rarity)) {
      showToast('Not enough resources!')
      return
    }

    const affinityWith = isSpawner
      ? (spawnEffect as { type: 'spawn'; unitTemplate: { affinity?: { withName: string } }; intervalMs: number }).unitTemplate.affinity?.withName
      : card.unit?.affinity?.withName

    const cell: CityCell = {
      cardName: card.name,
      rarity: card.rarity,
      spawnedUnitName,
      affinityWith,
      stock: {},
    }
    save(placeCard(city, pickerIndex, cell))
    setActiveBrush({ name: card.name, card })
    setScreen('city')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerIndex, city])

  const handlePickCoreBuild = useCallback((building: CoreBuilding) => {
    if (!canAffordCoreBuild(city, building)) { showToast('Not enough gold!'); return }
    save(placeCoreBuild(city, pickerIndex, building))
    setActiveBrush({ name: building.name, coreBuild: building })
    setScreen('city')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerIndex, city])

  // ── Level up ──────────────────────────────────────────────────────────────────

  function handleLevelUp(cardName: string) {
    const col = loadCollection()
    const currentXp = getMasteryXp(col, cardName)
    const currentLvl = masteryLevel(currentXp)

    const next = levelUpCard(city, cardName, currentLvl)
    if (!next) { showToast('Not enough gold!'); return }
    save(next)

    const xpToGrant = masteryXpForLevel(currentLvl + 1) - currentXp
    const updatedCol = col.map(e =>
      e.cardName === cardName
        ? { ...e, masteryXp: (e.masteryXp ?? 0) + xpToGrant }
        : e
    )
    if (!updatedCol.find(e => e.cardName === cardName)) {
      updatedCol.push({ cardName, count: 0, masteryXp: xpToGrant })
    }
    saveCollection(updatedCol)
    showToast(`${cardName} levelled up! Mastery ★${currentLvl + 1}`)
  }

  // ── Fortification handlers ────────────────────────────────────────────────────

  function handleAddFort(card: Card) {
    if (!canQueueFortification(city)) {
      const builderCount = city.builderCount ?? DEFAULT_BUILDER_COUNT
      if (city.builderQueue.length >= builderCount) {
        showToast('All builders are busy! Wait for one to finish.')
      } else {
        showToast(`Fort limit reached (${MAX_TOTAL_FORTS} max).`)
      }
      return
    }
    if (!canAffordFortification(city, card.rarity)) { showToast('Not enough resources!'); return }
    const next = addFortification(city, card.name, card.rarity)
    if (!next) { showToast('Cannot build — check builder slots and resources.'); return }
    const buildMinutes = FORT_BUILD_MINUTES[card.rarity]
    const buildLabel = buildMinutes >= 1440
      ? `${(buildMinutes / 1440).toFixed(1).replace(/\.0$/, '')} days`
      : buildMinutes >= 60
        ? `${(buildMinutes / 60).toFixed(1).replace(/\.0$/, '')} hrs`
        : `${buildMinutes} min`
    save(next)
    showToast(`${card.name} queued — ${buildLabel} build time.`)
  }

  function handleBuyBuilder() {
    const cost = nextBuilderCost(city)
    if (cost === null) { showToast('Maximum builders reached!'); return }
    if (city.gold < cost) { showToast(`Need ${GOLD_SYMBOL} ${cost.toLocaleString()} gold to hire a builder.`); return }
    const next = buyBuilder(city)
    if (!next) return
    save(next)
    showToast(`Builder hired! Now ${next.builderCount} builders.`)
  }

  function handleRemoveFort(index: number) {
    const fort = city.fortifications[index]
    save(removeFortification(city, index))
    showToast(`${fort.cardName} removed.`)
  }

  // ── Expansion ─────────────────────────────────────────────────────────────────

  function handleExpand() {
    if (!canAffordExpansion(city)) {
      const rows = city.rows ?? CITY_ROWS
      const cost = EXPANSION_COSTS[rows]
      if (cost) showToast(`Need ${GOLD_SYMBOL} ${cost.gold.toLocaleString()} gold + resources to expand`)
      return
    }
    const next = expandCity(city)
    if (!next) return
    save(next)
    showToast(`City expanded to ${next.rows} rows!`)
  }

  // ── Derived data ──────────────────────────────────────────────────────────────

  const catalog = getCardCatalog()
  const collection = loadCollection()

  const ownedStructures = catalog.filter(c =>
    c.cardType === 'structure' && getOwnedCount(collection, c.name) > 0
  )

  const placedCounts: Record<string, number> = {}
  for (const cell of city.grid) {
    if (cell) placedCounts[cell.cardName] = (placedCounts[cell.cardName] ?? 0) + 1
  }

  const fortCounts: Record<string, number> = {}
  for (const fort of city.fortifications) {
    fortCounts[fort.cardName] = (fortCounts[fort.cardName] ?? 0) + 1
  }

  // Total deployed = grid + fortifications
  const totalDeployed: Record<string, number> = {}
  for (const name of [...Object.keys(placedCounts), ...Object.keys(fortCounts)]) {
    totalDeployed[name] = (placedCounts[name] ?? 0) + (fortCounts[name] ?? 0)
  }

  const availableForPlace = ownedStructures.filter(c => {
    // Defence cards cannot be placed on the grid — they go to fortifications
    const spawnEffect = c.unit?.structureEffect
    const spawner = spawnEffect?.type === 'spawn'
    if (!spawner && isDefenceCard(c.name, false)) return false
    return (placedCounts[c.name] ?? 0) < getOwnedCount(collection, c.name)
  })

  const availableDefenceCards = ownedStructures.filter(c => {
    const spawnEffect = c.unit?.structureEffect
    const spawner = spawnEffect?.type === 'spawn'
    return isDefenceCard(c.name, spawner) &&
      (totalDeployed[c.name] ?? 0) < getOwnedCount(collection, c.name)
  })

  const levellable = catalog.filter(c =>
    c.cardType === 'structure' && getOwnedCount(collection, c.name) > 0
  )

  const incomeRate = Math.round(goldIncomeRate(city))
  const netRate = Math.round(goldNetRate(city))
  const defense = cityDefense(city)
  const population = cityPopulation(city)

  const cityProdRates = resourceProductionRate(city)
  const consRates = resourceConsumptionRate(city)

  // Merge farm production rates into the city display so the resource strip
  // shows the combined output even when buildings are on the farm.
  const prodRates = { ...cityProdRates }
  if (isFarmUnlocked(population)) {
    for (const [res, rate] of Object.entries(getFarmProductionRate(loadFarmState())) as [ResourceType, number][]) {
      prodRates[res as ResourceType] = (prodRates[res as ResourceType] ?? 0) + rate
    }
  }

  const cityRows = city.rows ?? CITY_ROWS
  const cityCols = city.cols ?? CITY_COLS
  const cityCells = cityCols * cityRows
  const expansionCost = EXPANSION_COSTS[cityRows]
  const affordable = canAffordExpansion(city)
  const cityLevel = cityRows - CITY_ROWS + 1

  const msToAttack = Math.max(0, city.nextAttackAt - currentTime)
  const attackCountdown = formatCountdown(msToAttack)
  const attackUrgency = msToAttack < 3_600_000 ? 'imminent' : msToAttack < 10_800_000 ? 'soon' : 'calm'

  // Estimate incoming attack strength (mirrors processAttack formula)
  const occupiedCount = city.grid.filter(c => c != null).length
  const attackPowerMid = 20 + occupiedCount * 3 + 12  // midpoint of rand(25)
  const attackRatio = defense / Math.max(attackPowerMid, 1)
  const attackStrengthLabel =
    attackRatio >= 1.5 ? { text: 'Weak', cls: 'strength--weak' } :
      attackRatio >= 1.0 ? { text: 'Moderate', cls: 'strength--mod' } :
        attackRatio >= 0.6 ? { text: 'Strong', cls: 'strength--strong' } :
          { text: 'Overwhelming', cls: 'strength--overwhelm' }

  // ── Farming sub-screen ───────────────────────────────────────────────────────

  if (screen === 'farming') {
    return (
      <FarmingSim
        city={city}
        onSaveCity={next => { setCity(next); saveCityState(next) }}
        onBack={() => setScreen('city')}
      />
    )
  }

  // ── Fortify sub-screen ────────────────────────────────────────────────────────

  if (screen === 'fortify') {
    return (
      <Fortifications
        city={city}
        currentTime={currentTime}
        builderWalkers={builderWalkers}
        fortRingRef={fortRingRef}
        fortSlotSel={fortSlotSel}
        setFortSlotSel={setFortSlotSel}
        availableDefenceCards={availableDefenceCards}
        onBack={() => { setFortSlotSel(null); setScreen('city') }}
        onAddFort={handleAddFort}
        onBuyBuilder={handleBuyBuilder}
        onRemoveFort={handleRemoveFort}
      />
    )
  }

  // ── Tower Defence sub-screen ──────────────────────────────────────────────────

  if (screen === 'towerdefence') {
    const pool = buildCityTowerPool(city)
    function handleTDDone(gold: number) {
      if (gold > 0) {
        setCity(prev => ({ ...prev, gold: prev.gold + gold }))
        saveCityState({ ...city, gold: city.gold + gold })
        setToast(`Your defenders earned ${gold.toLocaleString()} 🪙 gold!`)
        setTimeout(() => setToast(null), 4000)
      }
      setScreen('city')
    }
    if (pool.length === 0) {
      return (
        <div className="city-screen u-relative u-col u-gap-2">
          <div className="city-header u-flex u-items-c u-gap-3">
            <button className="action-btn" onClick={() => setScreen('city')}>← BACK</button>
            <div className="city-title">⚔ DEFEND</div>
          </div>
          <div style={{ padding: 24, color: '#888', textAlign: 'center' }}>
            <p>No residents available to defend the city.</p>
            <p>Place some spawn buildings with happy residents first!</p>
            <button className="action-btn" onClick={() => setScreen('city')}>BACK TO CITY</button>
          </div>
        </div>
      )
    }
    return (
      <TowerDefence
        pool={pool}
        mode="city"
        onDone={handleTDDone}
      />
    )
  }

  // ── Card picker sub-screen ────────────────────────────────────────────────────

  if (screen === 'picker') {
    return (
      <CardPicker
        availableForPlace={availableForPlace}
        city={city}
        collection={collection}
        pickerSearch={pickerSearch}
        setPickerSearch={setPickerSearch}
        onBack={() => setScreen('city')}
        onPickCard={handlePickCard}
        onPickCoreBuild={handlePickCoreBuild}
      />
    )
  }

  // ── Upgrade sub-screen ────────────────────────────────────────────────────────

  if (screen === 'upgrade') {
    return (
      <BuildingUpgradeList
        levellable={levellable}
        city={city}
        collection={collection}
        upgradeSearch={upgradeSearch}
        setUpgradeSearch={setUpgradeSearch}
        onBack={() => setScreen('city')}
        onSelectCard={name => { setLevelCard(name); setScreen('levelup') }}
      />
    )
  }

  // ── Level-up detail sub-screen ────────────────────────────────────────────────

  if (screen === 'levelup' && levelCard !== null) {
    return (
      <LevelUpDetail
        levelCard={levelCard}
        card={catalog.find(c => c.name === levelCard)}
        city={city}
        onBack={() => setScreen('upgrade')}
        onLevelUp={handleLevelUp}
      />
    )
  }

  // ── Chronicle sub-screen ─────────────────────────────────────────────────────

  if (screen === 'chronicle') {
    return (
      <ChroniclePanel
        chronicle={city.chronicle ?? []}
        onBack={() => setScreen('city')}
      />
    )
  }

  if (screen === 'stats') {
    return (
      <StatsScreen
        city={city}
        onBack={() => setScreen('city')}
      />
    )
  }

  if (screen === 'zones') {
    return (
      <ZoneEditor
        city={city}
        onSave={next => save(next)}
        onBack={() => setScreen('city')}
      />
    )
  }

  const cityToolbar = (
    <Toolbar>
      <ToolbarButton active={bulldozerMode} onClick={toggleBulldozer}
        title={bulldozerMode ? 'Demolish mode ON' : 'Demolish a building'}>
        {bulldozerMode ? '🧱 DEMOLISH' : '👷 BUILD'}
      </ToolbarButton>
      <ToolbarButton onClick={() => setScreen('fortify')} title="Manage city walls">🛡 FORTS</ToolbarButton>
      {isFarmUnlocked(population) ? (
        <ToolbarButton className="action-btn--gold" style={{ fontSize: 11 }} onClick={() => setScreen('farming')}
          title="Manage arable land outside the city">🌾 FARM</ToolbarButton>
      ) : (
        <ToolbarButton style={{ opacity: 0.7 }}
          title={`Farm unlocks at population 10 (currently ${population})`}
          onClick={() => setShowFarmLockModal(true)}>🌾 FARM 🔒</ToolbarButton>
      )}
      <ToolbarButton onClick={() => setScreen('towerdefence')} title="Defend the city using your residents as towers">⚔ DEFEND</ToolbarButton>
      {city.activeDisaster && (
        <ToolbarButton className="city-disaster-btn" onClick={() => setShowDisaster(true)}
          title={city.activeDisaster.type === 'fire' ? 'Fire is raging!' : 'Plague is spreading!'}>
          {city.activeDisaster.type === 'fire' ? '🔥' : '☠'} DISASTER!
        </ToolbarButton>
      )}      
      <ToolbarDropdown>
      <ToolbarButton onClick={() => setScreen('upgrade')} title="Upgrade buildings">★ UPGRADES</ToolbarButton>
      <ToolbarButton onClick={() => setScreen('chronicle')} title="View city history">📜 HISTORY</ToolbarButton>
      <ToolbarButton onClick={() => setScreen('stats')} title="View economy charts">📊 STATS</ToolbarButton>
      <ToolbarButton onClick={() => setScreen('zones')} title="Set district zones per row">🗺 ZONES</ToolbarButton>

      <ToolbarButton
        className={city.tradeOffer && !city.activeCaravan ? 'city-trade-btn--ready' : undefined}
        onClick={() => setShowTrade(true)} title="Trade resources via caravan">
        🐪 TRADE{city.activeCaravan ? ' (away)' : city.tradeOffer ? ' !' : ''}
      </ToolbarButton>
      {cityRows <= MAX_CITY_ROWS && (
        <ToolbarButton
          className={`city-expand-btn${affordable ? ' city-expand-btn--ready' : ''}`}
          onClick={() => setShowExpandModal(true)} title="View city expansion levels and costs">
          🏢 EXPAND
        </ToolbarButton>
      )}
      </ToolbarDropdown>
    </Toolbar>
  )


  // ── Main city view ────────────────────────────────────────────────────────────

  return (
    <OverlayScreen title={bulldozerMode ? '⏸ PAUSED' : '🏙 CITY'} onBack={onBack}

      right={<>
              <div className="city-level-badge" title={`City level ${cityLevel} — ${city.rows}×${city.cols} grid`}>LVL {cityLevel}</div>
</>}
    >

      <div className="city-screen u-relative u-col u-gap-2">
        {toast && <div className="city-toast" role="alert">{toast}</div>}

        {pendingMilestone && (
          <MilestoneBanner
            milestone={pendingMilestone}
            onDone={() => setPendingMilestone(null)}
          />
        )}

        {showTrade && (
          <TradeRouteModal
            city={city}
            currentTime={currentTime}
            onDispatch={() => {
              const next = dispatchCaravan(city)
              if (next) save(next)
              else showToast('Cannot dispatch caravan right now.')
            }}
            onClose={() => setShowTrade(false)}
          />
        )}

        {showDisaster && city.activeDisaster && (
          <DisasterModal
            city={city}
            disaster={city.activeDisaster}
            onExtinguish={() => { save(extinguishFire(city)); setShowDisaster(false) }}
            onCure={() => { save(curePlague(city)); setShowDisaster(false) }}
            onClose={() => setShowDisaster(false)}
          />
        )}

        {attackReport && (
          <AttackReportModal
            attackReport={attackReport}
            hasDamagedForts={city.fortifications.some(f => f.hp < f.maxHp)}
            onClose={() => setAttackReport(null)}
          />
        )}

        {showFarmLockModal && (
          <ModalBackdrop onClose={() => setShowFarmLockModal(false)}>
            <div className="city-info-modal">
              <div className="city-info-modal-title">🌾 FARM — LOCKED</div>
              <div className="city-info-modal-body">
                <p>Move production buildings to fertile land outside the city walls for a <strong>+50% resource bonus</strong>.</p>
                <p style={{ color: '#cc9944' }}>⚠ Farms are raided every 3–4 hours with minimal defence.</p>
                <div className="city-info-modal-req">
                  <span className={population >= 10 ? 'req--met' : 'req--unmet'}>
                    {population >= 10 ? '✓' : '✗'} Population ≥ 10 (currently {population})
                  </span>
                </div>
                <p style={{ fontSize: 11, color: '#668866' }}>Grow your city by placing more spawning buildings to unlock the farm.</p>
              </div>
              <button className="action-btn" onClick={() => setShowFarmLockModal(false)}>CLOSE</button>
            </div>
          </ModalBackdrop>
        )}

        {showExpandModal && (
          <ModalBackdrop onClose={() => setShowExpandModal(false)}>
            <div className="city-info-modal">
              <div className="city-info-modal-title">🏢 CITY EXPANSION</div>
              <div className="city-info-modal-body">
                {([4, 5, 6, 7, 8] as const).map(rows => {
                  const lvl = rows - CITY_ROWS + 1
                  const cost = EXPANSION_COSTS[rows as 4|5|6|7]
                  const isCurrent = cityRows === rows
                  const isCompleted = cityRows > rows
                  const isNext = cityRows === rows
                  return (
                    <div key={rows} className={`city-expand-row${isCurrent ? ' city-expand-row--current' : ''}${isCompleted ? ' city-expand-row--done' : ''}`}>
                      <span className="city-expand-lvl">LVL {lvl} — {rows}×{rows}</span>
                      {isCompleted && <span className="city-expand-status">✓ Unlocked</span>}
                      {isCurrent && rows < MAX_CITY_ROWS && cost && (
                        <span className="city-expand-cost">
                          {GOLD_SYMBOL} {cost.gold.toLocaleString()}
                          {Object.entries(cost.resources).map(([r, v]) => ` · ${v?.toLocaleString()} ${r}`).join('')}
                        </span>
                      )}
                      {isCurrent && rows >= MAX_CITY_ROWS && <span className="city-expand-status">MAX SIZE</span>}
                    </div>
                  )
                })}
              </div>
              <div className="u-flex u-gap-3 u-just-c">
                {cityRows < MAX_CITY_ROWS && expansionCost && (
                  <button
                    className={`action-btn${affordable ? ' action-btn--gold' : ''}`}
                    onClick={() => { handleExpand(); setShowExpandModal(false) }}
                    disabled={!affordable}
                    title={affordable ? 'Expand the city now' : 'Not enough resources'}
                  >
                    {affordable ? '🏢 EXPAND NOW' : '🔒 NEED RESOURCES'}
                  </button>
                )}
                <button className="action-btn" onClick={() => setShowExpandModal(false)}>CLOSE</button>
              </div>
            </div>
          </ModalBackdrop>
        )}

        {selectedWalker !== null && (() => {
          const cell = city.grid[selectedWalker.cellIndex]
          if (!cell?.spawnedUnitName) return null
          return (
            <ResidentInfoModal
              cellIndex={selectedWalker.cellIndex}
              unitIndex={selectedWalker.unitIndex}
              cell={cell}
              city={city}
              walkers={walkers}
              onClose={() => setSelectedWalker(null)}
            />
          )
        })()}

        {selectedBuildingCell !== null && (() => {
          const cell = city.grid[selectedBuildingCell]
          if (!cell) return null
          return (
            <BuildingInspectModal
              cellIndex={selectedBuildingCell}
              cell={cell}
              city={city}
              collection={collection}
              walkers={walkers}
              buildingTab={buildingTab}
              setBuildingTab={setBuildingTab}
              onClose={() => setSelectedBuildingCell(null)}
              onLevelUp={cardName => { handleLevelUp(cardName); setBuildingTab('upgrade') }}
              onMoveIn={() => { save(reoccupyBuilding(city, selectedBuildingCell!)); showToast('Residents invited back!') }}
            />
          )
        })()}


        <AttackStrip
          msToAttack={msToAttack}
          occupiedCount={occupiedCount}
          defense={defense}
        />

        <ResourceStrip
          defense={defense}
          population={population}
          resources={city.resources}
          prodRates={prodRates}
          consRates={consRates}
          season={currentSeason()}
          city={city}
        />

        {activeBrush && (
          <div className="city-brush-bar">
            <span className="city-brush-label">Placing: {activeBrush.name}</span>
            <button className="city-brush-cancel" onClick={() => setActiveBrush(null)} title="Stop placing">✕</button>
          </div>
        )}



        <CityGrid
          toolbar={cityToolbar}
          city={city}
          walkers={walkers}
          builderWalkers={builderWalkers}
          visualCarriers={visualCarriers}
          bulldozerMode={bulldozerMode}
          worldRef={worldRef}
          paintBrush={!!activeBrush}
          onCellTap={handleCellTap}
          onPaint={handlePaint}
          onWalkerClick={(cellIndex, unitIndex) => setSelectedWalker({ cellIndex, unitIndex })}
        />

        <CityPerimeter
          fortifications={city.fortifications}
          builderQueue={city.builderQueue}
          onClick={() => setScreen('fortify')}
        />

        {/* Scrollable bottom: resident thoughts */}
        <div className="city-bottom-scroll">
          {residentThoughts.length > 0 && (
            <div className="city-thoughts">
              <div className="city-thoughts-title">RESIDENT THOUGHTS</div>
              {residentThoughts.map((t, idx) => (
                <div key={idx} className={`city-thought-row u-flex u-items-c u-gap-3${t.happy ? ' city-thought-row--happy' : ' city-thought-row--unhappy'}`}>
                  <AnimatedSpriteImg name={t.unitName} frameCount={3} fps={6} className="city-thought-sprite" />
                  <span className="city-thought-name">{t.name}:</span>
                  <span className="city-thought-text">"{t.thought}"</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </OverlayScreen>
  )
}
