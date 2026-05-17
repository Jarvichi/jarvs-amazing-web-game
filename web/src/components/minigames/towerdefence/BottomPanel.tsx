import { TDGameState, TDTower } from "../../../game/towerDefence"
import { UnitTemplate } from "../../../game/types"
import { TowerPool } from "../TowerDefence"
import { UnitChip } from "./UnitChip"

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
          {pool.map(({ template, buildingName }) => (
            <UnitChip
              key={template.name}
              template={template}
              buildingName={buildingName}
              remaining={game.remainingPlacements[template.name] ?? 0}
              cost={towerCost(template)}
              mana={game.mana}
              canPlaceTowers={canPlaceTowers}
              selected={selected?.name === template.name}
              onSelect={() => handleSelectUnit(template)}
            />
          ))}
        </div>
      </div>

</>
    )
}