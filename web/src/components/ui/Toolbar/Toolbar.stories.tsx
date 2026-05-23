import React from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toolbar } from './Toolbar'
import { ToolbarButton } from './ToolbarButton'
import { ToolbarDropdown } from './ToolbarDropdown'
import { ToolbarLabel } from './ToolbarLabel'
import { ToolbarSpacer } from './ToolbarSpacer'
import { ToolbarSubComponent } from './ToolbarSubComponent'
import { ToolBarZoomControls } from './ToolBarZoomControls'

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
      <ToolbarButton onClick={fn()} label="BUILD" icon="👷" />
      <ToolbarButton onClick={fn()} label="FORTS" icon="🛡" />
      <ToolbarButton onClick={fn()} label="FARM" icon="🌾" />
      <ToolbarButton onClick={fn()} label="DEFEND" icon="⚔" />
      <ToolBarZoomControls scale={1.5} onZoomIn={fn()} onZoomOut={fn()} onZoomTo={fn()} />
    </Toolbar>
  ),
}

export const WithActiveButton: Story = {
  args: {} as any,
  render: () => (
    <Toolbar>
      <ToolbarButton active onClick={fn()} label="DEMOLISH" icon="🧱" />
      <ToolbarButton onClick={fn()} label="FORTS" icon="🛡" />
      <ToolbarButton locked onClick={fn()} label="FARM" icon="🌾" />
    </Toolbar>
  ),
}

export const WithLabel: Story = {
  args: {} as any,
  render: () => (
    <Toolbar>
      <ToolbarLabel>MODE</ToolbarLabel>
      <ToolbarButton onClick={fn()} label="BUILD" icon="👷" />
      <ToolbarButton active onClick={fn()} label="DEMOLISH" icon="🧱" />
      <ToolbarLabel spaced>VIEW</ToolbarLabel>
      <ToolbarButton onClick={fn()} label="STATS" icon="📊" />
      <ToolbarButton onClick={fn()} label="HISTORY" icon="📜" />
    </Toolbar>
  ),
}

export const WithDropdown: Story = {
  args: {} as any,
  render: () => (
    <Toolbar>
      <ToolbarButton onClick={fn()} label="BUILD" icon="👷" />
      <ToolbarDropdown label="⋯ MORE">
        <ToolbarButton onClick={fn()} label="HISTORY" icon="📜" />
        <ToolbarButton onClick={fn()} label="STATS" icon="📊" />
        <ToolbarButton onClick={fn()} label="ZONES" icon="🗺" />
        <ToolbarButton onClick={fn()} label="EXPAND" icon="🏢" />
      </ToolbarDropdown>
    </Toolbar>
  ),
}

export const WithSpacerAndRightDropdown: Story = {
  args: {} as any,
  render: () => (
    <Toolbar>
      <ToolbarButton onClick={fn()} label="BUILD" icon="👷" />
      <ToolbarButton onClick={fn()} label="FORTS" icon="🛡" />
      <ToolbarButton locked onClick={fn()} label="FARM" icon="🌾" />
      <ToolbarButton onClick={fn()} label="DEFEND" icon="⚔" />
      <ToolbarSpacer />
      <ToolbarDropdown align="right" label="⋯ MORE">
        <ToolbarButton onClick={fn()} label="HISTORY" icon="📜" />
        <ToolbarButton onClick={fn()} label="STATS" icon="📊" />
        <ToolbarButton onClick={fn()} label="ZONES" icon="🗺" />
        <ToolbarButton onClick={fn()} label="EXPAND" icon="🏢" />
      </ToolbarDropdown>
    </Toolbar>
  ),
}

export const WithSubComponent: Story = {
  args: {} as any,
  render: () => (
    <Toolbar>
      <ToolbarButton onClick={fn()} label="BUILD" icon="👷" />
      <ToolbarSubComponent onClick={fn()} title="Custom sub-component">
        ⚙ CUSTOM
      </ToolbarSubComponent>
      <ToolbarSubComponent active onClick={fn()}>
        ★ ACTIVE
      </ToolbarSubComponent>
    </Toolbar>
  ),
}
