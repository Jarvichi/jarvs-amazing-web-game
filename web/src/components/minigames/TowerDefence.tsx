// ─── Tower Defence ─────────────────────────────────────────────────────────────
// Wave-based tower defence. Portrait-first layout:
//   [header]  lives · wave · score · start/quit
//   [board]   scrollable grid (fills remaining height)
//   [panel]   horizontal unit strip + log line

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MilestoneUpgrade,
  TDGameState, TDTower,
  TDUpgradeType,
  TD_CELL_PX,
  TD_COLS,
  TD_MAX_LIVES,
  TD_MAX_UNIT_UPGRADES,
  TD_MAX_UPGRADES, TD_MAX_UPGRADE_PER_TYPE,
  TD_PATH,
  TD_ROWS,
  TD_TOTAL_WAVES,
  buildingUnitCount,
  calcGoldReward,
  calcTicketReward,
  chooseMilestoneUpgrade,
  createTDGame,
  moveTower,
  placeTower, removeTower,
  sellRefund,
  startWave, tickTD,
  towerCost, upgradeCost,
  upgradeTowerWith,
  xpToUpgrade
} from '../../game/towerDefence'
import { UnitTemplate } from '../../game/types'
import { Lives } from '../ui/Lives/Lives'
import { BottomPanel } from './towerdefence/BottomPanel'
import { TowerDefenceEndScreen } from './towerdefence/EndScreen'
import { GameGrid } from './towerdefence/GameGrid'

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
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const accRef = useRef(0)

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

  function handleUpgradeTower(tower: TDTower, type: TDUpgradeType) {
    setGame(prev => upgradeTowerWith(prev, tower.id, type) ?? prev)
  }

  function handleStartWave() { setGame(prev => startWave(prev)) }
  function handleChooseMilestone(id: string) { setGame(prev => chooseMilestoneUpgrade(prev, id)) }

  function handleSelectUnit(template: UnitTemplate) {
    setSelected(prev => prev?.name === template.name ? null : template)
    setSelectedTowerId(null)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const isPlacingPhase = game.phase === 'prep' || game.phase === 'between' || game.phase === 'milestone'
  const canPlaceTowers = isPlacingPhase || game.phase === 'wave'
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
    return TowerDefenceEndScreen({ game, reward, onDone, rewardLabel })
  }

  // ── Main layout ─────────────────────────────────────────────────────────────

  const lastLog = game.log[game.log.length - 1] ?? ''

  return (
    <div className="td-root">

      {/* ── Header ── */}
      <div className="td-header u-flex u-items-c u-gap-4 u-wrap">
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
          <div className="td-milestone-choices-cards u-flex u-gap-4">
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
      <GameGrid
        boardWrapRef={boardWrapRef}
        game={game}
        selectedTowerId={selectedTowerId}
        rangeHighlight={rangeHighlight}
        canPlaceTowers={canPlaceTowers}
        selected={!!selectedTower}
        setHoveredTower={setHoveredTower}
        setHoveredCell={setHoveredCell}
        handleCellClick={handleCellClick}
        gridScale={gridScale}
        isOnPath={isOnPath}
        selectedTower={selectedTower}
        hoveredTower={hoveredTower}
      />

      {/* ── Selected tower action panel ── */}
      {selectedTower && (() => {
        const t = selectedTower
        const refund = sellRefund(t)
        const upCost = upgradeCost(t)
        const xpNeeded = xpToUpgrade(t)
        const hasXp = t.xp >= xpNeeded
        const canAfford = game.mana >= upCost
        const unitCount = buildingUnitCount(t)
        const activeUnits = game.units.filter(u => u.towerId === t.id)
        const totalMaxed = t.upgrades >= TD_MAX_UPGRADES

        const upgradeOptions: Array<{
          type: TDUpgradeType; icon: string; label: string; current: number; max: number
        }> = [
            { type: 'units', icon: '👤', label: '+Unit', current: t.upgradeUnits, max: TD_MAX_UNIT_UPGRADES },
            { type: 'speed', icon: '⚡', label: 'Speed', current: t.upgradeSpeed, max: TD_MAX_UPGRADE_PER_TYPE },
            { type: 'range', icon: '🎯', label: 'Range', current: t.upgradeRange, max: TD_MAX_UPGRADE_PER_TYPE },
            { type: 'damage', icon: '⚔', label: 'Damage', current: t.upgradeDamage, max: TD_MAX_UPGRADE_PER_TYPE },
          ]

        return (
          <div className="td-selected-panel">
            <div className="td-selected-panel-row u-flex u-items-c u-just-sb u-gap-4">
              <div className="td-selected-panel-info">
                <strong>{t.buildingName}</strong>
                {t.upgrades > 0 && <span className="td-tower-tier-label u-text-gold"> ★{t.upgrades}</span>}
                <span className="td-selected-panel-stats"> · {activeUnits.length}/{unitCount} units</span>
              </div>
              <div className="td-selected-panel-row-actions">
                <button className="td-selected-action-btn td-selected-action-btn--sell"
                  onClick={() => handleSellTower(t)}>
                  SELL +💧{refund}
                </button>
                <button className="td-selected-action-btn td-selected-action-btn--cancel"
                  onClick={() => setSelectedTowerId(null)}>
                  ✕
                </button>
              </div>
            </div>

            {!totalMaxed && (
              <div className="td-selected-panel-xp">
                <div className="td-selected-panel-xp-bar">
                  <div
                    className="td-selected-panel-xp-fill"
                    style={{ width: `${Math.min(100, (t.xp / xpNeeded) * 100)}%` }}
                  />
                </div>
                <span className={hasXp ? 'td-selected-panel-xp-label--ready' : 'td-selected-panel-xp-label'}>
                  {hasXp ? `⬆ Upgrade ready! 💧${upCost}` : `${t.xp}/${xpNeeded} kills to unlock`}
                </span>
              </div>
            )}

            {totalMaxed ? (
              <div className="td-selected-panel-maxed">★ FULLY UPGRADED ({unitCount} units)</div>
            ) : (
              <div className="td-upgrade-options">
                {upgradeOptions.map(({ type, icon, label, current, max }) => {
                  const maxed = current >= max
                  const enabled = hasXp && canAfford && !maxed
                  const dotsMax = Math.min(max, 10)
                  return (
                    <button
                      key={type}
                      className={`td-upgrade-option${enabled ? '' : ' td-upgrade-option--disabled'}${maxed ? ' td-upgrade-option--maxed' : ''}`}
                      onClick={() => enabled && handleUpgradeTower(t, type)}
                    >
                      <span className="td-upgrade-option-icon">{icon}</span>
                      <span className="td-upgrade-option-label">{label}</span>
                      <span className="td-upgrade-option-dots">
                        {current}/{max}
                        {max <= 5 ? ' ' + '●'.repeat(current) + '○'.repeat(dotsMax - current) : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="td-selected-panel-hint">Tap an empty cell on the grid to move this building</div>
          </div>
        )
      })()}

      {/* ── Bottom panel ── */}
      <BottomPanel lastLog={lastLog} canPlaceTowers={canPlaceTowers} selected={selected} selectedTower={selectedTower} pool={pool} game={game} towerCost={towerCost} handleSelectUnit={handleSelectUnit} />
    </div>
  )


}



