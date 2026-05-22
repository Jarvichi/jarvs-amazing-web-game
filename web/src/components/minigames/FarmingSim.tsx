// ─── Farming Simulation ────────────────────────────────────────────────────────
// Arable land outside the city walls. Mirrors the CityBuilder walker system
// but all walkers are farmers sourced from city population.

import React, { useState, useEffect, useRef } from 'react'
import {
  FarmState, FarmRaidEvent,
  loadFarmState, saveFarmState, tickFarm,
  placeFarmBuilding, removeFarmBuilding,
  assignWorker, unassignWorker,
  hireFarmer, nextFarmerCost,
  getFarmProductionRate, farmDefense,
  canPlaceOnFarm, addFarmChronicle,
  canAffordFarmExpansion, expandFarm,
  buildFarmCity, getFarmNeighbourIndices,
  FARM_COLS, FARM_ROWS, MAX_FARM_SIZE, FARM_EXPANSION_COSTS,
} from '../../game/farmingSim'
import {
  CityState, ResourceType, CELL_PX,
  cityPopulation, getBuildingProduces, getBuildingConsumes,
  levelUpCost,
} from '../../game/cityBuilder'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { getCardCatalog } from '../../game/cards'
import { loadCollection, getOwnedCount, saveCollection, getMasteryXp, masteryLevel, masteryXpForLevel } from '../../game/collection'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Walker, WalkerTask, TaskType, PersonalityTrait } from './citybuilder/walkerTypes'
import { VisualCarrier, computeRoadWaypoints } from './CityBuilder'
import { FarmGrid } from './farming/FarmGrid'
import { FarmWorkerStrip } from './farming/FarmWorkerStrip'
import { FarmRaidModal } from './farming/FarmRaidModal'
import { FarmResourceBar } from './farming/FarmResourceBar'
import { FarmBuildingPicker } from './farming/FarmBuildingPicker'
import { BuildingInspectModal } from './citybuilder/BuildingInspectModal'
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
  // Catch-up tick on mount: advance farm state for offline time, capture resources
  // to ship to city (applied in the mount useEffect below).
  const initCatchUpRef = useRef<Partial<Record<ResourceType, number>>>({})
  const [farm, setFarm]             = useState<FarmState>(() => {
    const { nextState, resourcesForCity } = tickFarm(loadFarmState())
    saveFarmState(nextState)
    initCatchUpRef.current = resourcesForCity
    return nextState
  })
  const [screen, setScreen]         = useState<SubScreen>('farm')
  const [walkers, setWalkers]       = useState<Walker[]>([])
  const [pickerIndex, setPickerIndex] = useState<number>(0)
  const [bulldozer, setBulldozer]   = useState(false)
  const [toast, setToast]           = useState<string | null>(null)
  const [raidReport, setRaidReport] = useState<FarmRaidEvent | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [showExpandModal, setShowExpandModal] = useState(false)

  const [selectedCell, setSelectedCell]   = useState<number | null>(null)
  const [buildingTab, setBuildingTab]     = useState<'residents' | 'upgrade'>('residents')
  const [visualCarriers, setVisualCarriers] = useState<VisualCarrier[]>([])

  const farmRef    = useRef(farm)
  const walkersRef = useRef(walkers)
  const worldRef   = useRef<HTMLDivElement>(null)
  const worldDims  = useRef({ w: FARM_COLS * CELL_PX, h: FARM_ROWS * CELL_PX })
  const visualCarriersRef   = useRef<VisualCarrier[]>([])
  const carrierSeedTickRef  = useRef(0)
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

  // Ship any resources produced during the offline catch-up tick to the city
  useEffect(() => {
    const rfc = initCatchUpRef.current
    if (!rfc || !Object.values(rfc).some(v => (v ?? 0) > 0)) return
    initCatchUpRef.current = {}
    const newCityRes = { ...city.resources }
    for (const [res, amt] of Object.entries(rfc) as [ResourceType, number][]) {
      newCityRes[res] = Math.round((newCityRes[res] ?? 0) + amt)
    }
    onSaveCity({ ...city, resources: newCityRes })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Clock for raid countdown — 1 s for accurate countdown display
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), 1_000)
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

      const farmRows = farmRef.current.rows ?? FARM_ROWS
      const farmCols = farmRef.current.cols ?? FARM_COLS

      // Helper: compute road waypoints scaled to farm grid
      function farmWaypoints(fx: number, fy: number, tx: number, ty: number) {
        const wps = computeRoadWaypoints(fx, fy, tx, ty, overlayW, overlayH, farmRows, { h: [], v: [] }, farmCols)
        return wps.length > 0 ? wps : [{ x: tx, y: ty }]
      }

      setWalkers(prev => prev.map(w => {
        let { x, y, vx, vy, turnTimer, task, taskTimer, bubbleTimer, waypoints } = w
        waypoints = waypoints ?? []
        bubbleTimer = Math.max(0, bubbleTimer - 1)

        // Resting (hidden)
        if (w.hidden) {
          const t = w.hiddenTimer - 1
          if (t <= 0) {
            const newTask = pickFarmerTask(w, farmRef.current, overlayW, overlayH)
            const wps = newTask.targetX !== undefined
              ? farmWaypoints(x, y, newTask.targetX!, newTask.targetY!)
              : []
            return { ...w, hidden: false, hiddenTimer: 0, task: newTask,
              taskTimer: newTask.type === 'idle' ? IDLE_TICKS + Math.floor(Math.random() * IDLE_TICKS) : 0,
              bubbleTimer: newTask.type !== 'idle' ? BUBBLE_TICKS : 0, waypoints: wps }
          }
          return { ...w, hiddenTimer: t }
        }

        // Idle countdown
        if (task.type === 'idle') {
          taskTimer--
          if (taskTimer <= 0) {
            task = pickFarmerTask(w, farmRef.current, overlayW, overlayH)
            taskTimer = task.type === 'idle' ? IDLE_TICKS + Math.floor(Math.random() * IDLE_TICKS) : 0
            if (task.type !== 'idle') {
              bubbleTimer = BUBBLE_TICKS
              waypoints = task.targetX !== undefined
                ? farmWaypoints(x, y, task.targetX!, task.targetY!)
                : []
            }
          }
          // Grid-following idle wander via road paths
          if (task.type === 'idle') {
            if (waypoints.length > 0) {
              const nx = waypoints[0].x, ny = waypoints[0].y
              const dx = nx - x, dy = ny - y
              const dist = Math.sqrt(dx * dx + dy * dy)
              if (dist < ARRIVE_DIST) { waypoints = waypoints.slice(1); turnTimer = 0 }
              else { vx = dx / dist * SPEED; vy = dy / dist * SPEED }
            }
            if (waypoints.length === 0) {
              turnTimer--
              if (turnTimer <= 0) {
                const cc = Math.max(0, Math.min(farmRows - 1, Math.floor(y / (overlayH / farmRows)))) * farmCols
                         + Math.max(0, Math.min(farmCols - 1, Math.floor(x / (overlayW / farmCols))))
                const ns = getFarmNeighbourIndices(cc, farmRows, farmCols)
                const pick = ns[Math.floor(Math.random() * ns.length)] ?? cc
                const tx = (pick % farmCols + 0.5) * overlayW / farmCols
                const ty = (Math.floor(pick / farmCols) + 0.5) * overlayH / farmRows
                waypoints = farmWaypoints(x, y, tx, ty)
                turnTimer = 20 + Math.floor(Math.random() * 30)
              }
            }
          }
        }

        // Directed movement via waypoints
        if (task.type !== 'idle') {
          const dest = waypoints.length > 0 ? waypoints[0]
            : task.targetX !== undefined ? { x: task.targetX!, y: task.targetY! } : null
          if (dest) {
            const dx = dest.x - x, dy = dest.y - y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < ARRIVE_DIST) {
              if (waypoints.length > 0) {
                waypoints = waypoints.slice(1)
                if (waypoints.length > 0) {
                  const next = waypoints[0]
                  const nd = Math.sqrt((next.x - x) ** 2 + (next.y - y) ** 2) || 1
                  vx = (next.x - x) / nd * SPEED; vy = (next.y - y) / nd * SPEED
                }
              }
              // Arrived at final destination (no waypoints left)
              if (waypoints.length === 0) {
                if (task.type === 'resting') {
                  return { ...w, x, y, vx: 0, vy: 0, task, bubbleTimer,
                    hidden: true, hiddenTimer: REST_MIN + Math.floor(Math.random() * (REST_MAX - REST_MIN)), waypoints: [] }
                }
                vx = 0; vy = 0
                task = pickFarmerTask(w, farmRef.current, overlayW, overlayH)
                taskTimer = task.type === 'idle' ? IDLE_TICKS + Math.floor(Math.random() * IDLE_TICKS) : 0
                if (task.type !== 'idle') {
                  bubbleTimer = BUBBLE_TICKS
                  waypoints = task.targetX !== undefined
                    ? farmWaypoints(x, y, task.targetX!, task.targetY!)
                    : []
                }
              }
            } else {
              vx = dx / dist * SPEED; vy = dy / dist * SPEED
            }
          }
        }

        x += vx; y += vy
        if (x < 0) { x = 0; vx = Math.abs(vx) }
        if (x > overlayW - UNIT_SIZE) { x = overlayW - UNIT_SIZE; vx = -Math.abs(vx) }
        if (y < 0) { y = 0; vy = Math.abs(vy) }
        if (y > overlayH - UNIT_SIZE) { y = overlayH - UNIT_SIZE; vy = -Math.abs(vy) }

        return { ...w, x, y, vx, vy, turnTimer, task, taskTimer, bubbleTimer, waypoints }
      }))

      // ── Farm carrier animation ─────────────────────────────────────────────────
      const farmCurr  = farmRef.current
      const farmRows2 = farmCurr.rows ?? FARM_ROWS
      const farmCols2 = farmCurr.cols ?? FARM_COLS

      // Every ~5s: clean up stale carriers and seed new producer→consumer ones
      carrierSeedTickRef.current = (carrierSeedTickRef.current + 1) % 50
      if (carrierSeedTickRef.current === 0) {
        // Build set of valid carrier ids from current farm layout
        const validIds = new Set<string>()
        for (let i = 0; i < farmCurr.plots.length; i++) {
          const plot = farmCurr.plots[i]
          if (!plot) continue
          const produces = getBuildingProduces(plot.cardName)
          for (const [res, rate] of Object.entries(produces) as [ResourceType, number][]) {
            if (!(rate > 0)) continue
            for (let j = 0; j < farmCurr.plots.length; j++) {
              if (i === j) continue
              const other = farmCurr.plots[j]
              if (!other) continue
              if (!((getBuildingConsumes(other.cardName)[res as ResourceType] ?? 0) > 0)) continue
              validIds.add(`fc-${i}-${j}-${res}`)
              break
            }
          }
        }
        // Remove stale carriers and seed missing ones
        const kept = visualCarriersRef.current.filter(vc => !vc.id.startsWith('fc-') || validIds.has(vc.id))
        const existingIds = new Set(kept.map(vc => vc.id))
        const toAdd: VisualCarrier[] = []
        for (const id of validIds) {
          if (existingIds.has(id)) continue
          const parts = id.split('-')
          const fromIdx = parseInt(parts[1]), toIdx = parseInt(parts[2])
          const res = parts[3] as ResourceType
          const c1 = fromIdx % farmCols2, r1 = Math.floor(fromIdx / farmCols2)
          const c2 = toIdx % farmCols2, r2 = Math.floor(toIdx / farmCols2)
          const pickX = (c1 + 0.5) * overlayW / farmCols2
          const pickY = (r1 + 0.5) * overlayH / farmRows2
          const dropX = (c2 + 0.5) * overlayW / farmCols2
          const dropY = (r2 + 0.5) * overlayH / farmRows2
          const wps = farmWaypoints(dropX, dropY, pickX, pickY)
          const first = wps.length > 0 ? wps[0] : { x: pickX, y: pickY }
          const dd = Math.sqrt((first.x - dropX) ** 2 + (first.y - dropY) ** 2)
          toAdd.push({
            id, carrying: { [res]: 1 },
            x: dropX, y: dropY,
            vx: dd > 0 ? (first.x - dropX) / dd * SPEED : 0,
            vy: dd > 0 ? (first.y - dropY) / dd * SPEED : 0,
            waypoints: wps, scale: 0, phase: 'outbound',
            pickX, pickY, dropX, dropY,
          })
        }
        visualCarriersRef.current = [...kept, ...toAdd]
      }

      // Move carriers — mirrors city carrier animation (waypoint-following, not straight-line)
      const movedCarriers = visualCarriersRef.current.map(vc => {
        const phaseDestX = vc.phase === 'outbound' ? vc.pickX : vc.dropX
        const phaseDestY = vc.phase === 'outbound' ? vc.pickY : vc.dropY
        const target = vc.waypoints.length > 0 ? vc.waypoints[0] : { x: phaseDestX, y: phaseDestY }
        let { x, y, vx, vy } = vc
        let waypoints = vc.waypoints
        let scale = vc.scale
        let phase = vc.phase

        // Scale up before moving (same as city — stay in place while growing)
        if (scale < 1 && !(waypoints.length === 0 && Math.sqrt((target.x - x) ** 2 + (target.y - y) ** 2) < ARRIVE_DIST)) {
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
          // Arrived at producer — compute return waypoints and switch phase
          const wps = farmWaypoints(x, y, vc.dropX, vc.dropY)
          const first = wps.length > 0 ? wps[0] : { x: vc.dropX, y: vc.dropY }
          const nd = Math.sqrt((first.x - x) ** 2 + (first.y - y) ** 2)
          phase = 'returning'
          waypoints = wps
          if (nd > 0) { vx = (first.x - x) / nd * SPEED; vy = (first.y - y) / nd * SPEED }
        } else if (dist < ARRIVE_DIST && phase === 'returning') {
          // Arrived at consumer — shrink into building, then restart loop
          vx = 0; vy = 0
          scale = Math.max(0, scale - 0.1)
          if (scale <= 0) {
            const wps = farmWaypoints(vc.dropX, vc.dropY, vc.pickX, vc.pickY)
            const first = wps.length > 0 ? wps[0] : { x: vc.pickX, y: vc.pickY }
            const dd = Math.sqrt((first.x - vc.dropX) ** 2 + (first.y - vc.dropY) ** 2)
            return {
              ...vc,
              x: vc.dropX, y: vc.dropY,
              vx: dd > 0 ? (first.x - vc.dropX) / dd * SPEED : 0,
              vy: dd > 0 ? (first.y - vc.dropY) / dd * SPEED : 0,
              waypoints: wps, scale: 0, phase: 'outbound' as const,
            }
          }
        } else if (dist > 0) {
          vx = dx / dist * SPEED; vy = dy / dist * SPEED
        }

        x += vx; y += vy
        return { ...vc, x, y, vx, vy, waypoints, scale, phase }
      })
      visualCarriersRef.current = movedCarriers
      setVisualCarriers([...movedCarriers])
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
          resources={city.resources}
          prodRates={prodRates}
          workers={farm.workers}
          farmDefense={defense}
          nextRaidMs={nextRaidMs}
        />

        <FarmGrid
          farm={farm}
          walkers={walkers}
          visualCarriers={visualCarriers}
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
                setSelectedCell(index)
                setBuildingTab('residents')
              }
            } else {
              setPickerIndex(index)
              setScreen('picker')
            }
          }}
          onWalkerClick={(ci) => showToast(`Farmer ${ci + 1} is ${walkers[ci]?.task.label ?? 'busy'}`)}
        />

        {selectedCell !== null && (() => {
          const plot = farm.plots[selectedCell]
          if (!plot) return null
          const farmCity = buildFarmCity(farm)
          const cell = farmCity.grid[selectedCell]
          if (!cell) return null
          return (
            <BuildingInspectModal
              cellIndex={selectedCell}
              cell={cell}
              city={{ ...farmCity, gold: city.gold }}
              collection={collection}
              walkers={walkers}
              buildingTab={buildingTab}
              setBuildingTab={setBuildingTab}
              productionMultiplier={1.5}
              productionNote="🌾 +50% farm bonus included"
              onClose={() => setSelectedCell(null)}
              onLevelUp={cardName => {
                const col = loadCollection()
                const currentXp = getMasteryXp(col, cardName)
                const currentLvl = masteryLevel(currentXp)
                const cost = levelUpCost(currentLvl, cardName)
                if (city.gold < cost) { showToast('Not enough gold!'); return }
                onSaveCity({ ...city, gold: city.gold - cost })
                const xpToGrant = masteryXpForLevel(currentLvl + 1) - currentXp
                const updated = col.map(e =>
                  e.cardName === cardName ? { ...e, masteryXp: (e.masteryXp ?? 0) + xpToGrant } : e
                )
                if (!updated.find(e => e.cardName === cardName))
                  updated.push({ cardName, count: 0, masteryXp: xpToGrant })
                saveCollection(updated)
                showToast(`${cardName} levelled up! Mastery ★${currentLvl + 1}`)
                setBuildingTab('upgrade')
              }}
              onMoveIn={() => {}}
            />
          )
        })()}

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
          <button
            className={`filter-btn city-expand-btn${canAffordFarmExpansion(farm, city.gold, city.resources) ? ' city-expand-btn--ready' : ''}`}
            onClick={() => setShowExpandModal(true)}
            title="View farm expansion levels"
          >
            🌱 EXPAND
          </button>
        </div>

        {showExpandModal && (
          <ModalBackdrop onClose={() => setShowExpandModal(false)}>
            <div className="city-info-modal">
              <div className="city-info-modal-title">🌱 FARM EXPANSION</div>
              <div className="city-info-modal-body">
                {([4, 5, 6, 7, 8] as const).map(size => {
                  const lvl = size - FARM_ROWS + 1
                  const cost = FARM_EXPANSION_COSTS[size as 4|5|6|7]
                  const isCurrent = (farm.rows ?? FARM_ROWS) === size
                  const isCompleted = (farm.rows ?? FARM_ROWS) > size
                  return (
                    <div key={size} className={`city-expand-row${isCurrent ? ' city-expand-row--current' : ''}${isCompleted ? ' city-expand-row--done' : ''}`}>
                      <span className="city-expand-lvl">LVL {lvl} — {size}×{size}</span>
                      {isCompleted && <span className="city-expand-status">✓ Unlocked</span>}
                      {isCurrent && size < MAX_FARM_SIZE && cost && (
                        <span className="city-expand-cost">
                          ⚙ {cost.gold.toLocaleString()}
                          {Object.entries(cost.resources).map(([r, v]) => ` · ${v?.toLocaleString()} ${r}`).join('')}
                        </span>
                      )}
                      {isCurrent && size >= MAX_FARM_SIZE && <span className="city-expand-status">MAX SIZE</span>}
                    </div>
                  )
                })}
              </div>
              <div className="u-flex u-gap-3 u-just-c">
                {(farm.rows ?? FARM_ROWS) < MAX_FARM_SIZE && (() => {
                  const affordable = canAffordFarmExpansion(farm, city.gold, city.resources)
                  const cost = FARM_EXPANSION_COSTS[farm.rows ?? FARM_ROWS]
                  return (
                    <button
                      className={`action-btn${affordable ? ' action-btn--gold' : ''}`}
                      disabled={!affordable}
                      onClick={() => {
                        if (!affordable || !cost) return
                        const newCityRes = { ...city.resources }
                        for (const [res, amt] of Object.entries(cost.resources) as [ResourceType, number][]) {
                          newCityRes[res] = Math.max(0, (newCityRes[res] ?? 0) - amt)
                        }
                        onSaveCity({ ...city, gold: city.gold - cost.gold, resources: newCityRes })
                        const next = expandFarm(farm)
                        saveFarm(next)
                        setShowExpandModal(false)
                        showToast(`Farm expanded to ${next.rows}×${next.cols}!`)
                      }}
                    >
                      {affordable ? '🌱 EXPAND NOW' : '🔒 NEED RESOURCES'}
                    </button>
                  )
                })()}
                <button className="action-btn" onClick={() => setShowExpandModal(false)}>CLOSE</button>
              </div>
            </div>
          </ModalBackdrop>
        )}

        <div style={{ fontSize: 11, color: '#557755', padding: '4px 8px', textAlign: 'center' }}>
          Farms earn +50% resources but are raided every 3–4 hours with minimal defence.
          Assign more farmers to boost output and defence.
        </div>
      </div>
    </OverlayScreen>
  )
}
