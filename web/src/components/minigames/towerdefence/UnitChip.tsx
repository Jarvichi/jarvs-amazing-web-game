import { UnitTemplate } from '../../../game/types'
import { SpriteImg } from '../../ui/SpriteImg'

const EFFECT_META: Record<string, { icon: string; label: string; cls: string }> = {
  burn:     { icon: '🔥', label: 'Burn',     cls: 'effect--burn'     },
  freeze:   { icon: '❄',  label: 'Freeze',   cls: 'effect--freeze'   },
  poison:   { icon: '☠',  label: 'Poison',   cls: 'effect--poison'   },
  shock:    { icon: '⚡', label: 'Shock',    cls: 'effect--shock'    },
  aoe:      { icon: '💥', label: 'AoE',      cls: 'effect--aoe'      },
  gascloud: { icon: '☁',  label: 'Gas',      cls: 'effect--gascloud' },
}

export interface UnitChipProps {
  template: UnitTemplate
  buildingName: string
  remaining: number
  cost: number
  mana: number
  canPlaceTowers: boolean
  selected: boolean
  onSelect(): void
}

export function UnitChip({ template, buildingName, remaining, cost, mana, canPlaceTowers, selected, onSelect }: UnitChipProps) {
  const cantAfford = mana < cost
  const disabled   = !canPlaceTowers || remaining === 0 || cantAfford
  const effect     = template.attackEffect ? EFFECT_META[template.attackEffect.type] : null

  return (
    <button
      className={[
        'td-unit-chip',
        selected  ? 'td-unit-chip--selected' : '',
        disabled  ? 'td-unit-chip--disabled'  : '',
      ].filter(Boolean).join(' ')}
      onClick={() => !disabled && onSelect()}
      title={`${buildingName} — spawns ${template.name}, ATK ${template.attack}, HP ${template.maxHp}, Cost ${cost} mana${effect ? `, ${effect.label} effect` : ''}`}
    >
      <div className="td-unit-chip-sprite">
        <SpriteImg name={buildingName} />
        {effect && (
          <span
            className={`td-unit-chip-effect ${effect.cls}`}
            aria-label={effect.label}
          >
            {effect.icon}
          </span>
        )}
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
}
