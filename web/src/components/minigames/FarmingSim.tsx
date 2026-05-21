// ─── Farming Simulation ────────────────────────────────────────────────────────
// Arable land outside the city walls. Mirrors the CityBuilder walker system
// but all walkers are farmers sourced from city population.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  FarmState, FarmRaidEvent,
  loadFarmState, saveFarmState, tickFarm,
  placeFarmBuilding, removeFarmBuilding,
  assignWorker, unassignWorker,
  hireFarmer, nextFarmerCost,
  getFarmProductionRate, farmDefense,
  canPlaceOnFarm, addFarmChronicle,
  FARM_COLS, FARM_ROWS,
} from '../../game/farmingSim'
import {
  CityState, ResourceType, CELL_PX,
  cityPopulation, getBuildingProduces,
  getNeighbourIndices,
} from '../../game/cityBuilder'
import { getCardCatalog } from '../../game/cards'
import { loadCollection, getOwnedCount } from '../../game/collection'
import { logError } from '../../logger'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Walker, WalkerTask, TaskType, PersonalityTrait } from './citybuilder/walkerTypes'
import { FarmGrid } from './farming/FarmGrid'
import { FarmWorkerStrip } from './farming/FarmWorkerStrip'
import { FarmRaidModal } from './farming/FarmRaidModal'
import { FarmResourceBar } from './farming/FarmResourceBar'
import { FarmBuildingPicker } from './farming/FarmBuildingPicker'
import { ChroniclePanel } from './citybuilder/ChroniclePanel'
import { Card } from '../../game/types'

// ── Walker constants ──────────────────────────────────────────────────────────

const UNIT_SIZE    = 20
const SPEED        = 0.8
const ARRIVE_DIST  = 14
const IDLE_TICKS   = 80
const BUBBLE_TICKS = 30
const REST_MIN     = 4 * IDLE_TICKS
const REST_MAX     = 7 * IDLE_TICKS
const TRAITS: PersonalityTrait[] = ['brave', 'glutton', 'industrious', 'sociable', 'reclusive']

// ── Walker factory ────────────────────────────────────────────────────────────

function makeFarmerWalker(workerIndex: number, w: number, h: number): Walker {
  const angle = Math.random() * Math.PI * 2
  return {
    cellIndex:  workerIndex,
    unitIndex:  0,
    unitName:   'farmer',
    x:          Math.random() * Math.max(1, w - UNIT_SIZE),
    y:          Math.random() * Math.max(1, h - UNIT_SIZE),
    vx:         Math.cos(angle) * SPEED,
    vy:         Math.sin(angle) * SPEED,
    turnTimer:  20 + Math.floor(Math.random() * 30),
    task:       { type: 'idle', label: '🚶 Taking a stroll' },
    taskTimer:  Math.floor(Math.random() * IDLE_TICKS),
    bubbleTimer: 0,
    hidden:     false,
    hiddenTimer: 0,
    trait:      TRAITS[(workerIndex * 13) % 5],
    waypoints:  [],
  }
}

// ── Task picker for farm walkers ──────────────────────────────────────────────

function pickFarmerTask(
  w: Walker,
  farm: FarmState,
  overlayW: number,
  overlayH: number,
): WalkerTask {
  const cols = farm.cols ?? FARM_COLS
  const rows = farm.rows ?? FARM_ROWS

  function cellPos(idx: number) {
    return {
      x: ((idx % cols) + 0.5) * (overlayW / cols),
      y: (Math.floor(idx / cols) + 0.5) * (overlayH / rows),
    }
  }

  const availablePlots = farm.plots
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p != null)

  const tasks: WalkerTask[] = [
    { type: 'idle' as TaskType, label: '🚶 Taking a stroll' },
  ]

  if (availablePlots.length > 0) {
    const { i } = availablePlots[Math.floor(Math.random() * availablePlots.length)]
    const pos = cellPos(i)
    tasks.push({ type: 'farming' as TaskType, label: '🌾 Working the fields', targetX: pos.x, targetY: pos.y })
    tasks.push({ type: 'gathering' as TaskType, label: '⛏ Gathering crops', targetX: pos.x, targetY: pos.y })
  }

  tasks.push({
    type: 'resting' as TaskType, label: '💤 Taking a break',
    targetX: (Math.random() * 0.6 + 0.2) * overlayW,
    targetY: (Math.random() * 0.6 + 0.2) * overlayH,
  })

  return tasks[Math.floor(Math.random() * tasks.length)]
}

// ── Props / SubScreen ─────────────────────────────────────────────────────────

interface Props {
  city:       CityState
  onSaveCity: (next: CityState) => void
  onBack:     () => void
}

type SubScreen = 'farm' | 'picker' | 'chronicle'

// ── Component ─────────────────────────────────────────────────────────────────

export function FarmingSim({ city, onSaveCity, onBack }: Props) {
  const [farm, setFarm]             = useState<FarmState>(() => tickFarm(loadFarmState()).nextState)
  const [screen, setScreen]         = useState<SubScreen>('farm')
  const [walkers, setWalkers]       = useState<Walker[]>([])
  const [pickerIndex, setPickerIndex] = useState<number>(0)
  const [bulldozer, setBulldozer]   = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [raidReport, setRaidReport] = useState<FarmRaidEvent | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())

  const farmRef    = useRef(farm)
  const walkersRef = useRef(walkers)
  const worldRef   = useRef<HTMLDivElement>(null)
  const worldDims  = useRef({ w: FARM_COLS * CELL_PX, h: FARM_ROWS * CELL_PX })
  const raidShownRef = useRef<number | null>(
    (() => {
      try { const v = localStorage.getItem('farm-raid-shown-at'); return v ? Number(v) : null } catch { return null }
    })()
  )

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function saveFarm(next: FarmState) {
    setFarm(next)
    saveFarmState(next)
  }

  useEffect(() => { farmRef.current = farm }, [farm])
  useEffect(() => { walkersRef.current = walkers }, [walkers])

  // Show raid modal when a new raid is detected
  useEffect(() => {
    if (farm.lastRaid && farm.lastRaid.at !== raidShownRef.current) {
      setRaidReport(farm.lastRaid)
      raidShownRef.current = farm.lastRaid.at
      try { localStorage.setItem('farm-raid-shown-at', String(farm.lastRaid.at)) } catch { /* ignore */ }
    }
  }, [farm.lastRaid])

  // Sync walkers to worker count
  useEffect(() => {
    setWalkers(prev => {
      const { w, h } = worldDims.current
      const next: Walker[] = []
      for (let i = 0; i < farm.workers; i++) {
        next.push(prev[i] ?? makeFarmerWalker(i, w || FARM_COLS * CELL_PX, h || FARM_ROWS * CELL_PX))
      }
      return next
    })
  }, [farm.workers])

  // Track overlay dimensions
  useEffect(() => {
    const el = worldRef.current
    if (!el) return
    const update = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0)
        worldDims.current = { w: el.clientWidth, h: el.clientHeight }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [screen])

  // Clock for raid countdown
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Farm tick every 10 s
  useEffect(() => {
    const id = setInterval(() => {
      const { nextState, resourcesForCity } = tickFarm(farmRef.current)
      saveFarmState(nextState)
      setFarm(nextState)

      const hasResources = Object.values(resourcesForCity).some(v => (v ?? 0) > 0)
      if (hasResources) {
        const newCityRes = { ...city.resources }
        for (const [res, amt] of Object.entries(resourcesForCity) as [ResourceType, number][]) {
          newCityRes[res] = Math.round((newCityRes[res] ?? 0) + amt)
        }
        onSaveCity({ ...city, resources: newCityRes })
      }
    }, 10_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Walker animation loop (100 ms)
  useEffect(() => {
    const id = setInterval(() => {
      const { w: _w, h: _h } = worldDims.current
      const overlayW = _w || FARM_COLS * CELL_PX
      const overlayH = _h || FARM_ROWS * CELL_PX

      setWalkers(prev => prev.map(w => {
        let { x, y, vx, vy, turnTimer, task, taskTimer, bubbleTimer, waypoints } = w
        waypoints = waypoints ?? []
        bubbleTimer = Math.max(0, bubbleTimer - 1)

        // Resting (hidden)
        if (w.hidden) {
          const t = w.hiddenTimer - 1
          if (t <= 0) {
            const newTask = pickFarmerTask(w, farmRef.current, overlayW, overlayH)
            return { ...w, hidden: false, hiddenTimer: 0, task: newTask,
              taskTimer: newTask.type === 'idle' ? IDLE_TICKS + Math.floor(Math.random() * IDLE_TICKS) : 0,
              bubbleTimer: newTask.type !== 'idle' ? BUBBLE_TICKS : 0, waypoints: [] }
          }
          return { ...w, hiddenTimer: t }
        }

        // Idle countdown
        if (task.type === 'idle') {
          taskTimer--
          if (taskTimer <= 0) {
            task = pickFarmerTask(w, farmRef.current, overlayW, overlayH)
            taskTimer = task.type === 'idle' ? IDLE_TICKS + Math.floor(Math.random() * IDLE_TICKS) : 0
            if (task.type !== 'idle') bubbleTimer = BUBBLE_TICKS
          }
          // Random wander
          turnTimer--
          if (turnTimer <= 0) {
            const angle = Math.random() * Math.PI * 2
            vx = Math.cos(angle) * SPEED
            vy = Math.sin(angle) * SPEED
            turnTimer = 20 + Math.floor(Math.random() * 30)
          }
        }

        // Directed movement
        if (task.type !== 'idle' && task.targetX !== undefined && task.targetY !== undefined) {
          const dx = task.targetX - x
          const dy = task.targetY - y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < ARRIVE_DIST) {
            if (task.type === 'resting') {
              return { ...w, x, y, vx: 0, vy: 0, task, bubbleTimer,
                hidden: true, hiddenTimer: REST_MIN + Math.floor(Math.random() * (REST_MAX - REST_MIN)), waypoints: [] }
            }
            vx = 0; vy = 0
            task = pickFarmerTask(w, farmRef.current, overlayW, overlayH)
            taskTimer = task.type === 'idle' ? IDLE_TICKS + Math.floor(Math.random() * IDLE_TICKS) : 0
            if (task.type !== 'idle') bubbleTimer = BUBBLE_TICKS
          } else {
            vx = (dx / dist) * SPEED
            vy = (dy / dist) * SPEED
          }
        }

        x += vx; y += vy
        if (x < 0) { x = 0; vx = Math.abs(vx) }
        if (x > overlayW - UNIT_SIZE) { x = overlayW - UNIT_SIZE; vx = -Math.abs(vx) }
        if (y < 0) { y = 0; vy = Math.abs(vy) }
        if (y > overlayH - UNIT_SIZE) { y = overlayH - UNIT_SIZE; vy = -Math.abs(vy) }

        return { ...w, x, y, vx, vy, turnTimer, task, taskTimer, bubbleTimer, waypoints }
      }))
    }, 100)
    return () => clearInterval(id)
  }, [])

  // ── Derived data ──────────────────────────────────────────────────────────────

  const catalog    = getCardCatalog()
  const collection = loadCollection()
  const pop        = cityPopulation(city)

  const placedOnFarm: Record<string, number> = {}
  for (const p of farm.plots) {
    if (p) placedOnFarm[p.cardName] = (placedOnFarm[p.cardName] ?? 0) + 1
  }

  const availableForFarm = catalog.filter(c => {
    if (c.cardType !== 'structure') return false
    const isSpawner = c.unit?.structureEffect?.type === 'spawn'
    if (!canPlaceOnFarm(c.name, isSpawner ?? false)) return false
    return (getOwnedCount(collection, c.name) - (placedOnFarm[c.name] ?? 0)) > 0
  })

  const prodRates   = getFarmProductionRate(farm)
  const defense     = farmDefense(farm)
  const nextRaidMs  = Math.max(0, farm.nextRaidAt - currentTime)

  // ── Sub-screens ───────────────────────────────────────────────────────────────

  if (screen === 'picker') {
    return (
      <FarmBuildingPicker
        availableCards={availableForFarm}
        onPick={(card: Card) => {
          const isSpawner = card.unit?.structureEffect?.type === 'spawn'
          if (!canPlaceOnFarm(card.name, isSpawner ?? false)) {
            showToast('Only production buildings may be placed on the farm.')
            setScreen('farm')
            return
          }
          saveFarm(placeFarmBuilding(farm, pickerIndex, { cardName: card.name, rarity: card.rarity, stock: {} }))
          setScreen('farm')
        }}
        onBack={() => setScreen('farm')}
      />
    )
  }

  if (screen === 'chronicle') {
    return (
      <ChroniclePanel
        chronicle={farm.chronicle}
        onBack={() => setScreen('farm')}
      />
    )
  }

  // ── Main farm view ────────────────────────────────────────────────────────────

  return (
    <OverlayScreen title={`🌾 FARM${bulldozer ? ' — DEMOLISH' : ''}`} onBack={onBack}>
      <div className="farm-screen u-col u-gap-2">
        {toast && <div className="city-toast" role="alert">{toast}</div>}

        {raidReport && (
          <FarmRaidModal
            raid={raidReport}
            onClose={() => setRaidReport(null)}
          />
        )}

        <FarmWorkerStrip
          assignedWorkers={farm.workers}
          maxWorkers={farm.maxWorkers}
          nextFarmerCost={nextFarmerCost(farm)}
          cityGold={city.gold}
          onAssign={() => {
            if (farm.workers >= farm.maxWorkers) { showToast('All farmer slots filled — hire more!'); return }
            saveFarm(assignWorker(farm))
          }}
          onUnassign={() => {
            if (farm.workers === 0) return
            saveFarm(unassignWorker(farm))
          }}
          onHireFarmer={() => {
            const cost = nextFarmerCost(farm)
            if (cost === null) { showToast('Maximum farmers reached!'); return }
            if (city.gold < cost) { showToast(`Need ⚙ ${cost.toLocaleString()} gold to hire a farmer.`); return }
            saveFarm(hireFarmer(farm))
            onSaveCity({ ...city, gold: city.gold - cost })
            showToast('New farmer slot hired!')
          }}
        />

        <FarmResourceBar
          resources={farm.resources}
          prodRates={prodRates}
          workers={farm.workers}
          farmDefense={defense}
          nextRaidMs={nextRaidMs}
        />

        <FarmGrid
          farm={farm}
          walkers={walkers}
          bulldozer={bulldozer}
          worldRef={worldRef}
          onCellTap={index => {
            if (farm.plots[index]) {
              if (bulldozer) {
                const { state: next, returnedResources } = removeFarmBuilding(farm, index)
                const hasReturned = Object.values(returnedResources).some(v => (v ?? 0) > 0)
                if (hasReturned) {
                  const newCityRes = { ...city.resources }
                  for (const [res, amt] of Object.entries(returnedResources) as [ResourceType, number][]) {
                    newCityRes[res] = Math.round((newCityRes[res] ?? 0) + (amt ?? 0))
                  }
                  onSaveCity({ ...city, resources: newCityRes })
                }
                saveFarm(next)
                showToast('Building returned to city.')
              } else {
                showToast(`${farm.plots[index]?.cardName} — tap DEMOLISH to remove`)
              }
            } else {
              setPickerIndex(index)
              setScreen('picker')
            }
          }}
          onWalkerClick={(ci) => showToast(`Farmer ${ci + 1} is ${walkers[ci]?.task.label ?? 'busy'}`)}
        />

        <div className="city-header u-flex u-items-c u-just-c u-gap-3">
          <button
            className={`filter-btn${bulldozer ? ' city-bulldozer-btn--active' : ''}`}
            onClick={() => setBulldozer(prev => !prev)}
          >
            {bulldozer ? '🏗 DEMOLISH' : '👷 BUILD'}
          </button>
          <button className="filter-btn" onClick={() => setScreen('chronicle')}>
            📜 HISTORY
          </button>
        </div>

        <div style={{ fontSize: 11, color: '#557755', padding: '4px 8px', textAlign: 'center' }}>
          Farms earn +50% resources but are raided every 3–4 hours with minimal defence.
          Assign more farmers to boost output and defence.
        </div>
      </div>
    </OverlayScreen>
  )
}
