import { TDGameState, TDTower } from "../../../game/towerDefence"
import { UnitTemplate } from "../../../game/types"
import { SpriteImg } from "../../ui/SpriteImg"
import { TowerPool } from "../TowerDefence"

export interface Props {
lastLog: string
canPlaceTowers: boolean
selectedTower: TDTower | null
selected: UnitTemplate | null
 pool: TowerPool[]
  game: TDGameState
   towerCost(template: UnitTemplate): number
   handleSelectUnit(template: UnitTemplate): void
}

export function BottomPanel({ 
    lastLog, canPlaceTowers, selectedTower, selected, pool,
        game,
        towerCost,
        handleSelectUnit,
 }: Props) {
    return (
<>
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

</>
    )
}