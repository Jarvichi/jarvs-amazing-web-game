import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PackPurchaseConfirmModal } from './PackPurchaseConfirmModal'

const meta = {
  component: PackPurchaseConfirmModal,
  title: 'Shop/PackPurchaseConfirmModal',
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PackPurchaseConfirmModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { packQty: 8, totalCost: 2000, onCancel: fn(), onConfirm: fn() },
}

export const SinglePack: Story = {
  args: { packQty: 1, totalCost: 250, onCancel: fn(), onConfirm: fn() },
}
