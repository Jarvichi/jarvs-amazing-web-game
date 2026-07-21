import type { Meta, StoryObj } from '@storybook/react'
import { BattlefieldEditor } from './BattlefieldEditor'

const meta = {
  title:      'Battlefield Editor/BattlefieldEditor',
  component:  BattlefieldEditor,
  parameters: {
    layout: 'fullscreen',
    docs:   { description: { component: 'Visual editor for battlefield roads and terrain obstacles, authored into act JSON. Dev-only — requires Storybook dev server for file saves.' } },
  },
} satisfies Meta<typeof BattlefieldEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Act1: Story = { args: { initialActId: 'act1' } }
export const Act2: Story = { args: { initialActId: 'act2' } }
export const Act3: Story = { args: { initialActId: 'act3' } }
export const Act4: Story = { args: { initialActId: 'act4' } }
export const Act5: Story = { args: { initialActId: 'act5' } }
export const Act6: Story = { args: { initialActId: 'act6' } }
export const Act7: Story = { args: { initialActId: 'act7' } }
export const Act8: Story = { args: { initialActId: 'act8' } }
export const Act9: Story = { args: { initialActId: 'act9' } }
export const Act10: Story = { args: { initialActId: 'act10' } }
export const Act11: Story = { args: { initialActId: 'act11' } }
export const Act12: Story = { args: { initialActId: 'act12' } }
export const Act13: Story = { args: { initialActId: 'act13' } }
export const ActFinale: Story = { name: 'Act Finale', args: { initialActId: 'actfinale' } }
export const C2Act1: Story = { name: 'Ch2 Act 1', args: { initialActId: 'c2act1' } }
export const C2Act2: Story = { name: 'Ch2 Act 2', args: { initialActId: 'c2act2' } }
export const C2Act3: Story = { name: 'Ch2 Act 3', args: { initialActId: 'c2act3' } }
export const C2Act4: Story = { name: 'Ch2 Act 4', args: { initialActId: 'c2act4' } }
export const C2Act5: Story = { name: 'Ch2 Act 5', args: { initialActId: 'c2act5' } }
export const World: Story = { name: 'World Battles', args: { initialActId: 'world' } }
