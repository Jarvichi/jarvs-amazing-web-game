// ─── Tower Defence ─────────────────────────────────────────────────────────────
// Wave-based tower defence. Towers come from the player's card collection or
// their city residents. Enemies walk a fixed path; survive all 10 waves to win.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { UnitTemplate } from '../../game/types'
import { SpriteImg } from '../SpriteImg'
import {
  TD_COLS, TD_ROWS, TD_PATH, TD_WAVES, TD_TOTAL_WAVES, TD_MAX_LIVES,
  TDGameState, TDTower, TDEnemy,
  isPathCell,
  createTDGame, placeTower, removeTower, startWave, tickTD,
  calcTicketReward, calcGoldReward,
} from '../../game/towerDefence'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TowerPool {
  template: UnitTemplate
  total: number   // max times this unit can be placed
}

interface Props {
  pool: TowerPool[]
  mode: 'collection' | 'city'
  onDone: (score: number) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CELL_PX = 48
const TICK_MS = 50   // ~20 fps simulation (RAF handles rendering)

// ── Helpers ───────────────────────────────────────────────────────────────────

function hpBarColor(frac: number): string {
  if (frac > 0.6) return '#4caf50'
  if (frac > 0.3) return '#ff9800'
  return '#f44336'
}

function livesIcons(lives: number, max: number): string {
  return '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, max - lives))
}

// Map path index → waypoint set for quick membership check
const PATH_CELL_SET = new Set(TD_PATH.map(p => `${p.col},${p.row}`))
function isBorderPath(col: number, row: number): boolean {
  return PATH_CELL_SET.has(`${col},${row}`)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TowerDefence({ pool, mode, onDone }: Props) {
  // Build initial placements map from pool
  const initialPlacements: Record<string, number> = {}
  for (const entry of pool) {
    initialPlacements[entry.template.name] = entry.total
  }

  const [game, setGame] = useState<TDGameState>(() =>
    createTDGame(pool.map(p => p.template), mode, initialPlacements)
  )
  const [selected, setSelected] = useState<UnitTemplate | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ col: number; row: number } | null>(null)
  const [hoveredTower, setHoveredTower] = useState<TDTower | null>(null)

  const gameRef = useRef(game)
  gameRef.current = game

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const accRef = useRef(0)

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
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [tick])

  // ── Interactions ────────────────────────────────────────────────────────────

  function handleCellClick(col: number, row: number) {
    const g = gameRef.current
    if (g.phase !== 'prep' && g.phase !== 'between') return

    // Click on existing tower → remove it
    const existing = g.towers.find(t => t.col === col && t.row === row)
    if (existing) {
      setGame(prev => removeTower(prev, existing.id))
      setHoveredTower(null)
      return
    }

    if (!selected) return
    if (isPathCell(col, row)) return

    const next = placeTower(g, selected, col, row)
    if (next) setGame(next)
  }

  function handleStartWave() {
    setGame(prev => startWave(prev))
  }

  function handleSelectUnit(template: UnitTemplate) {
    setSelected(prev => prev?.name === template.name ? null : template)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const canPlace = (template: UnitTemplate) => (game.remainingPlacements[template.name] ?? 0) > 0
  const isPlacingPhase = game.phase === 'prep' || game.phase === 'between'
  const reward = mode === 'city' ? calcGoldReward(game.wavesCompleted) : calcTicketReward(game.wavesCompleted)
  const rewardLabel = mode === 'city' ? `${reward.toLocaleString()} 🪙 city gold` : `${reward} 🎫 tickets`

  // ── End screens ─────────────────────────────────────────────────────────────

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

  return (
    <div className="td-root">
      {/* ── Header ── */}
      <div className="td-header">
        <div className="td-header-left">
          <span className="td-lives">{livesIcons(game.lives, TD_MAX_LIVES)}</span>
          <span className="td-wave-label">
            Wave {game.wavesCompleted + 1} / {TD_TOTAL_WAVES}
            {game.phase === 'between' && ' — Get ready!'}
          </span>
        </div>
        <div className="td-header-center">
          {isPlacingPhase && (
            <button className="action-btn action-btn--gold" onClick={handleStartWave}>
              ▶ START WAVE
            </button>
          )}
          {game.phase === 'wave' && (
            <span className="td-wave-active">⚔ Wave in progress…</span>
          )}
        </div>
        <div className="td-header-right">
          <span className="td-score">Score: {game.score}</span>
          <button className="action-btn action-btn--danger td-quit-btn" onClick={() => onDone(reward)}>
            QUIT
          </button>
        </div>
      </div>

      <div className="td-body">
        {/* ── Grid ── */}
        <div
          className="td-grid"
          style={{ width: TD_COLS * CELL_PX, height: TD_ROWS * CELL_PX }}
        >
          {/* Cells */}
          {Array.from({ length: TD_ROWS }, (_, row) =>
            Array.from({ length: TD_COLS }, (_, col) => {
              const key = `${col},${row}`
              const onPath = isBorderPath(col, row)
              const isStart = col === TD_PATH[0].col && row === TD_PATH[0].row
              const isEnd = col === TD_PATH[TD_PATH.length - 1].col && row === TD_PATH[TD_PATH.length - 1].row
              const tower = game.towers.find(t => t.col === col && t.row === row)
              const isHovered = hoveredCell?.col === col && hoveredCell?.row === row
              const canDrop = isHovered && selected && !onPath && !tower && isPlacingPhase && canPlace(selected)

              return (
                <div
                  key={key}
                  className={[
                    'td-cell',
                    onPath ? 'td-cell--path' : 'td-cell--grass',
                    isStart ? 'td-cell--start' : '',
                    isEnd ? 'td-cell--end' : '',
                    tower ? 'td-cell--occupied' : '',
                    canDrop ? 'td-cell--drop-target' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ left: col * CELL_PX, top: row * CELL_PX, width: CELL_PX, height: CELL_PX }}
                  onClick={() => handleCellClick(col, row)}
                  onMouseEnter={() => { setHoveredCell({ col, row }); if (tower) setHoveredTower(tower) }}
                  onMouseLeave={() => { setHoveredCell(null); setHoveredTower(null) }}
                >
                  {isStart && <span className="td-cell-label">IN</span>}
                  {isEnd && <span className="td-cell-label">BASE</span>}
                  {tower && (
                    <div className="td-tower-sprite">
                      <div style={{ width: CELL_PX - 8, height: CELL_PX - 8 }}>
                        <SpriteImg name={tower.template.name} />
                      </div>
                      <div className="td-tower-hp-bar">
                        <div
                          className="td-tower-hp-fill"
                          style={{
                            width: `${(tower.hp / tower.maxHp) * 100}%`,
                            background: hpBarColor(tower.hp / tower.maxHp),
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* Enemies (absolutely positioned over grid) */}
          {game.enemies.map(enemy => (
            <EnemyToken key={enemy.id} enemy={enemy} />
          ))}
        </div>

        {/* ── Sidebar ── */}
        <div className="td-sidebar">
          <div className="td-sidebar-title">TOWERS</div>
          {isPlacingPhase
            ? <p className="td-sidebar-hint">Click a unit to select, then click a grass cell to place. Click a placed tower to remove it.</p>
            : <p className="td-sidebar-hint">Wave in progress — placement locked.</p>
          }

          <div className="td-unit-list">
            {pool.map(({ template }) => {
              const remaining = game.remainingPlacements[template.name] ?? 0
              const isSel = selected?.name === template.name
              const disabled = !isPlacingPhase || remaining === 0
              return (
                <button
                  key={template.name}
                  className={[
                    'td-unit-btn',
                    isSel ? 'td-unit-btn--selected' : '',
                    disabled ? 'td-unit-btn--disabled' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !disabled && handleSelectUnit(template)}
                  title={`ATK ${template.attack} · HP ${template.maxHp} · Range ${Math.max(1, Math.round(template.attackRange / 64))} cells`}
                >
                  <div style={{ width: 32, height: 32, flexShrink: 0 }}>
                    <SpriteImg name={template.name} />
                  </div>
                  <div className="td-unit-btn-info">
                    <div className="td-unit-btn-name">{template.name}</div>
                    <div className="td-unit-btn-stats">
                      ⚔ {template.attack} · ❤ {template.maxHp}
                    </div>
                  </div>
                  <span className={`td-unit-count ${remaining === 0 ? 'td-unit-count--zero' : ''}`}>
                    ×{remaining}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Tower tooltip */}
          {hoveredTower && (
            <div className="td-tower-tooltip">
              <strong>{hoveredTower.template.name}</strong>
              <div>HP {hoveredTower.hp} / {hoveredTower.maxHp}</div>
              <div>ATK {hoveredTower.template.attack}</div>
              <div>Range {hoveredTower.rangeInCells} cells</div>
              {isPlacingPhase && <div className="td-tooltip-hint">(click to remove)</div>}
            </div>
          )}

          {/* Log */}
          <div className="td-log">
            {[...game.log].reverse().slice(0, 5).map((line, i) => (
              <div key={i} className="td-log-line">{line}</div>
            ))}
          </div>
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
      style={{
        left: enemy.x - size / 2,
        top: enemy.y - size / 2,
        width: size,
      }}
    >
      <SpriteImg name={enemy.template.spriteName} className="td-enemy-sprite" />
      <div className="td-enemy-hp-bar">
        <div
          className="td-enemy-hp-fill"
          style={{ width: `${hpFrac * 100}%`, background: hpBarColor(hpFrac) }}
        />
      </div>
    </div>
  )
}
