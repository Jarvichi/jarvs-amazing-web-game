// ─── City Builder ─────────────────────────────────────────────────────────────
// Idle city: place owned structure cards on a grid. Spawn buildings show their
// unit walking around the city. Resources are produced and consumed over time.
// Happiness is driven by food and defence.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getCardCatalog } from '../../game/cards'
import {
  loadCollection, saveCollection, getOwnedCount,
  getMasteryXp, masteryLevel, masteryXpForLevel, masteryProgress,
} from '../../game/collection'
import {
  CITY_COLS, CITY_ROWS, CITY_CELLS, CELL_PX, MAX_CITY_ROWS,
  CityCell, CityState, ResourceType, ResourceStock, AttackEvent,
  RESOURCE_ICONS, SPAWNER_PLACE_COST,
  FORT_MAX_HP, FORT_DEFENSE, FORT_PLACE_COST, EXPANSION_COSTS, MAX_TOTAL_FORTS,
  canAffordFortification,
  loadCityState, saveCityState, tickCity,
  placeCard, removeCard,
  addFortification, removeFortification,
  expandCity, canAffordExpansion,
  goldIncomeRate, goldNetRate,
  cityDefense, cityPopulation,
  canAffordPlacement,
  resourceProductionRate, resourceConsumptionRate,
  levelUpCost, levelUpCard, LEVEL_UP_COSTS,
  getBuildingProduces, isDefenceCard,
  INCOME_SPAWN, INCOME_UTILITY, INCOME_WALL,
  spawnerUnitCount, masteryOutputMultiplier,
  getNeighbourIndices,
} from '../../game/cityBuilder'
import { MasteryBar } from '../MasteryBar'
import { SpriteImg, AnimatedSpriteImg } from '../SpriteImg'
import { Card } from '../../game/types'

// ── Unit requirement helpers ──────────────────────────────────────────────────

function rageDescription(happiness: number): string {
  if (happiness === 0)   return 'Left the city'
  if (happiness < 30)    return 'Furious — leaving soon!'
  if (happiness < 60)    return 'Unsettled'
  if (happiness < 90)    return 'A little uneasy'
  return 'Content'
}

function getUnitRequirements(
  cell: CityCell,
  cityState: CityState,
  cellIndex: number,
): { text: string; met: boolean }[] {
  const reqs: { text: string; met: boolean }[] = []
  const gridRows = cityState.rows ?? CITY_ROWS

  const wantedNeighbour = cell.affinityWith ?? cell.spawnedUnitName
  if (wantedNeighbour) {
    const neighbourMet = getNeighbourIndices(cellIndex, gridRows).some(ni => {
      const nc = cityState.grid[ni]
      return nc?.spawnedUnitName === wantedNeighbour && (cityState.happiness[ni] ?? 100) > 0
    })
    reqs.push({
      text: cell.affinityWith
        ? `Wants a ${wantedNeighbour} next door`
        : `Wants another ${wantedNeighbour} next door`,
      met: neighbourMet,
    })
  }

  const pop = Math.max(cityPopulation(cityState), 1)
  const foodScore = Math.min(100, (cityState.resources.wheat / pop) * 5)
  reqs.push({ text: 'Needs adequate food supply', met: foodScore >= 50 })

  const defense = cityDefense(cityState)
  const defenseScore = Math.min(100, (defense / pop) * 8)
  if (defense > 0 || defenseScore < 30) {
    reqs.push({ text: 'Needs city defenses', met: defenseScore >= 50 })
  }

  return reqs
}

// ── Resident name generator ───────────────────────────────────────────────────

const RESIDENT_FIRST_NAMES = [
  'Bob', 'Grak', 'Mira', 'Thorin', 'Zyx', 'Elda', 'Fang', 'Nix', 'Wren', 'Dusk',
  'Pip', 'Crux', 'Vale', 'Sorn', 'Brix', 'Holt', 'Vera', 'Kurn', 'Dex', 'Ori',
  'Sable', 'Flint', 'Rook', 'Ivy', 'Bryn', 'Quill', 'Ash', 'Moss', 'Thorn', 'Lark',
  'Grit', 'Nyx', 'Rune', 'Cora', 'Drake', 'Frey', 'Vex', 'Sage', 'Onyx', 'Luna',
  'Zara', 'Kade', 'Ember', 'Riven', 'Sylas', 'Jade', 'Dorian', 'Nyssa', 'Orin', 'Soren',
  'Tess', 'Galen', 'Vira', 'Kira', 'Bram', 'Lena', 'Zane', 'Mara', 'Rhea', 'Dax',
  'Cyrus', 'Elara', 'Fen', 'Nora', 'Vaughn', 'Sia', 'Kieran', 'Lyra', 'Rook', 'Eira',
]

function residentName(unitName: string, cellIndex: number, unitIndex: number): string {
  const seed = cellIndex * 17 + unitIndex * 31
  return `${RESIDENT_FIRST_NAMES[seed % RESIDENT_FIRST_NAMES.length]} the ${unitName}`
}

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

interface ResidentThought {
  name: string
  unitName: string
  thought: string
  happy: boolean
}

function buildResidentThoughts(
  city: CityState,
  population: number,
  walkers: Walker[] = [],
): ResidentThought[] {
  const thoughts: ResidentThought[] = []
  const pop = Math.max(population, 1)
  const foodScore    = Math.min(100, (city.resources.wheat / pop) * 5)
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

// ── Walking unit state ────────────────────────────────────────────────────────

const UNIT_SIZE       = 20
const SPEED           = 0.8
const ARRIVE_DIST     = 14   // pixels — close enough to count as "arrived"
const IDLE_TASK_TICKS = 80   // ~8 s of random wandering before picking a new task
const REST_TICKS_MIN  = 4 * IDLE_TASK_TICKS   // ~32 s — at least 4 task cycles at home
const REST_TICKS_MAX  = 7 * IDLE_TASK_TICKS   // ~56 s
const BUBBLE_TICKS    = 30   // 3 s — how long a task bubble stays visible
const ATTACK_WARN_MS  = 30 * 60 * 1000  // show panic tasks when attack < 30 min away
const PATROL_DEFENSE_PER_WALKER = 5     // defense units added per patrolling resident
const TASK_RESOURCE_GOLD: Partial<Record<ResourceType, number>> = {
  wheat: 2, wood: 2, ore: 3, bread: 4, planks: 4, metal: 5,
}

type TaskType = 'idle' | 'resting' | 'eating' | 'patrolling' | 'gathering' | 'visiting' | 'playing'

interface WalkerTask {
  type:             TaskType
  label:            string
  targetX?:         number
  targetY?:         number
  targetWalkerKey?: string   // `${cellIndex}-${unitIndex}` for visiting
  resource?:        ResourceType  // resource consumed/earned by this task
}

interface Walker {
  cellIndex:    number
  unitIndex:    number
  unitName:     string
  affinityWith?: string
  x:            number
  y:            number
  vx:           number
  vy:           number
  turnTimer:    number
  task:         WalkerTask
  taskTimer:    number   // ticks remaining for idle phase; 0 = pick new task on next tick
  bubbleTimer:  number   // ticks remaining to show speech bubble (BUBBLE_TICKS → 0)
  hidden:       boolean  // true while resting at home
  hiddenTimer:  number   // ticks remaining before waking from rest
}

function makeWalker(cellIndex: number, unitIndex: number, unitName: string, affinityWith?: string, w = CITY_COLS * CELL_PX, h = CITY_ROWS * CELL_PX): Walker {
  const angle = Math.random() * Math.PI * 2
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
    task:        { type: 'idle', label: '🚶 Taking a stroll' },
    taskTimer:   Math.floor(Math.random() * IDLE_TASK_TICKS),
    bubbleTimer: 0,
    hidden:      false,
    hiddenTimer: 0,
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
      { type: 'resting',    label: '🏠 Taking shelter!',      targetX: home.x, targetY: home.y },
      { type: 'resting',    label: '🏠 Hiding at home!',       targetX: home.x, targetY: home.y },
      { type: 'patrolling', label: '⚔ Preparing to defend!',  ...defendTarget },
      { type: 'patrolling', label: '🛡 Defending the walls!',  ...defendTarget },
    ]
    return panicTasks[Math.floor(Math.random() * panicTasks.length)]
  }

  // ── Normal task selection ─────────────────────────────────────────────────────
  const available: WalkerTask[] = []

  // Idle — always available
  available.push({ type: 'idle', label: '🚶 Taking a stroll' })

  // Resting — return to home building
  available.push({ type: 'resting', label: '💤 Heading home', targetX: home.x, targetY: home.y })

  // Eating — walk to a wheat-producing building
  const farms = city.grid
    .map((cell, i) => ({ cell, i }))
    .filter(({ cell }) => cell && !cell.spawnedUnitName && (getBuildingProduces(cell.cardName).wheat ?? 0) > 0)
  if (farms.length > 0) {
    const { i } = farms[Math.floor(Math.random() * farms.length)]
    const pos = cellPos(i)
    available.push({ type: 'eating', label: '🌾 Getting food', targetX: pos.x, targetY: pos.y, resource: 'wheat' })
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
    { key: 'wood',   label: '🪵 Chopping wood' },
    { key: 'ore',    label: '⛏ Mining ore' },
    { key: 'planks', label: '🪵 Fetching planks' },
    { key: 'metal',  label: '⚙ Getting metal' },
    { key: 'bread',  label: '🍞 Buying bread' },
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

  return available[Math.floor(Math.random() * available.length)]
}

// ── Attack countdown helpers ──────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'IMMINENT'
  const totalMin = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMin / 60)
  const mins  = totalMin % 60
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
}

type SubScreen = 'city' | 'picker' | 'upgrade' | 'levelup' | 'fortify'

export function CityBuilder({ onBack }: Props) {
  const [city, setCity]       = useState<CityState>(() => tickCity(loadCityState()))
  const [screen, setScreen]   = useState<SubScreen>('city')
  const [pickerIndex, setPickerIndex] = useState<number>(0)
  const [levelCard, setLevelCard]     = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)
  const [walkers, setWalkers] = useState<Walker[]>([])
  const [selectedWalkerCell, setSelectedWalkerCell] = useState<number | null>(null)
  const [selectedBuildingCell, setSelectedBuildingCell] = useState<number | null>(null)
  const [buildingTab, setBuildingTab] = useState<'residents' | 'upgrade'>('residents')
  const [pickerSearch, setPickerSearch]   = useState('')
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
  const worldRef = useRef<HTMLDivElement>(null)
  const worldDimsRef = useRef({ w: CITY_COLS * CELL_PX, h: CITY_ROWS * CELL_PX })
  const cityRef    = useRef(city)
  const walkersRef = useRef(walkers)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function save(next: CityState) {
    setCity(next)
    saveCityState(next)
  }

  // Keep refs in sync so the animation loop and intervals always see the latest state
  useEffect(() => { cityRef.current    = city    }, [city])
  useEffect(() => { walkersRef.current = walkers }, [walkers])

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
  }, [city.grid, city.cardLevels])

  // ── Animation loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      const { w: _w, h: _h } = worldDimsRef.current
      const overlayW = _w || CITY_COLS * CELL_PX
      const overlayH = _h || CITY_ROWS * CELL_PX

      setWalkers(prev => prev.map(w => {
        // ── Resting at home ──────────────────────────────────────────────────
        if (w.hidden) {
          const hiddenTimer = w.hiddenTimer - 1
          if (hiddenTimer <= 0) {
            const task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
            const bubbleTimer = task.type !== 'idle' ? BUBBLE_TICKS : 0
            return {
              ...w, hidden: false, hiddenTimer: 0,
              task, taskTimer: task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0,
              bubbleTimer,
            }
          }
          return { ...w, hiddenTimer }
        }

        let { x, y, vx, vy, turnTimer, task, taskTimer, bubbleTimer } = w
        bubbleTimer = Math.max(0, bubbleTimer - 1)

        // ── Update visiting target to follow the other walker ─────────────────
        if (task.type === 'visiting' && task.targetWalkerKey) {
          const [ci, ui] = task.targetWalkerKey.split('-').map(Number)
          const target = prev.find(o => o.cellIndex === ci && o.unitIndex === ui && !o.hidden)
          if (target) {
            task = { ...task, targetX: target.x, targetY: target.y }
          } else {
            task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
            taskTimer = task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0
            if (task.type !== 'idle') bubbleTimer = BUBBLE_TICKS
          }
        }

        // ── Idle: count down and pick a new task when timer expires ──────────
        if (task.type === 'idle') {
          taskTimer--
          if (taskTimer <= 0) {
            task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
            taskTimer = task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0
            if (task.type !== 'idle') bubbleTimer = BUBBLE_TICKS
          }
        }

        // ── Directed movement ────────────────────────────────────────────────
        if (task.type !== 'idle' && task.targetX !== undefined && task.targetY !== undefined) {
          const dx = task.targetX - x
          const dy = task.targetY - y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < ARRIVE_DIST) {
            // Arrived!
            if (task.type === 'resting') {
              return {
                ...w, x, y, vx: 0, vy: 0, task, bubbleTimer,
                hidden: true,
                hiddenTimer: REST_TICKS_MIN + Math.floor(Math.random() * (REST_TICKS_MAX - REST_TICKS_MIN)),
              }
            }
            // For all other tasks: pick new task immediately
            task = pickTask(w, prev, cityRef.current, overlayW, overlayH)
            taskTimer = task.type === 'idle' ? IDLE_TASK_TICKS + Math.floor(Math.random() * IDLE_TASK_TICKS) : 0
            if (task.type !== 'idle') bubbleTimer = BUBBLE_TICKS
            // Keep moving with current velocity until next tick steers differently
          } else {
            vx = (dx / dist) * SPEED
            vy = (dy / dist) * SPEED
          }
        }

        // ── Apply movement ───────────────────────────────────────────────────
        x += vx
        y += vy
        if (x < 0)                    { x = 0;                    vx = Math.abs(vx) }
        if (x > overlayW - UNIT_SIZE) { x = overlayW - UNIT_SIZE; vx = -Math.abs(vx) }
        if (y < 0)                    { y = 0;                    vy = Math.abs(vy) }
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

        return { ...w, x, y, vx, vy, turnTimer, task, taskTimer, bubbleTimer }
      }))
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
            gold:        Math.max(0, prev.gold + goldDelta),
            resources:   newResources,
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
    setSelectedWalkerCell(null)
  }

  // ── Place a card ──────────────────────────────────────────────────────────────

  const handlePickCard = useCallback((card: Card) => {
    const spawnEffect = card.unit?.structureEffect
    const isSpawner   = spawnEffect?.type === 'spawn'
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
      rarity:   card.rarity,
      spawnedUnitName,
      affinityWith,
    }
    save(placeCard(city, pickerIndex, cell))
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
    if (!canAffordFortification(city, card.rarity)) { showToast('Not enough resources!'); return }
    const next = addFortification(city, card.name, card.rarity)
    if (!next) { showToast(`Fort limit reached (${MAX_TOTAL_FORTS} max).`); return }
    save(next)
    showToast(`${card.name} built!`)
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

  const catalog    = getCardCatalog()
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
  const netRate    = Math.round(goldNetRate(city))
  const defense    = cityDefense(city)
  const population = cityPopulation(city)

  const prodRates = resourceProductionRate(city)
  const consRates = resourceConsumptionRate(city)

  const cityRows  = city.rows ?? CITY_ROWS
  const cityCells = CITY_COLS * cityRows
  const expansionCost = EXPANSION_COSTS[cityRows]
  const affordable = canAffordExpansion(city)

  const msToAttack = Math.max(0, city.nextAttackAt - currentTime)
  const attackCountdown = formatCountdown(msToAttack)
  const attackUrgency = msToAttack < 3_600_000 ? 'imminent' : msToAttack < 10_800_000 ? 'soon' : 'calm'

  // ── Fortify sub-screen ────────────────────────────────────────────────────────

  if (screen === 'fortify') {
    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setScreen('city')}>← BACK</button>
          <div className="city-picker-title">🛡 FORTIFICATIONS ({city.fortifications.length}/{MAX_TOTAL_FORTS})</div>
        </div>

        <div className="city-subscreen-scroll">
        <div className="city-fort-info-row">
          <span>Total defence from forts: <strong>{
            city.fortifications.reduce((sum, f) => sum + Math.round(FORT_DEFENSE[f.rarity] * (f.hp / f.maxHp)), 0)
          } 🛡</strong></span>
          <span className="city-fort-repair-note">Residents repair walls using 🪵</span>
        </div>

        {city.fortifications.length > 0 && (
          <>
            <div className="city-picker-section-label">BUILT ({city.fortifications.length})</div>
            <div className="city-fort-list">
              {city.fortifications.map((fort, idx) => {
                const hpPct = Math.round((fort.hp / fort.maxHp) * 100)
                const hpColor = hpPct > 60 ? '#40a040' : hpPct > 30 ? '#c08020' : '#c04020'
                return (
                  <div key={idx} className="city-fort-item">
                    <SpriteImg name={fort.cardName} className="city-fort-sprite" />
                    <div className="city-fort-details">
                      <div className="city-fort-name">{fort.cardName}</div>
                      <div className="city-fort-hp-track">
                        <div className="city-fort-hp-bar">
                          <div className="city-fort-hp-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
                        </div>
                        <span className="city-fort-hp-text">{Math.round(fort.hp)}/{fort.maxHp}</span>
                      </div>
                      <div className="city-fort-defense-val">🛡 {Math.round(FORT_DEFENSE[fort.rarity] * (fort.hp / fort.maxHp))}</div>
                    </div>
                    <button className="filter-btn city-fort-remove" onClick={() => handleRemoveFort(idx)}>×</button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="city-picker-section-label">ADD WALL / MOAT</div>
        {city.fortifications.length >= MAX_TOTAL_FORTS ? (
          <div className="city-picker-empty">Fort limit reached ({MAX_TOTAL_FORTS}/{MAX_TOTAL_FORTS}). Remove one to add another.</div>
        ) : availableDefenceCards.length === 0 ? (
          <div className="city-picker-empty">
            {ownedStructures.some(c => isDefenceCard(c.name, c.unit?.structureEffect?.type === 'spawn'))
              ? 'All owned defence cards are already deployed.'
              : 'No wall or moat cards in collection. Earn them from battles!'}
          </div>
        ) : (
          <div className="city-picker-grid">
            {availableDefenceCards.map(card => {
              const cost = FORT_PLACE_COST[card.rarity]
              const affordable = canAffordFortification(city, card.rarity)
              return (
                <button
                  key={card.name}
                  className={`city-picker-card${!affordable ? ' city-picker-card--unaffordable' : ''}`}
                  onClick={() => handleAddFort(card)}
                  disabled={!affordable}
                >
                  <SpriteImg name={card.name} className="city-picker-sprite" />
                  <div className="city-picker-name">{card.name}</div>
                  <div className={`city-picker-rarity city-picker-rarity--${card.rarity}`}>{card.rarity}</div>
                  <div className="city-picker-income">🛡 {FORT_DEFENSE[card.rarity]} · {FORT_MAX_HP[card.rarity]} HP</div>
                  <div className="city-picker-cost">
                    ⚙{cost.gold.toLocaleString()}
                    {(Object.keys(cost) as (keyof typeof cost)[])
                      .filter(k => k !== 'gold' && (cost[k] ?? 0) > 0)
                      .map(k => ` ${RESOURCE_ICONS[k as ResourceType]}${cost[k]}`)
                      .join('')}
                  </div>
                </button>
              )
            })}
          </div>
        )}
        </div>
      </div>
    )
  }

  // ── Card picker sub-screen ────────────────────────────────────────────────────

  if (screen === 'picker') {
    const pickerQ = pickerSearch.toLowerCase()
    const filteredForPlace = pickerQ
      ? availableForPlace.filter(c => c.name.toLowerCase().includes(pickerQ))
      : availableForPlace

    type PickerGroup = { label: string; cards: typeof availableForPlace }
    const groups: PickerGroup[] = [
      {
        label: 'SPAWNERS',
        cards: filteredForPlace.filter(c => c.unit?.structureEffect?.type === 'spawn'),
      },
      {
        label: 'PRODUCERS',
        cards: filteredForPlace.filter(c => {
          if (c.unit?.structureEffect?.type === 'spawn') return false
          const p = getBuildingProduces(c.name)
          return Object.values(p).some(v => (v ?? 0) > 0)
        }),
      },
    ].filter(g => g.cards.length > 0)

    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setScreen('city')}>← BACK</button>
          <div className="city-picker-title">PLACE A BUILDING</div>
        </div>
        <div className="city-subscreen-scroll">
          <input
            className="city-search"
            type="search"
            placeholder="Search buildings…"
            value={pickerSearch}
            onChange={e => setPickerSearch(e.target.value)}
          />
          {availableForPlace.length === 0 ? (
            <div className="city-picker-empty">No buildings available. Earn more from battles!</div>
          ) : groups.length === 0 ? (
            <div className="city-picker-empty">No buildings match "{pickerSearch}"</div>
          ) : (
            groups.map(group => (
              <div key={group.label} className="city-picker-section">
                <div className="city-picker-section-label">{group.label}</div>
                <div className="city-picker-grid">
                  {group.cards.map(card => {
                    const spawnEffect = card.unit?.structureEffect
                    const isSpawner   = spawnEffect?.type === 'spawn'
                    const spawnName   = isSpawner
                      ? (spawnEffect as { type: 'spawn'; unitTemplate: { name: string }; intervalMs: number }).unitTemplate.name
                      : null
                    const affordable  = !isSpawner || canAffordPlacement(city, card.rarity)
                    const cost        = isSpawner ? SPAWNER_PLACE_COST[card.rarity] : null
                    const produces    = !isSpawner ? getBuildingProduces(card.name) : null
                    const mLvl        = masteryLevel(getMasteryXp(collection, card.name))
                    const masteryMult = !isSpawner ? masteryOutputMultiplier(city.cardLevels[card.name] ?? 0) : 1
                    const producesEntries = produces ? Object.entries(produces).filter(([, v]) => (v ?? 0) > 0) : []
                    const incomeRateVal = isSpawner
                      ? INCOME_SPAWN[card.rarity]
                      : producesEntries.length === 0 ? INCOME_WALL[card.rarity] : INCOME_UTILITY[card.rarity]

                    return (
                      <button
                        key={card.name}
                        className={`city-picker-card${!affordable ? ' city-picker-card--unaffordable' : ''}`}
                        onClick={() => handlePickCard(card)}
                        disabled={!affordable}
                      >
                        <SpriteImg name={card.name} className="city-picker-sprite" />
                        <div className="city-picker-name">{card.name}</div>
                        <div className={`city-picker-rarity city-picker-rarity--${card.rarity}`}>{card.rarity}</div>
                        {mLvl > 0 && <div className="city-picker-mastery">★{mLvl}</div>}
                        {spawnName && (
                          <div className="city-picker-spawns">
                            <SpriteImg name={spawnName} className="city-picker-spawn-icon" />
                            <span>{spawnName}</span>
                          </div>
                        )}
                        {cost && (
                          <div className="city-picker-cost">
                            {Object.entries(cost).map(([r, amt]) =>
                              `${RESOURCE_ICONS[r as ResourceType]}${amt}`
                            ).join(' ')}
                          </div>
                        )}
                        {producesEntries.length > 0 && (
                          <div className="city-picker-produces">
                            {producesEntries.map(([r, amt]) =>
                              `+${Math.round((amt as number) * masteryMult)} ${RESOURCE_ICONS[r as ResourceType]}/min`
                            ).join(' ')}
                          </div>
                        )}
                        {incomeRateVal > 0 && (
                          <div className="city-picker-income">+{incomeRateVal} 💰/min</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Upgrade sub-screen ────────────────────────────────────────────────────────

  if (screen === 'upgrade') {
    const upgradeQ = upgradeSearch.toLowerCase()
    const filteredLevellable = upgradeQ
      ? levellable.filter(c => c.name.toLowerCase().includes(upgradeQ))
      : levellable

    type UpgradeGroup = { label: string; cards: typeof levellable }
    const upgradeGroups: UpgradeGroup[] = [
      {
        label: 'SPAWNERS',
        cards: filteredLevellable.filter(c => c.unit?.structureEffect?.type === 'spawn'),
      },
      {
        label: 'PRODUCERS',
        cards: filteredLevellable.filter(c => {
          if (c.unit?.structureEffect?.type === 'spawn') return false
          const p = getBuildingProduces(c.name)
          return Object.values(p).some(v => (v ?? 0) > 0)
        }),
      },
      {
        label: 'DEFENCE',
        cards: filteredLevellable.filter(c => {
          if (c.unit?.structureEffect?.type === 'spawn') return false
          const p = getBuildingProduces(c.name)
          return !Object.values(p).some(v => (v ?? 0) > 0)
        }),
      },
    ].filter(g => g.cards.length > 0)

    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setScreen('city')}>← BACK</button>
          <div className="city-picker-title">UPGRADE BUILDINGS</div>
        </div>
        <div className="city-subscreen-scroll">
          <div className="city-gold-display" style={{ textAlign: 'center', padding: '4px' }}>
            ⚙ {city.gold.toLocaleString()} gold
          </div>
          <input
            className="city-search"
            type="search"
            placeholder="Search buildings…"
            value={upgradeSearch}
            onChange={e => setUpgradeSearch(e.target.value)}
          />
          {upgradeGroups.length === 0 ? (
            <div className="city-picker-empty">
              {upgradeQ ? `No buildings match "${upgradeSearch}"` : 'No buildings to upgrade yet.'}
            </div>
          ) : (
            upgradeGroups.map(group => (
              <div key={group.label} className="city-picker-section">
                <div className="city-picker-section-label">{group.label}</div>
                <div className="city-level-grid">
                  {group.cards.map(card => {
                    const xp        = getMasteryXp(loadCollection(), card.name)
                    const mLvl      = masteryLevel(xp)
                    const cost      = levelUpCost(mLvl)
                    const canAfford = city.gold >= cost
                    return (
                      <button
                        key={card.name}
                        className={`city-level-card${mLvl > 0 ? ' city-level-card--levelled' : ''}`}
                        onClick={() => { setLevelCard(card.name); setScreen('levelup') }}
                      >
                        <SpriteImg name={card.name} className="city-level-card-sprite" />
                        <div className="city-level-card-name">{card.name}</div>
                        <div className="city-level-card-stars">★{mLvl} mastery</div>
                        <div className={`city-level-card-cost${canAfford ? ' city-level-card-cost--ready' : ''}`}>
                          ⚙ {cost.toLocaleString()}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Level-up detail sub-screen ────────────────────────────────────────────────

  if (screen === 'levelup' && levelCard !== null) {
    const card     = catalog.find(c => c.name === levelCard)
    const xp       = getMasteryXp(loadCollection(), levelCard)
    const { level: mLvl } = masteryProgress(xp)
    const cost     = levelUpCost(mLvl)
    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setScreen('upgrade')}>← BACK</button>
          <div className="city-picker-title">LEVEL UP CARD</div>
        </div>
        <div className="city-level-detail">
          {card && <SpriteImg name={card.name} className="city-level-sprite" />}
          <div className="city-level-name">{levelCard}</div>
          <div className="city-level-stats">
            <div style={{ marginBottom: 4 }}>Mastery</div>
            <MasteryBar xp={xp} />
          </div>
          <div className="city-level-cost">
            Next upgrade costs <span className="city-gold">⚙ {cost.toLocaleString()}</span>
            {' '}and grants mastery ★{mLvl + 1}
          </div>
          <div className="city-level-costs-table">
            {LEVEL_UP_COSTS.map((c, i) => (
              <div key={i} className={`city-cost-row${i < mLvl ? ' city-cost-row--done' : ''}`}>
                <span>★{i} → ★{i + 1}</span>
                <span>⚙ {c.toLocaleString()}</span>
              </div>
            ))}
            <div className={`city-cost-row${mLvl >= LEVEL_UP_COSTS.length ? ' city-cost-row--done' : ''}`}>
              <span>★{LEVEL_UP_COSTS.length}+</span>
              <span>⚙ {LEVEL_UP_COSTS[LEVEL_UP_COSTS.length - 1].toLocaleString()}</span>
            </div>
          </div>
          <button
            className={`action-btn${city.gold >= cost ? ' action-btn--gold' : ''}`}
            onClick={() => handleLevelUp(levelCard)}
            disabled={city.gold < cost}
          >
            {city.gold >= cost ? `LEVEL UP (⚙ ${cost.toLocaleString()})` : `NEED ⚙ ${cost.toLocaleString()}`}
          </button>
        </div>
      </div>
    )
  }

  // ── Main city view ────────────────────────────────────────────────────────────

  return (
    <div className="city-screen">
      {toast && <div className="city-toast" role="alert">{toast}</div>}

      {/* Attack report modal */}
      {attackReport && (
        <div className="city-req-overlay" onClick={() => setAttackReport(null)}>
          <div className="city-req-modal" onClick={e => e.stopPropagation()}>
            <div className={`city-attack-report-header city-attack-report--${attackReport.outcome}`}>
              {attackReport.outcome === 'repelled' && '⚔ ATTACK REPELLED'}
              {attackReport.outcome === 'partial'  && '⚔ CITY RAIDED'}
              {attackReport.outcome === 'defeated' && '💀 CITY DEFEATED'}
            </div>
            <div className="city-attack-report-body">
              <div className="city-attack-stat">
                Attacker power: <strong>{attackReport.power}</strong> vs your defence: <strong>{attackReport.defense}</strong>
              </div>
              {attackReport.outcome === 'repelled' && (
                <div className="city-attack-good">Your defences held! Minor wall damage only.</div>
              )}
              {attackReport.stolenGold > 0 && (
                <div className="city-attack-bad">⚙ {attackReport.stolenGold.toLocaleString()} gold stolen</div>
              )}
              {attackReport.destroyedBuildings.length > 0 && (
                <div className="city-attack-bad">
                  Buildings destroyed: {attackReport.destroyedBuildings.join(', ')}
                </div>
              )}
              {city.fortifications.some(f => f.hp < f.maxHp) && (
                <div className="city-attack-warn">Fortifications damaged — residents are repairing.</div>
              )}
            </div>
            <button className="action-btn" onClick={() => setAttackReport(null)}>CLOSE</button>
          </div>
        </div>
      )}

      {/* Unit requirements modal */}
      {selectedWalkerCell !== null && (() => {
        const cell = city.grid[selectedWalkerCell]
        if (!cell?.spawnedUnitName) return null
        const happiness = city.happiness[selectedWalkerCell] ?? 100
        const reqs = getUnitRequirements(cell, city, selectedWalkerCell)
        const moodKey = happiness === 0 ? 'gone' : happiness < 30 ? 'furious' : happiness < 60 ? 'unsettled' : 'content'
        const cellWalkers = walkers.filter(w => w.cellIndex === selectedWalkerCell)
        return (
          <div className="city-req-overlay" onClick={() => setSelectedWalkerCell(null)}>
            <div className="city-req-modal" onClick={e => e.stopPropagation()}>
              <div className="city-req-header">
                <AnimatedSpriteImg name={cell.spawnedUnitName} frameCount={3} fps={6} className="city-req-sprite" />
                <div className="city-req-name">{cell.spawnedUnitName}</div>
              </div>
              <div className={`city-req-mood city-req-mood--${moodKey}`}>{rageDescription(happiness)}</div>
              {cellWalkers.length > 0 && (
                <div className="city-req-list">
                  {cellWalkers.map(w => (
                    <div key={`${w.cellIndex}-${w.unitIndex}`} className="city-req-item city-req-item--met">
                      <span className="city-req-icon">📍</span>
                      {residentName(w.unitName, w.cellIndex, w.unitIndex).split(' ')[0]}:{' '}
                      {w.hidden ? '🏠 Resting at home' : w.task.label}
                    </div>
                  ))}
                </div>
              )}
              <div className="city-req-list">
                {reqs.map((r, idx) => (
                  <div key={idx} className={`city-req-item${r.met ? ' city-req-item--met' : ' city-req-item--unmet'}`}>
                    <span className="city-req-icon">{r.met ? '✓' : '✗'}</span>
                    {r.text}
                  </div>
                ))}
              </div>
              <button className="action-btn" onClick={() => setSelectedWalkerCell(null)}>CLOSE</button>
            </div>
          </div>
        )
      })()}

      {/* Building inspect modal */}
      {selectedBuildingCell !== null && (() => {
        const cell = city.grid[selectedBuildingCell]
        if (!cell) return null
        const happiness    = cell.spawnedUnitName ? (city.happiness[selectedBuildingCell] ?? 100) : 100
        const unitCount    = cell.spawnedUnitName ? spawnerUnitCount(city, cell.cardName) : 0
        const moodKey      = happiness === 0 ? 'gone' : happiness < 30 ? 'furious' : happiness < 60 ? 'unsettled' : 'content'
        const produces     = getBuildingProduces(cell.cardName)
        const masteryMult  = masteryOutputMultiplier(city.cardLevels[cell.cardName] ?? 0)
        const produceEntries = Object.entries(produces).filter(([, v]) => (v ?? 0) > 0)
        const xp           = getMasteryXp(collection, cell.cardName)
        const { level: mLvl } = masteryProgress(xp)
        const upgradeCost  = levelUpCost(mLvl)
        const canAfford    = city.gold >= upgradeCost
        return (
          <div className="city-req-overlay" onClick={() => setSelectedBuildingCell(null)}>
            <div className="city-req-modal" onClick={e => e.stopPropagation()}>
              <div className="city-req-header">
                <SpriteImg name={cell.cardName} className="city-req-sprite" />
                <div className="city-req-name">
                  {cell.cardName}
                  {mLvl > 0 && <span className="city-req-mastery"> ★{mLvl}</span>}
                </div>
              </div>
              <div className="city-bld-tabs">
                <button
                  className={`city-bld-tab${buildingTab === 'residents' ? ' city-bld-tab--active' : ''}`}
                  onClick={() => setBuildingTab('residents')}
                >Residents</button>
                <button
                  className={`city-bld-tab${buildingTab === 'upgrade' ? ' city-bld-tab--active' : ''}`}
                  onClick={() => setBuildingTab('upgrade')}
                >Upgrade</button>
              </div>

              {buildingTab === 'residents' && (
                cell.spawnedUnitName ? (
                  <>
                    <div className="city-bld-section-title">Residents ({happiness === 0 ? 0 : unitCount})</div>
                    {happiness === 0 ? (
                      <div className="city-bld-vacant">Building is vacant — unit left the city</div>
                    ) : (
                      Array.from({ length: unitCount }, (_, u) => {
                        const reqs = getUnitRequirements(cell, city, selectedBuildingCell)
                        const unmet = reqs.filter(r => !r.met)
                        const walker = walkers.find(wk => wk.cellIndex === selectedBuildingCell && wk.unitIndex === u)
                        const taskLabel = walker
                          ? (walker.hidden ? '🏠 Resting at home' : walker.task.label)
                          : null
                        return (
                          <div key={u} className="city-bld-resident">
                            <AnimatedSpriteImg name={cell.spawnedUnitName!} frameCount={3} fps={6} className="city-bld-resident-sprite" />
                            <div className="city-bld-resident-info">
                              <div className="city-bld-resident-name">{residentName(cell.spawnedUnitName!, selectedBuildingCell, u)}</div>
                              <div className={`city-req-mood city-req-mood--${moodKey}`}>{rageDescription(happiness)}</div>
                              {taskLabel && <div className="city-bld-resident-task">{taskLabel}</div>}
                              {unmet.map((r, i) => (
                                <div key={i} className="city-bld-resident-req">✗ {r.text}</div>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </>
                ) : produceEntries.length > 0 ? (
                  <>
                    <div className="city-bld-section-title">Produces</div>
                    {produceEntries.map(([res, amt]) => (
                      <div key={res} className="city-bld-produces-row">
                        +{Math.round((amt as number) * masteryMult)} {RESOURCE_ICONS[res as ResourceType]}/min
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="city-bld-section-title">Defensive structure</div>
                )
              )}

              {buildingTab === 'upgrade' && (
                <div className="city-bld-upgrade">
                  <div className="city-gold-display" style={{ alignSelf: 'center' }}>⚙ {city.gold.toLocaleString()} gold</div>
                  <MasteryBar xp={xp} />
                  <div className="city-level-cost">
                    Next upgrade: <span className="city-gold">⚙ {upgradeCost.toLocaleString()}</span> → ★{mLvl + 1}
                  </div>
                  <div className="city-level-costs-table">
                    {LEVEL_UP_COSTS.map((c, i) => (
                      <div key={i} className={`city-cost-row${i < mLvl ? ' city-cost-row--done' : ''}`}>
                        <span>★{i} → ★{i + 1}</span>
                        <span>⚙ {c.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className={`action-btn${canAfford ? ' action-btn--gold' : ''}`}
                    onClick={() => { handleLevelUp(cell.cardName); setBuildingTab('upgrade') }}
                    disabled={!canAfford}
                  >
                    {canAfford ? `LEVEL UP (⚙ ${upgradeCost.toLocaleString()})` : `NEED ⚙ ${upgradeCost.toLocaleString()}`}
                  </button>
                </div>
              )}

              <button className="action-btn" onClick={() => setSelectedBuildingCell(null)}>CLOSE</button>
            </div>
          </div>
        )
      })()}

      {/* Header: back | title | gold | action buttons */}
      <div className="city-header">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="city-title">
          {bulldozerMode
            ? '⏸ PAUSED'
            : '🏙 CITY'}
          
          </div>
        <div className="city-header-right">

                    <div className="city-gold-display">⚙ {city.gold.toLocaleString() } (+{incomeRate}/min)</div>

         
        </div>
      </div>

      {/* Compact info strip: attack countdown + defence + income + pop */}
      <div className="city-info-strip">
       



      </div>



      {/* Resources: horizontally scrollable chip strip */}
      <div className="city-res-strip">
        <span className="city-info-chip"  title={`Defense: ${defense}`}>🛡 {defense}</span>

        <span className="city-info-chip" title={`Population: ${population}`}>👥 {population}</span>

        {(['wheat', 'wood', 'ore', 'bread', 'planks', 'metal'] as ResourceType[]).map(res => {
          const stock = Math.floor(city.resources[res])
          const prod  = prodRates[res] ?? 0
          const cons  = consRates[res] ?? 0
          const net   = prod - cons
          if (stock === 0 && prod === 0) return null
          // const label = stock >= 10000 ? `${(stock / 1000).toFixed(0)}k` : stock >= 1000 ? `${(stock / 1000).toFixed(1)}k` : `${stock}`
          const label = `${stock}`
          return (
            <span key={res} className="city-res-chip" title={`${res}: ${stock} stock, ${net >= 0 ? '+' : ''}${net}/min`}>
              {RESOURCE_ICONS[res]}{label}
              {net !== 0 && <span className={net > 0 ? 'city-res-pos' : 'city-res-neg'}>{net > 0 ? `+${net}` : net}</span>}
            </span>
          )
        })}
      </div>

      <div className="city-header">
                       <div className={`city-attack-pill city-attack-pill--${attackUrgency}`}>    
          ⚔ ATTACK INCOMING {msToAttack <= 0 ? 'NOW!' : attackCountdown}
        
                  </div>
                <div className="city-header-right">
        <button className="filter-btn" onClick={() => setScreen('upgrade')} title="Upgrade buildings">★ UPGRADES</button>

                {cityRows < MAX_CITY_ROWS && expansionCost && (
          <button
            className={`filter-btn city-expand-btn${affordable ? ' city-expand-btn--ready' : ''}`}
            onClick={handleExpand}
            title={affordable ? `Expand city to ${cityRows + 1} rows` : 'Not enough resources to expand'}
          >🏢 EXPAND CITY</button>
        )}
        </div>
      </div>

      {/* City world: fixed 50vh, scales with rows */}
      <div className="city-world" ref={worldRef}>
        <div
          className="city-grid"
          style={{
            gridTemplateColumns: `repeat(${CITY_COLS}, 1fr)`,
            gridTemplateRows:    `repeat(${cityRows}, 1fr)`,
          }}
        >
          {Array.from({ length: cityCells }, (_, i) => {
            const cell      = city.grid[i]
            const happiness = cell?.spawnedUnitName ? (city.happiness[i] ?? 100) : 100
            const rage      = 100 - happiness
            const despawned = cell?.spawnedUnitName && happiness === 0
            return (
              <button
                key={i}
                className={`city-cell${cell ? ' city-cell--occupied' : ''}${cell && bulldozerMode ? ' city-cell--bulldoze' : ''}`}
                onClick={() => handleCellTap(i)}
                title={cell ? (bulldozerMode ? `${cell.cardName} — tap to demolish` : `${cell.cardName} — tap to inspect`) : 'Empty — tap to place'}
              >
                {cell ? (
                  <>
                    <SpriteImg name={cell.cardName} className="city-cell-sprite" />
                    {cell.spawnedUnitName && rage > 0 && (
                      <div
                        className="city-cell-happiness"
                        style={{
                          width: `${rage}%`,
                          background: rage < 40 ? '#a0a020' : rage < 70 ? '#c05010' : '#a03020',
                        }}
                      />
                    )}
                    {despawned && <span className="city-cell-unhappy-icon">💀</span>}
                    {!despawned && rage >= 60 && <span className="city-cell-unhappy-icon">⚠</span>}
                  </>
                ) : (
                  <span className="city-cell-empty">
                    <span className="city-cell-forsale-sign">FOR<br/>SALE</span>
                    <span className="city-cell-forsale-post" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Walking units overlay */}
        <div className="city-unit-overlay">
          {(() => {
            const visibleBubbleSet = new Set(
              walkers
                .filter(w => !w.hidden && w.bubbleTimer > 0 && w.task.type !== 'idle')
                .sort((a, b) => b.bubbleTimer - a.bubbleTimer)
                .slice(0, 3)
                .map(w => `${w.cellIndex}-${w.unitIndex}`)
            )
            return walkers.map(w => {
            if (w.hidden) return null
            const happiness       = city.happiness[w.cellIndex] ?? 100
            const rage            = 100 - happiness
            const wantedNeighbour = w.affinityWith ?? w.unitName
            const gridRows2       = city.rows ?? CITY_ROWS
            const wantsFriend     = !getNeighbourIndices(w.cellIndex, gridRows2).some(ni => {
              const nc = city.grid[ni]
              return nc?.spawnedUnitName === wantedNeighbour && (city.happiness[ni] ?? 100) > 0
            })
            const showTaskBubble = visibleBubbleSet.has(`${w.cellIndex}-${w.unitIndex}`)
            return (
              <div
                key={`${w.cellIndex}-${w.unitIndex}`}
                role="button"
                tabIndex={0}
                className={`city-walker${rage >= 60 ? ' city-walker--unhappy' : ''}`}
                style={{ left: Math.round(w.x), top: Math.round(w.y) }}
                onClick={e => { e.stopPropagation(); setSelectedWalkerCell(w.cellIndex) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedWalkerCell(w.cellIndex) } }}
              >
                {showTaskBubble && (
                  <div className="city-task-bubble">{w.task.label}</div>
                )}
                {!showTaskBubble && wantsFriend && (
                  <div className="city-speech-bubble" title={`Wants a ${wantedNeighbour} next door!`}>
                    <SpriteImg name={wantedNeighbour} className="city-speech-icon" />
                  </div>
                )}
                <AnimatedSpriteImg name={w.unitName} frameCount={3} fps={6} className="city-walker-sprite" />
                {rage >= 40 && <span className="city-walker-need">!</span>}
              </div>
            )
          })
          })()}
        </div>
      </div>

      {/* City perimeter — fortification sprites as the city wall */}
      {city.fortifications.length > 0 && (
        <div
          className="city-perimeter"
          role="button"
          tabIndex={0}
          onClick={() => setScreen('fortify')}
          onKeyDown={e => { if (e.key === 'Enter') setScreen('fortify') }}
          title="City fortifications — tap to manage"
        >
          <div className="city-perimeter-forts">
            {city.fortifications.map((fort, idx) => {
              const hpPct  = fort.hp / fort.maxHp
              const hpColor = hpPct > 0.6 ? '#308030' : hpPct > 0.3 ? '#806020' : '#803020'
              return (
                <div key={idx} className="city-perimeter-fort">
                  <div className="city-perimeter-fort-bg" style={{ opacity: 0.2 + hpPct * 0.5, background: hpColor }} />
                  <SpriteImg name={fort.cardName} className="city-perimeter-sprite" />
                  <div className="city-perimeter-hp" style={{ width: `${Math.round(hpPct * 100)}%`, background: hpColor }} />
                </div>
              )
            })}
          </div>
        </div>
      )}

            <div className="city-header">
        <button
          className={`filter-btn${bulldozerMode ? ' city-bulldozer-btn--active' : ''}`}
          onClick={toggleBulldozer}
          title={bulldozerMode ? 'Demolish mode ON' : 'Demolish a building'}
        >{bulldozerMode ? '🏗 DEMOLISH' : '🏗 BUILD'}</button>
        <button className="filter-btn" onClick={() => setScreen('fortify')} title="Manage city walls and moats">🛡 FORTIFICATIONS</button>

      </div>

      {/* Scrollable bottom: resident thoughts */}
      <div className="city-bottom-scroll">
        {residentThoughts.length > 0 && (
          <div className="city-thoughts">
            <div className="city-thoughts-title">RESIDENT THOUGHTS</div>
            {residentThoughts.map((t, idx) => (
              <div key={idx} className={`city-thought-row${t.happy ? ' city-thought-row--happy' : ' city-thought-row--unhappy'}`}>
                <AnimatedSpriteImg name={t.unitName} frameCount={3} fps={6} className="city-thought-sprite" />
                <span className="city-thought-name">{t.name}:</span>
                <span className="city-thought-text">"{t.thought}"</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
