import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ItemTile, ItemGrid } from './ItemTile'

const meta = {
  component: ItemTile,
  decorators: [(Story) => (
    <div className="game-container">
      <div className="satchel-sheet" style={{ height: 'auto', padding: 20, display: 'block' }}><Story /></div>
    </div>
  )],
} satisfies Meta<typeof ItemTile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { icon: '🪵', count: 12, label: 'Pine Log ×12', onClick: fn() } }
export const QuestItemHeld: Story = { args: { icon: '🌿', count: '3/3', label: 'Moonleaf Herb — quest complete', flagged: true, complete: true, onClick: fn() } }
export const QuestItemPartial: Story = { args: { icon: '🐟', count: '2/4', label: 'Greyfish — 2 of 4', flagged: true, onClick: fn() } }

export const Grid: Story = {
  args: { icon: '🪵', label: 'Pine Log' },
  render: () => (
    <ItemGrid>
      <ItemTile icon="🌿" count="3/3" label="Moonleaf Herb" flagged complete onClick={fn()} />
      <ItemTile icon="🐟" count="2/4" label="Greyfish" flagged onClick={fn()} />
      <ItemTile icon="🪵" count={12} label="Pine Log" onClick={fn()} />
      <ItemTile icon="🪨" count={8} label="Rough Stone" onClick={fn()} />
      <ItemTile icon="🧵" count={5} label="Thread" onClick={fn()} />
      <ItemTile icon="🎣" count={1} label="Fishing Rod" onClick={fn()} />
      <ItemTile icon="🎀" count="worn" label="Red Ribbon — equipped" onClick={fn()} />
    </ItemGrid>
  ),
}
