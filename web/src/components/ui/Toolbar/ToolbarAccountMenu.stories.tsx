import { fn, within, userEvent, expect } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { User } from 'firebase/auth'
import { Toolbar } from './Toolbar'
import { ToolbarButton } from './ToolbarButton'
import { ToolbarSpacer } from './ToolbarSpacer'
import { ToolbarAccountMenu } from './ToolbarAccountMenu'

const signedIn = { isAnonymous: false, displayName: 'Jarvichi', email: null } as unknown as User

const meta = {
  component: ToolbarAccountMenu,
  parameters: { layout: 'fullscreen' },
  // Rendered inside a real Toolbar: the inline/dropdown swap is a container
  // query on .toolbar, and the button styling is scoped to it too, so the
  // component looks like nothing at all on its own.
  decorators: [(Story) => (
    <div className="game-container">
      <Toolbar>
        <ToolbarButton icon="📋" title="Menu" />
        <ToolbarButton icon="🗺" title="World Map" />
        <ToolbarSpacer />
        <Story />
      </Toolbar>
    </div>
  )],
  args: {
    user: signedIn,
    playerName: 'Jarvichi',
    onSignIn: fn(),
    onSignOut: fn(),
    onPlayerTap: fn(),
    onFeedback: fn(),
    onSettings: fn(),
  },
} satisfies Meta<typeof ToolbarAccountMenu>

export default meta
type Story = StoryObj<typeof meta>

/** Wide toolbar — the rows sit inline, icon-only, matching the bar's other buttons. */
export const Inline: Story = {}

export const SignedOut: Story = {
  args: { user: null },
}

/** Bars with no settings of their own (HubWorldMap) omit the row entirely. */
export const WithoutSettings: Story = {
  args: { onSettings: undefined },
}

/** Narrow toolbar — everything collapses behind one ▾ trigger. */
export const Collapsed: Story = {
  globals: { viewport: { value: 'mobile1' } },
}

/** The open menu: one row style, one width, aligned icon column, text labels.
 *  This is the state the redesign was about — it used to stack three
 *  differently-styled, unlabelled buttons. */
export const MenuOpen: Story = {
  tags: ['ci'],
  globals: { viewport: { value: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByTitle('Account'))

    // Every row is the same kind of button, so they can all be found the same way.
    const rows = canvasElement.querySelectorAll('.toolbar-menu-item')
    expect(rows).toHaveLength(3)
    expect(canvas.getByText('Feedback')).toBeInTheDocument()
    expect(canvas.getByText('Settings')).toBeInTheDocument()
  },
}

/** Each row fires its own handler — a regression guard for the wiring slip
 *  this component replaced, where HubWorldMap's gear called onBack. */
export const MenuRowsRouteCorrectly: Story = {
  tags: ['ci'],
  globals: { viewport: { value: 'mobile1' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByTitle('Account'))

    await userEvent.click(canvas.getByText('Settings'))
    expect(args.onSettings).toHaveBeenCalledTimes(1)
    expect(args.onFeedback).not.toHaveBeenCalled()

    await userEvent.click(canvas.getByTitle('Account'))
    await userEvent.click(canvas.getByText('Feedback'))
    expect(args.onFeedback).toHaveBeenCalledTimes(1)
  },
}
