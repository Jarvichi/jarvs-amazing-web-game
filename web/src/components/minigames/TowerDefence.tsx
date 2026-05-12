// ─── Tower Defence ─────────────────────────────────────────────────────────────
// Wave-based tower defence. Portrait-first layout:
//   [header]  lives · wave · score · start/quit
//   [board]   scrollable grid (fills remaining height)
//   [panel]   horizontal unit strip + log line

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { UnitTemplate } from '../../game/types'
import { SpriteImg, AnimatedSpriteImg } from '../SpriteImg'
import {
  TD_COLS, TD_ROWS, TD_PATH, TD_WAVES, TD_TOTAL_WAVES, TD_MAX_LIVES, TD_CELL_PX,
  TDGameState, TDTower, TDEnemy, TDAttackEvent,
  isPathCell,
  createTDGame, placeTower, removeTower, startWave, tickTD,
  calcTicketReward, calcGoldReward, towerCost,
} from '../../game/towerDefence'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TowerPool {
  template: UnitTemplate
  total: number
}

interface Props {
  pool: TowerPool[]
  mode: 'collection' | 'city'
  onDone: (score: number) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CELL_PX = TD_CELL_PX   // single source of truth from game logic
const TICK_MS = 50

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
  const [hoveredCell, setHoveredCell] = useState<{ col: number; row: number } | null>(null)
  const [gridScale, setGridScale] = useState(1)

  const gameRef = useRef(game)
  gameRef.current = game

  const boardWrapRef = useRef<HTMLDivElement>(null)
  const rafRef       = useRef<number | null>(null)
  const lastTimeRef  = useRef<number | null>(null)
  const accRef       = useRef(0)

  // ── Game loop ───────────────────────────────────────────────────────────────

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp
    const dt = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp
    accRef.current += dt

    while (accRef.current >= TICK_MS) {
      accRef.current -= TICK_MS
      setGame(prev => {
        if (prev.phase === 'prep' || prev.phase === 'victory' || prev.phase === 'defeat') return prev
        return tickTD(prev, TICK_MS)
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
    if (g.phase !== 'prep' && g.phase !== 'between' && g.phase !== 'wave') return

    const existing = g.towers.find(t => t.col === col && t.row === row)
    if (existing) {
      // Only allow removal during non-wave phases
      if (g.phase === 'prep' || g.phase === 'between') {
        setGame(prev => removeTower(prev, existing.id))
        setHoveredTower(null)
      }
      return
    }

    if (!selected) return
    if (isOnPath(col, row)) return

    const next = placeTower(g, selected, col, row)
    if (next) setGame(next)
  }

  function handleStartWave() { setGame(prev => startWave(prev)) }

  function handleSelectUnit(template: UnitTemplate) {
    setSelected(prev => prev?.name === template.name ? null : template)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const isPlacingPhase  = game.phase === 'prep' || game.phase === 'between'
  const canPlaceTowers  = isPlacingPhase || game.phase === 'wave'
  const reward = mode === 'city' ? calcGoldReward(game.wavesCompleted) : calcTicketReward(game.wavesCompleted)
  const rewardLabel = mode === 'city'
    ? `${reward.toLocaleString()} 🪙 city gold`
    : `${reward} 🎫 tickets`

  // Wave progress (0..1): proportion of enemies that have been spawned
  const waveProgress = game.waveSpawnTotal > 0
    ? (game.waveSpawnTotal - game.spawnQueue.length) / game.waveSpawnTotal
    : 0

  // Cells to highlight for range preview
  const rangeHighlight = useMemo<Set<string>>(() => {
    let refCol: number | null = null
    let refRow: number | null = null
    let rangeInCells = 1
    if (hoveredTower) {
      refCol = hoveredTower.col; refRow = hoveredTower.row; rangeInCells = hoveredTower.rangeInCells
    } else if (selected && hoveredCell) {
      refCol = hoveredCell.col; refRow = hoveredCell.row
      rangeInCells = Math.max(1, Math.round(selected.attackRange / CELL_PX))
    }
    if (refCol === null || refRow === null) return new Set()
    const cells = new Set<string>()
    for (let r = 0; r < TD_ROWS; r++) {
      for (let c = 0; c < TD_COLS; c++) {
        if (Math.sqrt((c - refCol) ** 2 + (r - refRow) ** 2) <= rangeInCells) {
          cells.add(`${c},${r}`)
        }
      }
    }
    return cells
  }, [hoveredTower, selected, hoveredCell])

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
          {'❤️'.repeat(game.lives)}{'🖤'.repeat(Math.max(0, TD_MAX_LIVES - game.lives))}
        </div>

        <div className="td-header-wave">
          Wave {game.wavesCompleted + 1}/{TD_TOTAL_WAVES}
        </div>

        <div className="td-header-score">⭐ {game.score}</div>
        <div className="td-header-mana">💧 {game.mana}</div>

        {isPlacingPhase && (
          <button className="action-btn action-btn--gold td-header-btn" onClick={handleStartWave}>
            ▶ START
          </button>
        )}
        {game.phase === 'wave' && (
          <div className="td-wave-progress-wrap">
            <div className="td-wave-progress-fill" style={{ width: `${waveProgress * 100}%` }} />
            <span className="td-wave-progress-label">⚔ {Math.round(waveProgress * 100)}%</span>
          </div>
        )}
        {game.phase === 'between' && (
          <span className="td-header-active">⏳ Next wave…</span>
        )}

        <button className="action-btn action-btn--danger td-header-btn" onClick={() => onDone(reward)}>
          ✕
        </button>
      </div>

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
              const canDrop   = selected && !onPath && !tower && canPlaceTowers
              const inRange   = rangeHighlight.has(`${col},${row}`)

              return (
                <div
                  key={`${col},${row}`}
                  className={[
                    'td-cell',
                    onPath   ? 'td-cell--path'   : 'td-cell--grass',
                    isStart  ? 'td-cell--start'  : '',
                    isEnd    ? 'td-cell--end'     : '',
                    canDrop  ? 'td-cell--droppable' : '',
                    tower    ? 'td-cell--occupied' : '',
                    inRange  ? 'td-cell--in-range' : '',
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
                      <SpriteImg name={tower.template.name} />
                      <div className="td-tower-hp-bar">
                        <div className="td-tower-hp-fill" style={{
                          width: `${(tower.hp / tower.maxHp) * 100}%`,
                          background: hpBarColor(tower.hp / tower.maxHp),
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* Enemies */}
          {game.enemies.map(enemy => (
            <EnemyToken key={enemy.id} enemy={enemy} />
          ))}

          {/* Attack effects */}
          {game.attackEvents.map(ev => (
            <AttackEffect key={ev.id} ev={ev} />
          ))}

          {/* Tower tooltip overlay */}
          {hoveredTower && (
            <div
              className="td-tower-tooltip"
              style={{
                left: hoveredTower.col * CELL_PX,
                top: Math.max(0, hoveredTower.row * CELL_PX - 72),
              }}
            >
              <strong>{hoveredTower.template.name}</strong>
              <div>HP {hoveredTower.hp}/{hoveredTower.maxHp} · ATK {hoveredTower.template.attack} · R {hoveredTower.rangeInCells}</div>
              {isPlacingPhase && <div className="td-tooltip-hint">Tap to remove</div>}
            </div>
          )}
        </div>
        </div>{/* td-grid-scaler */}
      </div>

      {/* ── Bottom panel ── */}
      <div className="td-panel">
        {/* Log line */}
        <div className="td-panel-log">{lastLog}</div>

        {/* Hint */}
        {canPlaceTowers && (
          <div className="td-panel-hint">
            {selected
              ? `Placing ${selected.name} (💧${towerCost(selected)}) — tap a green cell`
              : 'Tap a unit below to select, then tap the grid'}
          </div>
        )}

        {/* Unit strip */}
        <div className="td-unit-strip">
          {pool.map(({ template }) => {
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
                title={`${template.name} — ATK ${template.attack}, HP ${template.maxHp}, Range ${Math.max(1, Math.round(template.attackRange / CELL_PX))} cells, Cost ${cost} mana`}
              >
                <div className="td-unit-chip-sprite">
                  <SpriteImg name={template.name} />
                </div>
                <div className="td-unit-chip-name">{template.name}</div>
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

// ── Enemy token ───────────────────────────────────────────────────────────────

function EnemyToken({ enemy }: { enemy: TDEnemy }) {
  const size = 28
  const hpFrac = enemy.hp / enemy.maxHp
  return (
    <div
      className="td-enemy"
      style={{ left: enemy.x - size / 2, top: enemy.y - size / 2, width: size }}
    >
      <AnimatedSpriteImg name={enemy.template.spriteName} frameCount={3} fps={6} className="td-enemy-sprite" />
      <div className="td-enemy-hp-bar">
        <div className="td-enemy-hp-fill"
          style={{ width: `${hpFrac * 100}%`, background: hpBarColor(hpFrac) }} />
      </div>
    </div>
  )
}

function AttackEffect({ ev }: { ev: TDAttackEvent }) {
  const dx = ev.toX - ev.fromX
  const dy = ev.toY - ev.fromY
  const len = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  return (
    <>
      {/* Projectile line */}
      <div
        className="anim-projectile"
        style={{
          position: 'absolute',
          left: ev.fromX,
          top: ev.fromY,
          width: len,
          height: 4,
          transform: `translate(0, -50%) rotate(${angle}deg)`,
          transformOrigin: '0 50%',
          pointerEvents: 'none',
          zIndex: 15,
        }}
      />
      {/* Hit spark */}
      <div
        className="anim-hit"
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
