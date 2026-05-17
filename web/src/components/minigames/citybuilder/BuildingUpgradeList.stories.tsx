import React, { useState } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { BuildingUpgradeList, Props } from './BuildingUpgradeList'
import { getCardCatalog } from '../../../game/cards'

const meta = {
  component: BuildingUpgradeList,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BuildingUpgradeList>

export default meta
type Story = StoryObj<typeof meta>

const levellable = getCardCatalog().filter(c => c.cardType === 'structure').slice(0, 8)

const baseCity: any = { gold: 400 }

function Wrapper(props: Omit<Props, 'upgradeSearch' | 'setUpgradeSearch' | 'collection'>) {
  const [search, setSearch] = useState('')
  return <BuildingUpgradeList {...props} collection={[]} upgradeSearch={search} setUpgradeSearch={setSearch} />
}

export const WithBuildings: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      levellable={levellable}
      city={baseCity}
      onBack={fn()}
      onSelectCard={fn()}
    />
  ),
}

export const NoBuildings: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      levellable={[]}
      city={baseCity}
      onBack={fn()}
      onSelectCard={fn()}
    />
  ),
}
