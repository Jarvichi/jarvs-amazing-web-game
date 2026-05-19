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
  cityDefense, cityPopulation,
  canAffordPlacement,
  resourceProductionRate, resourceConsumptionRate,
  levelUpCost, levelUpCard,
  getBuildingProduces, isDefenceCard,
  spawnerUnitCount,
  getNeighbourIndices,
  nextBuilderCost, buyBuilder,
  checkMilestones, MilestoneDef,
  currentSeason,
  dispatchCaravan,
  extinguishFire, curePlague,
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
  const foodScore = Math.min(100, (city.resources.wheat / pop) * 5)
  const defenseScore = Math.min(100, (cityDefense(city) / pop) * 8)
  const gridRows = city.rows ?? CITY_ROWS

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
      const neighbourMet = getNeighbourIndices(i, gridRows).some(ni => {
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
    const resourceCells = city.grid
      .map((cell, i) => ({ cell, i }))
      .filter(({ cell }) => cell && !cell.spawnedUnitName && Object.values(getBuildingProduces(cell.cardName)).some(v => (v ?? 0) > 0))
    if (resourceCells.length > 0) {
      const { i } = resourceCells[Math.floor(Math.random() * resourceCells.length)]
      const gCol = i % CITY_COLS
      const gRow = Math.floor(i / CITY_COLS)
      return {
        targetX: ringW * (0.25 + (gCol + 0.3 + Math.random() * 0.4) / CITY_COLS * 0.5),
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
    // Delivered — now go fetch more materials from a resource building or random cell
    const resourceCells = city.grid
      .map((cell, i) => ({ cell, i }))
      .filter(({ cell }) => cell && !cell.spawnedUnitName && Object.values(getBuildingProduces(cell.cardName)).some(v => (v ?? 0) > 0))
    const cityRows = city.rows ?? CITY_ROWS
    if (resourceCells.length > 0) {
      const { i } = resourceCells[Math.floor(Math.random() * resourceCells.length)]
      const col = i % CITY_COLS
      const row = Math.floor(i / CITY_COLS)
      return {
        targetX: (col + 0.3 + Math.random() * 0.4) * (overlayW / CITY_COLS),
        targetY: (row + 0.3 + Math.random() * 0.4) * (overlayH / cityRows),
        nextPhase: 'delivering',
        label: '🪵 Fetching materials',
      }
    }
    // No resource buildings — wander around center of city
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
function computeWaypoints(
  fromX: number, fromY: number,
  toX: number, toY: number,
  overlayW: number, overlayH: number,
  cityRows: number,
): { x: number; y: number }[] {
  const cellW = overlayW / CITY_COLS
  const cellH = overlayH / cityRows
  const fc = Math.max(0, Math.min(CITY_COLS - 1, Math.floor(fromX / cellW)))
  const fr = Math.max(0, Math.min(cityRows - 1, Math.floor(fromY / cellH)))
  const tc = Math.max(0, Math.min(CITY_COLS - 1, Math.floor(toX / cellW)))
  const tr = Math.max(0, Math.min(cityRows - 1, Math.floor(toY / cellH)))
  if (fr === tr) return []  // same row: direct horizontal movement is fine
  const borderY  = fr < tr ? (fr + 1) * cellH : fr * cellH
  // Column border to use: the gap on the side of source/dest facing each other
  // (or right gap for same-column). Vertical legs run along these gaps, not column centres.
  const bxExit  = fc < tc ? (fc + 1) * cellW : fc < CITY_COLS - 1 ? (fc + 1) * cellW : fc * cellW
  const bxEnter = fc < tc ? tc * cellW        : fc > 0             ? tc * cellW        : (tc + 1) * cellW
  return [
    { x: bxExit,  y: (fr + 0.5) * cellH },  // exit source col to column-border gap
    { x: bxExit,  y: borderY },              // travel down/up to row-border gap
    { x: bxEnter, y: borderY },              // travel along row gap to dest column gap
    { x: bxEnter, y: (tr + 0.5) * cellH },  // travel along dest column gap
  ]
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

  function cellPos(idx: number) {
    return {
      x: ((idx % CITY_COLS) + 0.5) * (overlayW / CITY_COLS),
      y: (Math.floor(idx / CITY_COLS) + 0.5) * (overlayH / cityRows),
    }
  }

  const home = cellPos(w.cellIndex)

  // Perimeter cells (shared by patrol and panic tasks)
  const perimCells: { col: number; row: number }[] = []
  for (let col = 0; col < CITY_COLS; col++) {
    perimCells.push({ col, row: 0 }, { col, row: cityRows - 1 })
  }
  for (let row = 1; row < cityRows - 1; row++) {
    perimCells.push({ col: 0, row }, { col: CITY_COLS - 1, row })
  }

  // ── Attack imminent: residents panic ─────────────────────────────────────────
  const msToAttack = city.nextAttackAt - Date.now()
  if (msToAttack > 0 && msToAttack <= ATTACK_WARN_MS) {
    const perim = perimCells[Math.floor(Math.random() * perimCells.length)]
    const defendTarget = {
      targetX: (perim.col + 0.5) * (overlayW / CITY_COLS),
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
    targetX: (perim.col + 0.5) * (overlayW / CITY_COLS),
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

  // Visiting — walk to another resident (and follow them)
  const others = allWalkers.filter(
    other => !(other.cellIndex === w.cellIndex && other.unitIndex === w.unitIndex) && !other.hidden,
  )
  if (others.length > 0) {
    const target = others[Math.floor(Math.random() * others.length)]
    const name = residentName(target.unitName, target.cellIndex, target.unitIndex)
    available.push({
      type: 'visiting',
      label: `👋 Visiting ${name.split(' ')[0]}`,
      targetX: target.x,
      targetY: target.y,
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

type SubScreen = 'city' | 'picker' | 'upgrade' | 'levelup' | 'fortify' | 'towerdefence' | 'chronicle' | 'stats' | 'zones'

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
  const [fortFilter, setFortFilter] = useState<string>('all')
  const [fortSort, setFortSort] = useState<'defense' | 'name' | 'rarity'>('defense')
  const worldRef = useRef<HTMLDivElement>(null)
  const worldDimsRef = useRef({ w: CITY_COLS * CELL_PX, h: CITY_ROWS * CELL_PX })
  const fortRingRef = useRef<HTMLDivElement>(null)
  const fortRingDimsRef = useRef({ w: CITY_COLS * CELL_PX, h: CITY_ROWS * CELL_PX })
  const cityRef = useRef(city)
  const walkersRef = useRef(walkers)
  const builderWalkersRef = useRef(builderWalkers)

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
        function wayptsFor(task: WalkerTask, fx: number, fy: number) {
          if (task.type === 'idle' || task.type === 'visiting' || task.type === 'chatting' || task.targetX === undefined) return []
          return computeWaypoints(fx, fy, task.targetX, task.targetY!, overlayW, overlayH, cityRows)
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

          // ── Update visiting target to follow the other walker ──────────────
          if (task.type === 'visiting' && task.targetWalkerKey) {
            const [ci, ui] = task.targetWalkerKey.split('-').map(Number)
            const target = prev.find(o => o.cellIndex === ci && o.unitIndex === ui && !o.hidden)
            if (target) {
              task = { ...task, targetX: target.x, targetY: target.y }
            } else {
              task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
              taskTimer = task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0
              if (task.type !== 'idle') bubbleTimer = BUBBLE_TICKS
              waypoints = wayptsFor(task, x, y)
            }
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
          }

          // ── Directed movement (waypoint-following) ─────────────────────────
          if (task.type !== 'idle' && task.type !== 'chatting' && task.targetX !== undefined && task.targetY !== undefined) {
            // Visiting walkers move directly toward their (moving) target
            const useWaypoints = task.type !== 'visiting'
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
                if (nd > 1) { vx = (ndx / nd) * SPEED; vy = (ndy / nd) * SPEED }
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
              vx = (dx / dist) * SPEED
              vy = (dy / dist) * SPEED
            }
          }

          // ── Apply movement ─────────────────────────────────────────────────
          x += vx
          y += vy
          if (x < 0) { x = 0; vx = Math.abs(vx) }
          if (x > overlayW - UNIT_SIZE) { x = overlayW - UNIT_SIZE; vx = -Math.abs(vx) }
          if (y < 0) { y = 0; vy = Math.abs(vy) }
          if (y > overlayH - UNIT_SIZE) { y = overlayH - UNIT_SIZE; vy = -Math.abs(vy) }

          // Random direction changes for idle wandering only
          if (task.type === 'idle') {
            turnTimer--
            if (turnTimer <= 0) {
              const angle = Math.random() * Math.PI * 2
              vx = Math.cos(angle) * SPEED
              vy = Math.sin(angle) * SPEED
              turnTimer = 20 + Math.floor(Math.random() * 30)
            }
          }

          return { ...w, x, y, vx, vy, turnTimer, task, taskTimer, bubbleTimer, waypoints }
        })
      })

      // Animate builder walkers
      setBuilderWalkers(prev => prev.map(b => {
        let { x, y, vx, vy, phase, targetX, targetY, label,
          ringX, ringY, ringVx, ringVy, ringPhase, ringTargetX, ringTargetY } = b
        const { w: rw, h: rh } = fortRingDimsRef.current

        // ── City-world movement ─────────────────────────────────────────────
        const dx = targetX - x, dy = targetY - y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 18) {
          const next = pickBuilderTarget(phase, cityRef.current, overlayW, overlayH)
          phase = next.nextPhase; targetX = next.targetX; targetY = next.targetY; label = next.label
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
          ...b, x, y, vx, vy, phase, targetX, targetY, label,
          ringX, ringY, ringVx, ringVy, ringPhase, ringTargetX, ringTargetY
        }
      }))

      // ── Animate resource carriers ─────────────────────────────────────────────
      const gameCarriers = cityRef.current?.carriers ?? []
      const gameCarrierIds = new Set(gameCarriers.map(c => c.id))
      const cityRows = cityRef.current?.rows ?? CITY_ROWS

      // Sync: keep carriers still in game state OR still finishing their shrink-out animation
      let nextVis = visualCarriersRef.current.filter(vc => gameCarrierIds.has(vc.id) || vc.scale > 0)

      // Spawn new carriers — goblin starts at toCell (consumer) and walks outbound to fromCell (producer)
      const visIds = new Set(nextVis.map(vc => vc.id))
      for (const gc of gameCarriers) {
        if (visIds.has(gc.id)) continue
        const c1 = gc.fromCell % CITY_COLS, r1 = Math.floor(gc.fromCell / CITY_COLS)
        const pickX = (c1 + 0.5) * overlayW / CITY_COLS
        const pickY = (r1 + 0.5) * overlayH / cityRows
        const c2 = gc.toCell % CITY_COLS, r2 = Math.floor(gc.toCell / CITY_COLS)
        const dropX = (c2 + 0.5) * overlayW / CITY_COLS
        const dropY = (r2 + 0.5) * overlayH / cityRows
        // Outbound: start at drop-off (consumer), walk to pick-up (producer)
        const wps = computeWaypoints(dropX, dropY, pickX, pickY, overlayW, overlayH, cityRows)
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
          const wps = computeWaypoints(x, y, vc.dropX, vc.dropY, overlayW, overlayH, cityRows)
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
        const next = tickCity(prev)
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

  function handleCellTap(index: number) {
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

  function toggleBulldozer() {
    setBulldozerMode(prev => !prev)
    setSelectedBuildingCell(null)
    setSelectedWalker(null)
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
    setScreen('city')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerIndex, city])

  const handlePickCoreBuild = useCallback((building: CoreBuilding) => {
    if (!canAffordCoreBuild(city, building)) { showToast('Not enough gold!'); return }
    save(placeCoreBuild(city, pickerIndex, building))
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
    if (city.gold < cost) { showToast(`Need ⚙ ${cost.toLocaleString()} gold to hire a builder.`); return }
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
      if (cost) showToast(`Need ⚙${cost.gold.toLocaleString()} gold + resources to expand`)
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

  const prodRates = resourceProductionRate(city)
  const consRates = resourceConsumptionRate(city)

  const cityRows = city.rows ?? CITY_ROWS
  const cityCells = CITY_COLS * cityRows
  const expansionCost = EXPANSION_COSTS[cityRows]
  const affordable = canAffordExpansion(city)

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
        fortFilter={fortFilter}
        setFortFilter={setFortFilter}
        fortSort={fortSort}
        setFortSort={setFortSort}
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

  // ── Main city view ────────────────────────────────────────────────────────────

  return (
    <OverlayScreen title={bulldozerMode ? '⏸ PAUSED' : '🏙 CITY'} onBack={onBack}

      right={<> <div className="city-gold-display">⚙ {city.gold.toLocaleString()} (+{incomeRate}/min)</div>
        <button className="action-btn" onClick={() => setScreen('towerdefence')} title="Defend the city using your residents as towers">
          ⚔ DEFEND
        </button></>}
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
          attackCountdown={attackCountdown}
          attackUrgency={attackUrgency}
          attackStrengthLabel={attackStrengthLabel}
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

        <CityGrid
          city={city}
          walkers={walkers}
          builderWalkers={builderWalkers}
          visualCarriers={visualCarriers}
          bulldozerMode={bulldozerMode}
          worldRef={worldRef}
          onCellTap={handleCellTap}
          onWalkerClick={(cellIndex, unitIndex) => setSelectedWalker({ cellIndex, unitIndex })}
        />

        <CityPerimeter
          fortifications={city.fortifications}
          builderQueue={city.builderQueue}
          onClick={() => setScreen('fortify')}
        />

        <div className="city-header u-flex u-items-c u-just-c u-gap-3">
          <button
            className={`filter-btn${bulldozerMode ? ' city-bulldozer-btn--active' : ''}`}
            onClick={toggleBulldozer}
            title={bulldozerMode ? 'Demolish mode ON' : 'Demolish a building'}
          >{bulldozerMode ? '🧱 DEMOLISH' : '👷 BUILD'}</button>
          <button className="filter-btn" onClick={() => setScreen('fortify')} title="Manage city walls and moats">🛡 FORTS</button>
          <button className="filter-btn" onClick={() => setScreen('upgrade')} title="Upgrade buildings">★ UPGRADES</button>
          <button className="filter-btn" onClick={() => setScreen('chronicle')} title="View city history">📜 HISTORY</button>
          <button className="filter-btn" onClick={() => setScreen('stats')} title="View economy charts">📊 STATS</button>
          <button className="filter-btn" onClick={() => setScreen('zones')} title="Set district zones per row">🗺 ZONES</button>
          {city.activeDisaster && (
            <button
              className="filter-btn city-disaster-btn"
              onClick={() => setShowDisaster(true)}
              title={city.activeDisaster.type === 'fire' ? 'Fire is raging!' : 'Plague is spreading!'}
            >
              {city.activeDisaster.type === 'fire' ? '🔥' : '☠'} DISASTER!
            </button>
          )}
          <button
            className={`filter-btn${city.tradeOffer && !city.activeCaravan ? ' city-trade-btn--ready' : ''}`}
            onClick={() => setShowTrade(true)}
            title="Trade resources via caravan"
          >🐪 TRADE{city.activeCaravan ? ' (away)' : city.tradeOffer ? ' !' : ''}</button>
          {cityRows < MAX_CITY_ROWS && expansionCost && (
            <button
              className={`filter-btn city-expand-btn${affordable ? ' city-expand-btn--ready' : ''}`}
              onClick={handleExpand}
              title={affordable ? `Expand city to ${cityRows + 1} rows` : 'Not enough resources to expand'}
            >🏢 EXPAND</button>
          )}
        </div>

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
