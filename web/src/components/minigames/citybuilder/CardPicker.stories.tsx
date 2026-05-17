import React, { useState } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardPicker, Props } from './CardPicker'
import { getCardCatalog } from '../../../game/cards'

const meta = {
  component: CardPicker,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CardPicker>

export default meta
type Story = StoryObj<typeof meta>

const allStructures = getCardCatalog().filter(c => c.cardType === 'structure')
const spawners      = allStructures.filter(c => c.unit?.structureEffect?.type === 'spawn').slice(0, 4)
const producers     = allStructures.filter(c => {
  if (c.unit?.structureEffect?.type === 'spawn') return false
  return true
}).slice(0, 4)
const availableForPlace = [...spawners, ...producers]

const baseCity: any = {
  resources: { wheat: 100, wood: 50, ore: 20, bread: 0, planks: 0, metal: 0 },
  gold: 500,
}

function Wrapper(props: Omit<Props, 'pickerSearch' | 'setPickerSearch'>) {
  const [search, setSearch] = useState('')
  return <CardPicker {...props} pickerSearch={search} setPickerSearch={setSearch} />
}

export const WithCards: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      availableForPlace={availableForPlace}
      city={baseCity}
      collection={[]}
      onBack={fn()}
      onPickCard={fn()}
    />
  ),
}

export const NoCards: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      availableForPlace={[]}
      city={baseCity}
      collection={[]}
      onBack={fn()}
      onPickCard={fn()}
    />
  ),
}
