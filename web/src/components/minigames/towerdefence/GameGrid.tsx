import { CELL_PX } from "../../../game/cityBuilder";
import { buildingUnitCount, TD_COLS, TD_MAX_UPGRADES, TD_PATH, TD_ROWS, TDGameState, TDTower, TDUnit, xpToUpgrade } from "../../../game/towerDefence";
import { SpriteImg } from "../../ui/SpriteImg";
import { AttackEffect } from "./AttackEffect";
import { EnemyToken } from "./EnemyToken";
import { HazardCloud } from "./HazardCloud";
import { UnitGroupToken } from "./UnitGroupToken";


export interface Props {
boardWrapRef: React.RefObject<HTMLDivElement>;
game: TDGameState;
selectedTowerId: number | null;
rangeHighlight: Set<string>;
canPlaceTowers: boolean;
selected: boolean;
setHoveredTower: (tower: TDTower | null) => void;
setHoveredCell: (cell: { col: number; row: number } | null) => void;
handleCellClick: (col: number, row: number) => void;
gridScale: number
isOnPath(col: number, row: number): boolean
selectedTower: TDTower | null
hoveredTower: TDTower | null
}

export function GameGrid({
boardWrapRef, game, selectedTowerId, rangeHighlight, canPlaceTowers, selected,
gridScale,
isOnPath,setHoveredTower, setHoveredCell, handleCellClick,
selectedTower, hoveredTower,
}: Props) {
    return <div className="td-board-wrap" ref={boardWrapRef}>
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
          {Array.from({ length: TD_ROWS }, (_, row) => Array.from({ length: TD_COLS }, (_, col) => {
            const onPath = isOnPath(col, row)
            const isStart = col === TD_PATH[0].col && row === TD_PATH[0].row
            const isEnd = col === TD_PATH[TD_PATH.length - 1].col && row === TD_PATH[TD_PATH.length - 1].row
            const tower = game.towers.find(t => t.col === col && t.row === row)
            const isTowerSelected = tower?.id === selectedTowerId
            // canDrop: valid placement cell, or valid move destination for selected tower
            const canDrop = !onPath && !tower && (
              (selected && canPlaceTowers) ||
              (selectedTowerId !== null)
            )
            const inRange = rangeHighlight.has(`${col},${row}`)

            return (
              <div
                key={`${col},${row}`}
                className={[
                  'td-cell u-absolute u-pointer u-flex u-items-c u-just-c u-no-select',
                  onPath ? 'td-cell--path' : 'td-cell--grass',
                  isStart ? 'td-cell--start' : '',
                  isEnd ? 'td-cell--end' : '',
                  canDrop ? 'td-cell--droppable' : '',
                  tower ? 'td-cell--occupied' : '',
                  inRange ? 'td-cell--in-range' : '',
                  isTowerSelected ? 'td-cell--tower-selected' : '',
                ].filter(Boolean).join(' ')}
                style={{ left: col * CELL_PX, top: row * CELL_PX, width: CELL_PX, height: CELL_PX }}
                onClick={() => handleCellClick(col, row)}
                onMouseEnter={() => {
                  if (tower) setHoveredTower(tower)
                  setHoveredCell({ col, row })
                } }
                onMouseLeave={() => {
                  setHoveredTower(null)
                  setHoveredCell(null)
                } }
              >
                {isStart && <span className="td-cell-label">IN</span>}
                {isEnd && <span className="td-cell-label">BASE</span>}
                {tower && (
                  <div className="td-tower-inner u-col u-items-c">
                    <SpriteImg name={tower.buildingName} />
                    {tower.upgrades > 0 && (
                      <div className="td-tower-tier">★{tower.upgrades}</div>
                    )}
                    {tower.respawnTimers.length > 0 && (
                      <div className="td-tower-respawn">⏳</div>
                    )}
                    {tower.upgrades < TD_MAX_UPGRADES && tower.xp >= xpToUpgrade(tower) && (
                      <div className="td-tower-upgrade-ready">⬆</div>
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
            const xpNeeded = xpToUpgrade(t)
            const xpReady = t.upgrades < TD_MAX_UPGRADES && t.xp >= xpNeeded
            return (
              <div
                className="td-tower-tooltip"
                style={{ left: t.col * CELL_PX, top: Math.max(0, t.row * CELL_PX - 56) }}
              >
                <strong>{t.buildingName}</strong>
                {t.upgrades > 0 && <span className="td-tower-tier-label u-text-gold"> {'★'.repeat(t.upgrades)}</span>}
                <div>{t.template.name} · {activeUnits.length}/{unitCount} active</div>
                {t.upgrades < TD_MAX_UPGRADES && (
                  <div className={xpReady ? 'td-tooltip-xp-ready' : 'td-tooltip-xp'}>
                    {xpReady ? '⬆ Upgrade ready!' : `XP ${t.xp}/${xpNeeded} kills`}
                  </div>
                )}
                {t.id !== selectedTowerId && <div className="td-tooltip-hint">Tap to select</div>}
              </div>
            )
          })()}
        </div>
      </div>{/* td-grid-scaler */}
    </div>
  }