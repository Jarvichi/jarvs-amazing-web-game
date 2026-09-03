import React, { useState } from 'react'
import { Modal } from '../ui/Modal'
import { ItemTile, ItemGrid } from './satchel/ItemTile'
import { Button } from '../ui/Button'
import type { CookIngredient } from '../../game/hub/chefCooking'

interface Props {
  /** Whose kitchen this is — used for the prompt and the empty state. */
  chefName: string
  /** Everything the player is carrying that a chef will accept. */
  items: CookIngredient[]
  /** How many ingredients may go in the pot at once. */
  maxIngredients: number
  /** Called with the chosen hub-item ids (one of each) when "Cook it!" is tapped. */
  onCook: (itemIds: string[]) => void
  onClose: () => void
}

/**
 * The "What can you cook with this?" ingredient picker. Tap up to
 * `maxIngredients` items, hand them over, and the chef works out what they
 * add up to — a secret recipe if the set is exactly right, a plainer dish
 * otherwise. Pure visual: the caller owns the inventory and the cooking.
 */
export function ChefCookingModal({ chefName, items, maxIngredients, onCook, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const full = selected.length >= maxIngredients

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id)
      : prev.length >= maxIngredients ? prev
      : [...prev, id])
  }

  const footer = (
    <>
      <Button
        variant="gold"
        disabled={selected.length === 0}
        onClick={() => onCook(selected)}
      >
        Cook it!
      </Button>
      <Button onClick={onClose}>Never mind</Button>
    </>
  )

  return (
    <Modal title="What can you cook with this?" onClose={onClose} tone="gold" footer={footer}>
      <div className="chef-cook">
        {items.length === 0 ? (
          <p className="chef-cook__prompt">
            {chefName} peers into your empty satchel. "Come back when you've got
            something worth burning."
          </p>
        ) : (
          <>
            <p className="chef-cook__prompt">
              "Hand me up to {maxIngredients} things and we'll see what they want to be."
            </p>
            <div className="chef-cook__counter">
              {selected.length} / {maxIngredients} chosen
              {full && <span className="chef-cook__counter-full"> — pot's full</span>}
            </div>
            <ItemGrid>
              {items.map(item => (
                <ItemTile
                  key={item.id}
                  icon={item.icon}
                  count={item.count > 1 ? item.count : null}
                  label={`${item.name}${item.count > 1 ? ` ×${item.count}` : ''}`}
                  selected={selected.includes(item.id)}
                  onClick={() => toggle(item.id)}
                />
              ))}
            </ItemGrid>
            <div className="chef-cook__pot">
              {selected.length === 0
                ? 'Nothing in the pot yet.'
                : selected
                    .map(id => items.find(i => i.id === id)?.name ?? id)
                    .join('  ·  ')}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
