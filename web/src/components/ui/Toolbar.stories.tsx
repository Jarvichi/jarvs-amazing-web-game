import React from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toolbar, ToolbarButton, ToolbarDropdown } from './Toolbar'

const meta = {
  component: Toolbar,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Toolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {} as any,
  render: () => (
    <Toolbar>
      <ToolbarButton onClick={fn()}>👷 BUILD</ToolbarButton>
      <ToolbarButton onClick={fn()}>🛡 FORTS</ToolbarButton>
      <ToolbarButton onClick={fn()}>🌾 FARM</ToolbarButton>
      <ToolbarButton onClick={fn()}>⚔ DEFEND</ToolbarButton>
    </Toolbar>
  ),
}

export const WithActiveButton: Story = {
  args: {} as any,
  render: () => (
    <Toolbar>
      <ToolbarButton active onClick={fn()}>🧱 DEMOLISH</ToolbarButton>
      <ToolbarButton onClick={fn()}>🛡 FORTS</ToolbarButton>
      <ToolbarButton disabled onClick={fn()}>🌾 FARM 🔒</ToolbarButton>
    </Toolbar>
  ),
}

export const WithDropdown: Story = {
  args: {} as any,
  render: () => (
    <Toolbar>
      <ToolbarButton onClick={fn()}>👷 BUILD</ToolbarButton>
      <ToolbarDropdown label="⋯ MORE">
        <ToolbarButton onClick={fn()}>📜 HISTORY</ToolbarButton>
        <ToolbarButton onClick={fn()}>📊 STATS</ToolbarButton>
        <ToolbarButton onClick={fn()}>🗺 ZONES</ToolbarButton>
        <ToolbarButton onClick={fn()}>🏢 EXPAND</ToolbarButton>
      </ToolbarDropdown>
    </Toolbar>
  ),
}
