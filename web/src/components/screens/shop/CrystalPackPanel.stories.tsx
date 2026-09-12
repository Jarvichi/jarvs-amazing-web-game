import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CrystalPackPanel } from './CrystalPackPanel'

const meta = {
  component: CrystalPackPanel,
  title: 'Shop/CrystalPackPanel',
  parameters: { layout: 'padded' },
  // FilterChips reads colour from --row-*, which ShopScreen's own
  // .shop-wrapper defines — reproduced here so the chips aren't unstyled.
  decorators: [(Story) => <div className="shop-wrapper"><Story /></div>],
} satisfies Meta<typeof CrystalPackPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Affordable: Story = {
  args: { packQty: 1, maxPackQty: 8, canBuyPack: true, crystals: 2000, crystalPackCost: 250, onQtyChange: fn(), onBuyClick: fn() },
}

export const MaxSelected: Story = {
  args: { packQty: 8, maxPackQty: 8, canBuyPack: true, crystals: 2000, crystalPackCost: 250, onQtyChange: fn(), onBuyClick: fn() },
}

export const TooPoor: Story = {
  args: { packQty: 1, maxPackQty: 0, canBuyPack: false, crystals: 50, crystalPackCost: 250, onQtyChange: fn(), onBuyClick: fn() },
}
