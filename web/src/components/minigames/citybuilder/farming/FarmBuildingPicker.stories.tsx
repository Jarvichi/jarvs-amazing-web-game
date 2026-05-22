import type { Meta, StoryObj } from '@storybook/react'
import { FarmBuildingPicker } from './FarmBuildingPicker'
import type { Card } from '../../../../game/types'
import { CORE_FARM_BUILDINGS } from '../../../../game/farmingSim'

const sampleCards: Card[] = [
  { id: 'farm-1', name: 'Farm', rarity: 'common', cost: 2, cardType: 'structure', description: 'Produces wheat' },
  { id: 'lumber-camp-1', name: 'Lumber Camp', rarity: 'uncommon', cost: 3, cardType: 'structure', description: 'Produces wood' },
  { id: 'quarry-1', name: 'Quarry', rarity: 'rare', cost: 4, cardType: 'structure', description: 'Produces ore and planks' },
  { id: 'canopy-farm-1', name: 'Canopy Farm', rarity: 'uncommon', cost: 3, cardType: 'structure', description: 'Produces wheat' },
  { id: 'blacksmith-1', name: 'Blacksmith', rarity: 'uncommon', cost: 3, cardType: 'structure', description: 'Produces metal' },
  { id: 'windmill-1', name: 'Windmill', rarity: 'common', cost: 2, cardType: 'structure', description: 'Converts wheat to bread' },
]

const meta: Meta<typeof FarmBuildingPicker> = {
  title: 'Farming/FarmBuildingPicker',
  component: FarmBuildingPicker,
}
export default meta
type Story = StoryObj<typeof FarmBuildingPicker>

export const Default: Story = {
  args: {
    availableCards:    sampleCards,
    coreFarmBuildings: CORE_FARM_BUILDINGS,
    gold:              1000,
    onPick:            (c) => console.log('picked', c.name),
    onPickCore:        (b) => console.log('picked core', b.name),
    onBack:            () => {},
  },
}

export const Broke: Story = {
  args: {
    availableCards:    sampleCards,
    coreFarmBuildings: CORE_FARM_BUILDINGS,
    gold:              0,
    onPick:            () => {},
    onPickCore:        () => {},
    onBack:            () => {},
  },
}

export const Empty: Story = {
  args: {
    availableCards:    [],
    coreFarmBuildings: [],
    gold:              500,
    onPick:            () => {},
    onPickCore:        () => {},
    onBack:            () => {},
  },
}
