import React from 'react'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'
import { FilterChips, type FilterChipOption } from '../../ui/rows/FilterChips'

const PACK_QUANTITIES = [1, 3, 5, 10]

interface Props {
  packQty: number
  maxPackQty: number
  canBuyPack: boolean
  crystals: number
  crystalPackCost: number
  onQtyChange: (qty: number) => void
  onBuyClick: () => void
}

export function CrystalPackPanel({ packQty, maxPackQty, canBuyPack, crystals, crystalPackCost, onQtyChange, onBuyClick }: Props) {
  const options: FilterChipOption[] = [
    ...PACK_QUANTITIES.map(q => ({ id: `qty-${q}`, label: `×${q}` })),
    {
      id: 'max',
      label: maxPackQty > 0 ? `MAX ×${maxPackQty}` : 'MAX',
      disabled: maxPackQty === 0,
      title: maxPackQty === 0 ? 'Not enough crystals' : `Buy ${maxPackQty} packs`,
    },
  ]
  const activeId = packQty === maxPackQty && maxPackQty > 0 ? 'max' : `qty-${packQty}`

  function handleChange(id: string) {
    if (id === 'max') {
      if (maxPackQty > 0) onQtyChange(maxPackQty)
    } else {
      onQtyChange(Number(id.slice('qty-'.length)))
    }
  }

  return (
    <div className="shop-item">
      <div className="shop-item-icon"><Icon name="pack" size={40} /></div>
      <div className="shop-item-name">Card Pack</div>
      <div className="shop-item-desc">
        5 cards · 2 Common · 1 Uncommon · 1 Rare · 1 Bonus
      </div>
      <FilterChips options={options} activeId={activeId} onChange={handleChange} label="Pack quantity" />
      <Button variant="gold" onClick={onBuyClick}>
        {canBuyPack
          ? <>Buy {packQty > 1 ? `${packQty}× ` : ''}— <span className="shop-price">{crystalPackCost * packQty}</span> <Icon name="crystal" size={13} /></>
          : <>Need <span className="shop-price">{crystalPackCost * packQty - crystals}</span> more <Icon name="crystal" size={13} /></>}
      </Button>
    </div>
  )
}
