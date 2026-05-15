// ─── Tower Defence ─────────────────────────────────────────────────────────────
// Wave-based tower defence. Portrait-first layout:
//   [header]  lives · wave · score · start/quit
//   [board]   scrollable grid (fills remaining height)
//   [panel]   horizontal unit strip + log line

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { UnitTemplate } from '../../game/types'
import { SpriteImg, AnimatedSpriteImg } from '../BuildingBlocks/SpriteImg'
import {
  TD_COLS, TD_ROWS, TD_PATH, TD_TOTAL_WAVES, TD_MAX_LIVES, TD_CELL_PX, TD_MAX_UPGRADES, TD_MILESTONE_EVERY,
  TDGameState, TDTower, TDUnit, TDEnemy, TDAttackEvent, TDHazard, MilestoneUpgrade,
  isPathCell,
  createTDGame, placeTower, removeTower, moveTower, upgradeTower, startWave, tickTD,
  calcTicketReward, calcGoldReward, towerCost, upgradeCost, buildingUnitCount, chooseMilestoneUpgrade,
} from '../../game/towerDefence'
import { Lives } from '../BuildingBlocks/Lives/Lives'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TowerPool {
  template: UnitTemplate
  total: number
  buildingName: string
}

interface Props {
  pool: TowerPool[]
  mode: 'collection' | 'city'
  onDone: (score: number) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CELL_PX = TD_CELL_PX   // single source of truth from game logic
const TICK_MS = 100           // game-logic rate; CSS transition interpolates visuals between steps

// ── Helpers ───────────────────────────────────────────────────────────────────

function hpBarColor(frac: number): string {
  if (frac > 0.6) return '#4caf50'
  if (frac > 0.3) return '#ff9800'
  return '#f44336'
}

const PATH_CELL_SET = new Set(TD_PATH.map(p => `${p.col},${p.row}`))
function isOnPath(col: number, row: number): boolean {
  return PATH_CELL_SET.has(`${col},${row}`)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TowerDefence({ pool, mode, onDone }: Props) {
  const initialPlacements: Record<string, number> = {}
  for (const entry of pool) initialPlacements[entry.template.name] = entry.total

  const [game, setGame] = useState<TDGameState>(() =>
    createTDGame(pool.map(p => p.template), mode, initialPlacements)
  )
  const [selected, setSelected] = useState<UnitTemplate | null>(null)
  const [hoveredTower, setHoveredTower] = useState<TDTower | null>(null)
  const [selectedTowerId, setSelectedTowerId] = useState<number | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ col: number; row: number } | null>(null)
  const [gridScale, setGridScale] = useState(1)

  // Always derived from game state so it stays in sync after upgrades/moves
  const selectedTower = selectedTowerId !== null
    ? game.towers.find(t => t.id === selectedTowerId) ?? null
    : null

  const gameRef = useRef(game)
  gameRef.current = game

  const boardWrapRef = useRef<HTMLDivElement>(null)
  const rafRef       = useRef<number | null>(null)
  const lastTimeRef  = useRef<number | null>(null)
  const accRef       = useRef(0)

  // ── Game loop ───────────────────────────────────────────────────────────────

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp
    // Cap dt to 200ms to avoid spiral-of-death after a long pause
    const dt = Math.min(timestamp - lastTimeRef.current, 200)
    lastTimeRef.current = timestamp
    accRef.current += dt

    const numTicks = Math.floor(accRef.current / TICK_MS)
    if (numTicks > 0) {
      accRef.current -= numTicks * TICK_MS
      // Single state update per frame — React only re-renders once regardless of tick count
      setGame(prev => {
        if (prev.phase === 'prep' || prev.phase === 'milestone' || prev.phase === 'victory' || prev.phase === 'defeat') return prev
        let s = prev
        for (let i = 0; i < numTicks; i++) s = tickTD(s, TICK_MS)
        return s
      })
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [tick])

  // ── Grid scaling ────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = boardWrapRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        const factor = Math.min(1, w / (TD_COLS * CELL_PX))
        setGridScale(factor)
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Interactions ────────────────────────────────────────────────────────────

  function handleCellClick(col: number, row: number) {
    const g = gameRef.current
    if (g.phase === 'victory' || g.phase === 'defeat') return

    const towerAtCell = g.towers.find(t => t.col === col && t.row === row)

    // A tower is selected in move-mode: clicking an empty valid cell moves it
    if (selectedTowerId !== null && !towerAtCell && !isOnPath(col, row)) {
      const next = moveTower(g, selectedTowerId, col, row)
      if (next) { setGame(next); setSelectedTowerId(null) }
      return
    }

    // Clicking a tower: select/deselect
    if (towerAtCell) {
      if (selectedTowerId === towerAtCell.id) {
        setSelectedTowerId(null)
      } else {
        setSelectedTowerId(towerAtCell.id)
        setSelected(null)
      }
      return
    }

    // No tower selected, no tower at cell: place if a unit chip is chosen
    if (!selected || isOnPath(col, row)) return
    if (g.phase !== 'prep' && g.phase !== 'between' && g.phase !== 'wave' && g.phase !== 'milestone') return
    const entry = pool.find(p => p.template.name === selected.name)
    if (!entry) return
    const next = placeTower(g, selected, entry.buildingName, col, row)
    if (next) setGame(next)
  }

  function handleSellTower(tower: TDTower) {
    setGame(prev => removeTower(prev, tower.id))
    setSelectedTowerId(null)
    setHoveredTower(null)
  }

  function handleUpgradeTower(tower: TDTower) {
    setGame(prev => upgradeTower(prev, tower.id) ?? prev)
  }

  function handleStartWave() { setGame(prev => startWave(prev)) }
  function handleChooseMilestone(id: string) { setGame(prev => chooseMilestoneUpgrade(prev, id)) }

  function handleSelectUnit(template: UnitTemplate) {
    setSelected(prev => prev?.name === template.name ? null : template)
    setSelectedTowerId(null)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const isPlacingPhase  = game.phase === 'prep' || game.phase === 'between' || game.phase === 'milestone'
  const canPlaceTowers  = isPlacingPhase || game.phase === 'wave'
  const reward = mode === 'city' ? calcGoldReward(game.wavesCompleted) : calcTicketReward(game.wavesCompleted)
  const rewardLabel = mode === 'city'
    ? `${reward.toLocaleString()} 🪙 city gold`
    : `${reward} 🎫 tickets`

  // Wave progress (0..1): proportion of enemies that have been spawned
  const waveProgress = game.waveSpawnTotal > 0
    ? (game.waveSpawnTotal - game.spawnQueue.length) / game.waveSpawnTotal
    : 0

  // Cells to highlight for range preview — based on unit stationed position (path cell)
  const rangeHighlight = useMemo<Set<string>>(() => {
    const cells = new Set<string>()
    const refTower = selectedTower ?? hoveredTower
    if (refTower) {
      // Effective range = attack range + how far the unit can roam (1.5 cells) from the building
      const rangeInCells = Math.max(1.5, Math.round(refTower.template.attackRange / CELL_PX)) + 1.5
      const ox = refTower.col, oy = refTower.row
      for (let r = 0; r < TD_ROWS; r++) {
        for (let c = 0; c < TD_COLS; c++) {
          if (Math.sqrt((c - ox) ** 2 + (r - oy) ** 2) <= rangeInCells) cells.add(`${c},${r}`)
        }
      }
      return cells
    }
    if (selected && hoveredCell) {
      const rangeInCells = Math.max(1, Math.round(selected.attackRange / CELL_PX)) + 1.5
      for (let r = 0; r < TD_ROWS; r++) {
        for (let c = 0; c < TD_COLS; c++) {
          if (Math.sqrt((c - hoveredCell.col) ** 2 + (r - hoveredCell.row) ** 2) <= rangeInCells) {
            cells.add(`${c},${r}`)
          }
        }
      }
    }
    return cells
  }, [selectedTower, hoveredTower, selected, hoveredCell, game.units])

  // ── End screen ──────────────────────────────────────────────────────────────

  if (game.phase === 'victory' || game.phase === 'defeat') {
    const won = game.phase === 'victory'
    return (
      <div className="td-end-screen">
        <div className={`td-end-title ${won ? 'td-end-title--win' : 'td-end-title--lose'}`}>
          {won ? '⚔ VICTORY!' : '💀 DEFEATED'}
        </div>
        <div className="td-end-stat">Waves cleared: {game.wavesCompleted} / {TD_TOTAL_WAVES}</div>
        <div className="td-end-stat">Score: {game.score.toLocaleString()}</div>
        <div className="td-end-reward">Reward: {rewardLabel}</div>
        <button className="action-btn action-btn--gold" onClick={() => onDone(reward)}>
          COLLECT &amp; EXIT
        </button>
      </div>
    )
  }

  // ── Main layout ─────────────────────────────────────────────────────────────

  const lastLog = game.log[game.log.length - 1] ?? ''

  return (
    <div className="td-root">

      {/* ── Header ── */}
      <div className="td-header">
        <div className="td-header-lives">
          <Lives maxLives={TD_MAX_LIVES} currentLives={game.lives} />
        </div>

        <div className="td-header-wave">
          Wave {game.wavesCompleted + 1}/{TD_TOTAL_WAVES}
                  {game.phase === 'wave' && (
          <div className="td-wave-progress-wrap">
            <div className="td-wave-progress-fill" style={{ width: `${waveProgress * 100}%` }} />
            <span className="td-wave-progress-label">⚔ {Math.round(waveProgress * 100)}%</span>
          </div>
        )}
                {game.phase === 'between' && (
                  <div className="td-wave-progress-wrap">
          <span className="td-header-active">⏳ Next wave…</span></div>
        )}
        {game.phase === 'milestone' && (
          <div className="td-wave-progress-wrap">
          <span className="td-header-milestone">
            🎉 {game.wavesCompleted}/{TD_TOTAL_WAVES} — Reorganise!
          </span></div>
        )}
        </div>

        <div className="td-header-score">⭐ {game.score}</div>
        <div className="td-header-mana">💧 {game.mana}</div>

        {isPlacingPhase && !game.milestoneChoices && (
          <button className="action-btn action-btn--gold td-header-btn" onClick={handleStartWave}>
            ▶ START
          </button>
        )}


        <button className="action-btn action-btn--danger td-header-btn" onClick={() => onDone(reward)}>
          ✕
        </button>
      </div>

      {/* ── Milestone reward choices ── */}
      {game.milestoneChoices && (
        <div className="td-milestone-choices">
          <div className="td-milestone-choices-title">Choose your reward</div>
          <div className="td-milestone-choices-cards">
            {game.milestoneChoices.map((choice: MilestoneUpgrade) => (
              <button key={choice.id} className="td-milestone-choice-card" onClick={() => handleChooseMilestone(choice.id)}>
                <div className="td-milestone-choice-label">{choice.label}</div>
                <div className="td-milestone-choice-desc">{choice.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Board (scrollable) ── */}
      <div className="td-board-wrap" ref={boardWrapRef}>
        <div
          className="td-grid-scaler"
          style={{
            width: TD_COLS * CELL_PX * gridScale,
            height: TD_ROWS * CELL_PX * gridScale,
          }}
        >
        <div
          className="td-grid"
          style={{
            width: TD_COLS * CELL_PX,
            height: TD_ROWS * CELL_PX,
            transform: `scale(${gridScale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Cells */}
          {Array.from({ length: TD_ROWS }, (_, row) =>
            Array.from({ length: TD_COLS }, (_, col) => {
              const onPath    = isOnPath(col, row)
              const isStart   = col === TD_PATH[0].col && row === TD_PATH[0].row
              const isEnd     = col === TD_PATH[TD_PATH.length - 1].col && row === TD_PATH[TD_PATH.length - 1].row
              const tower     = game.towers.find(t => t.col === col && t.row === row)
              const isTowerSelected = tower?.id === selectedTowerId
              // canDrop: valid placement cell, or valid move destination for selected tower
              const canDrop   = !onPath && !tower && (
                (selected && canPlaceTowers) ||
                (selectedTowerId !== null)
              )
              const inRange   = rangeHighlight.has(`${col},${row}`)

              return (
                <div
                  key={`${col},${row}`}
                  className={[
                    'td-cell',
                    onPath          ? 'td-cell--path'     : 'td-cell--grass',
                    isStart         ? 'td-cell--start'    : '',
                    isEnd           ? 'td-cell--end'      : '',
                    canDrop         ? 'td-cell--droppable' : '',
                    tower           ? 'td-cell--occupied' : '',
                    inRange         ? 'td-cell--in-range' : '',
                    isTowerSelected ? 'td-cell--tower-selected' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ left: col * CELL_PX, top: row * CELL_PX, width: CELL_PX, height: CELL_PX }}
                  onClick={() => handleCellClick(col, row)}
                  onMouseEnter={() => {
                    if (tower) setHoveredTower(tower)
                    setHoveredCell({ col, row })
                  }}
                  onMouseLeave={() => {
                    setHoveredTower(null)
                    setHoveredCell(null)
                  }}
                >
                  {isStart && <span className="td-cell-label">IN</span>}
                  {isEnd   && <span className="td-cell-label">BASE</span>}
                  {tower && (
                    <div className="td-tower-inner">
                      <SpriteImg name={tower.buildingName} />
                      {tower.upgrades > 0 && (
                        <div className="td-tower-tier">{'★'.repeat(tower.upgrades)}</div>
                      )}
                      {tower.respawnTimers.length > 0 && (
                        <div className="td-tower-respawn">⏳</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* Player units — grouped per building, one cell per group */}
          {Array.from(
            game.units.reduce((map, u) => {
              const g = map.get(u.towerId) ?? []
              g.push(u)
              map.set(u.towerId, g)
              return map
            }, new Map<number, TDUnit[]>())
          ).map(([towerId, units]) => (
            <UnitGroupToken key={towerId} units={units} />
          ))}

          {/* Enemies */}
          {game.enemies.map(enemy => (
            <EnemyToken key={enemy.id} enemy={enemy} />
          ))}

          {/* Gas cloud hazards */}
          {game.hazards.map(h => (
            <HazardCloud key={h.id} hazard={h} />
          ))}

          {/* Attack effects */}
          {game.attackEvents.map(ev => (
            <AttackEffect key={ev.id} ev={ev} />
          ))}

          {/* Building tooltip */}
          {(selectedTower || hoveredTower) && (() => {
            const t = selectedTower ?? hoveredTower!
            const unitCount = buildingUnitCount(t)
            const activeUnits = game.units.filter(u => u.towerId === t.id)
            return (
              <div
                className="td-tower-tooltip"
                style={{ left: t.col * CELL_PX, top: Math.max(0, t.row * CELL_PX - 56) }}
              >
                <strong>{t.buildingName}</strong>
                {t.upgrades > 0 && <span className="td-tower-tier-label"> {'★'.repeat(t.upgrades)}</span>}
                <div>{t.template.name} · {activeUnits.length}/{unitCount} active</div>
                {t.id !== selectedTowerId && <div className="td-tooltip-hint">Tap to select</div>}
              </div>
            )
          })()}
        </div>
        </div>{/* td-grid-scaler */}
      </div>

      {/* ── Selected tower action panel ── */}
      {selectedTower && (() => {
        const t = selectedTower
        const sellRefund = Math.floor(towerCost(t.template) * 0.5)
        const upCost = upgradeCost(t)
        const canAffordUp = game.mana >= upCost
        const unitCount = buildingUnitCount(t)
        const activeUnits = game.units.filter(u => u.towerId === t.id)
        return (
          <div className="td-selected-panel">
            <div className="td-selected-panel-info">
              <strong>{t.buildingName}</strong>
              {t.upgrades > 0 && <span className="td-tower-tier-label"> {'★'.repeat(t.upgrades)}</span>}
              <span className="td-selected-panel-stats"> · {t.template.name} · {activeUnits.length}/{unitCount} units</span>
            </div>
            <div className="td-selected-panel-actions">
              <button className="td-selected-action-btn td-selected-action-btn--sell"
                onClick={() => handleSellTower(t)}>
                SELL +💧{sellRefund}
              </button>
              {t.upgrades < TD_MAX_UPGRADES ? (
                <button
                  className={`td-selected-action-btn td-selected-action-btn--upgrade${canAffordUp ? '' : ' td-selected-action-btn--disabled'}`}
                  onClick={() => canAffordUp && handleUpgradeTower(t)}>
                  ★ UPGRADE (+1 unit) 💧{upCost}
                </button>
              ) : (
                <span className="td-selected-panel-maxed">★★ MAX ({unitCount} units)</span>
              )}
              <button className="td-selected-action-btn td-selected-action-btn--cancel"
                onClick={() => setSelectedTowerId(null)}>
                ✕
              </button>
            </div>
            <div className="td-selected-panel-hint">Tap an empty cell on the grid to move this building</div>
          </div>
        )
      })()}

      {/* ── Bottom panel ── */}
      <div className="td-panel">
        {/* Log line */}
        <div className="td-panel-log">{lastLog}</div>

        {/* Hint */}
        {canPlaceTowers && !selectedTower && (
          <div className="td-panel-hint">
            {selected
              ? `Placing ${pool.find(p => p.template.name === selected.name)?.buildingName ?? selected.name} (💧${towerCost(selected)}) — tap a green cell`
              : 'Tap a building below to select, then tap the grid'}
          </div>
        )}

        {/* Unit strip */}
        <div className="td-unit-strip">
          {pool.map(({ template, buildingName }) => {
            const remaining = game.remainingPlacements[template.name] ?? 0
            const cost      = towerCost(template)
            const isSel     = selected?.name === template.name
            const cantAfford = game.mana < cost
            const disabled  = !canPlaceTowers || remaining === 0 || cantAfford
            return (
              <button
                key={template.name}
                className={[
                  'td-unit-chip',
                  isSel    ? 'td-unit-chip--selected' : '',
                  disabled ? 'td-unit-chip--disabled'  : '',
                ].filter(Boolean).join(' ')}
                onClick={() => !disabled && handleSelectUnit(template)}
                title={`${buildingName} — spawns ${template.name}, ATK ${template.attack}, HP ${template.maxHp}, Cost ${cost} mana`}
              >
                <div className="td-unit-chip-sprite">
                  <SpriteImg name={buildingName} />
                </div>
                <div className="td-unit-chip-name">{buildingName}</div>
                <span className={`td-unit-chip-count ${remaining === 0 ? 'td-unit-chip-count--zero' : ''}`}>
                  ×{remaining}
                </span>
                <span className={`td-unit-chip-cost ${cantAfford ? 'td-unit-chip-cost--unaffordable' : ''}`}>
                  💧{cost}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Player unit group token (all units from same building move as one) ────────

function UnitGroupToken({ units }: { units: TDUnit[] }) {
  const lead = units[0]
  const stationed = units.some(u => u.stationed)
  const minHpFrac = Math.min(...units.map(u => u.hp / u.maxHp))
  const n = units.length
  const sz = 15, gap = 3

  let slots: Array<{ dx: number; dy: number }>
  let containerW: number, containerH: number

  if (n >= 3) {
    containerW = sz * 2 + gap; containerH = sz * 2 + gap
    slots = [
      { dx: (containerW - sz) / 2, dy: 0 },
      { dx: 0, dy: sz + gap },
      { dx: sz + gap, dy: sz + gap },
    ]
  } else if (n === 2) {
    containerW = sz * 2 + gap; containerH = sz
    slots = [{ dx: 0, dy: 0 }, { dx: sz + gap, dy: 0 }]
  } else {
    containerW = sz; containerH = sz
    slots = [{ dx: 0, dy: 0 }]
  }

  return (
    <div
      className={`td-unit${stationed ? ' td-unit--stationed' : ' td-unit--walking'}`}
      style={{ transform: `translate(${lead.x - containerW / 2}px, ${lead.y - containerH / 2}px)`, width: containerW }}
    >
      <div style={{ position: 'relative', width: containerW, height: containerH }}>
        {slots.map((slot, i) => (
          <div key={i} style={{ position: 'absolute', left: slot.dx, top: slot.dy, width: sz, height: sz }}>
            <AnimatedSpriteImg name={units[i].template.name} frameCount={3} fps={stationed ? 4 : 8} className="td-unit-sprite" />
          </div>
        ))}
      </div>
      <div className="td-enemy-hp-bar">
        <div className="td-enemy-hp-fill" style={{ width: `${minHpFrac * 100}%`, background: hpBarColor(minHpFrac) }} />
      </div>
    </div>
  )
}

// ── Enemy token ───────────────────────────────────────────────────────────────

function EnemyToken({ enemy }: { enemy: TDEnemy }) {
  const size = 15
  const hpFrac = enemy.hp / enemy.maxHp
  const cls = [
    'td-enemy',
    enemy.shielded                                            ? 'td-enemy--shielded' : '',
    enemy.slowsUnits                                          ? 'td-enemy--slows'    : '',
    enemy.burnTimer   != null && enemy.burnTimer   > 0        ? 'td-enemy--burning'  : '',
    enemy.freezeTimer != null && enemy.freezeTimer > 0        ? 'td-enemy--frozen'   : '',
    enemy.poisonTimer != null && enemy.poisonTimer > 0        ? 'td-enemy--poisoned' : '',
  ].filter(Boolean).join(' ')
  return (
    <div
      className={cls}
      style={{ transform: `translate(${enemy.x - size / 2}px, ${enemy.y - size / 2}px)`, width: size }}
    >
      <AnimatedSpriteImg name={enemy.template.spriteName} frameCount={3} fps={6} className="td-enemy-sprite" />
      <div className="td-enemy-hp-bar">
        <div className="td-enemy-hp-fill"
          style={{ width: `${hpFrac * 100}%`, background: hpBarColor(hpFrac) }} />
      </div>
    </div>
  )
}

function HazardCloud({ hazard }: { hazard: TDHazard }) {
  const d = hazard.radius * 2
  return (
    <div
      className="td-hazard"
      style={{
        position: 'absolute',
        left: hazard.x - hazard.radius,
        top:  hazard.y - hazard.radius,
        width: d,
        height: d,
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 8,
      }}
    />
  )
}

function AttackEffect({ ev }: { ev: TDAttackEvent }) {
  const dx = ev.toX - ev.fromX
  const dy = ev.toY - ev.fromY
  const len = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  const pType = ev.projectileType ?? 'magic'

  // AOE ring: no travel line, just an expanding ring at target
  if (pType === 'aoe' || (ev.aoeRadius && len < 2)) {
    const r = ev.aoeRadius ?? 48
    return (
      <div
        className="anim-aoe-ring"
        style={{
          position: 'absolute',
          left: ev.toX - r,
          top:  ev.toY - r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 16,
        }}
      />
    )
  }

  return (
    <>
      {/* Projectile line — typed class drives colour/thickness */}
      <div
        className={`anim-projectile anim-projectile--${pType}`}
        style={{
          position: 'absolute',
          left: ev.fromX,
          top: ev.fromY,
          width: len,
          transform: `translate(0, -50%) rotate(${angle}deg)`,
          transformOrigin: '0 50%',
          pointerEvents: 'none',
          zIndex: 15,
        }}
      />
      {/* Hit spark — typed class drives colour */}
      <div
        className={`anim-hit anim-hit--${pType}`}
        style={{
          position: 'absolute',
          left: ev.toX,
          top: ev.toY,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 16,
        }}
      />
    </>
  )
}
