import type { Meta, StoryObj } from '@storybook/react'
import { MapEditor } from './MapEditor'

const meta = {
  title:      'Map Editor/MapEditor',
  component:  MapEditor,
  parameters: {
    layout: 'fullscreen',
    docs:   { description: { component: 'Visual map editor for hub towns, castles and interiors. Dev-only — requires Storybook dev server for file saves.' } },
  },
} satisfies Meta<typeof MapEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Ravenwatch: Story = {
  args: { initialMapId: 'ravenwatch' },
}

// Festival previews — force a festival regardless of today's date so its decor
// can be authored/inspected on the hub canvas year-round.
export const RavenwatchMidsummer: Story = {
  name: 'Ravenwatch · Midsummer',
  args: { initialMapId: 'ravenwatch', initialFestival: 'midsummer' },
}

export const RavenwatchHarvest: Story = {
  name: 'Ravenwatch · Harvest',
  args: { initialMapId: 'ravenwatch', initialFestival: 'harvest' },
}

export const RavenwatchMidwinter: Story = {
  name: 'Ravenwatch · Midwinter',
  args: { initialMapId: 'ravenwatch', initialFestival: 'midwinter' },
}

export const Millhaven: Story = {
  args: { initialMapId: 'millhaven' },
}

export const IronholdKeep: Story = {
  args: { initialMapId: 'ironholdkeep' },
}

export const ThornwoodCamp: Story = {
  name: 'Thornwood Camp',
  args: { initialMapId: 'thornwoodcamp' },
}

export const CapitalCity: Story = {
  name: 'Capital City',
  args: { initialMapId: 'capitalcity' },
}

export const RoyalPalace: Story = {
  name: 'Royal Palace',
  args: { initialMapId: 'royalpalace' },
}

export const SaltmerePort: Story = {
  name: 'Saltmere Port',
  args: { initialMapId: 'saltmereport' },
}

export const Gearford: Story = {
  args: { initialMapId: 'gearford' },
}

export const Harrowfield: Story = {
  args: { initialMapId: 'harrowfield' },
}

export const Appleford: Story = {
  args: { initialMapId: 'appleford' },
}

export const Gravemoor: Story = {
  args: { initialMapId: 'gravemoor' },
}

export const Hollowmere: Story = {
  args: { initialMapId: 'hollowmere' },
}

export const DreadspirecCitadel: Story = {
  name: 'Dreadspire Citadel',
  args: { initialMapId: 'dreadspirecitadel' },
}
