import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SellSlotRow } from './SellSlotRow'

const meta = {
  component: SellSlotRow,
  title: 'Shop/SellSlotRow',
  parameters: { layout: 'padded' },
  // ListRow reads colour from --row-*, which ShopScreen's own .shop-wrapper
  // defines — reproduced here so the row isn't unstyled.
  decorators: [(Story) => <div className="shop-wrapper"><Story /></div>],
} satisfies Meta<typeof SellSlotRow>

export default meta
type Story = StoryObj<typeof meta>

const BASE = { icon: '🫧', name: 'Unpoppable Bubble', desc: 'Has refused to pop since 2003.', npcName: 'Seraph' }

export const DontHaveIt: Story = {
  args: { ...BASE, hasItem: false, alreadySold: false, apprenticeWillBuy: false, message: null, onSell: fn() },
}

export const HaveIt: Story = {
  args: { ...BASE, hasItem: true, alreadySold: false, apprenticeWillBuy: false, message: null, onSell: fn() },
}

export const ApprenticeDeal: Story = {
  args: { ...BASE, hasItem: true, alreadySold: false, apprenticeWillBuy: true, message: null, onSell: fn() },
}

export const RejectedWithMessage: Story = {
  args: { ...BASE, hasItem: true, alreadySold: true, apprenticeWillBuy: false, message: "Hmm. Close, but this one has too much character. I need a mint-condition specimen.", onSell: fn() },
}
