import { fn, within, userEvent, expect } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubStatusBar } from './HubStatusBar'

const meta = {
  component: HubStatusBar,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (<div className="game-container"><Story /></div>)],
  args: {
    townName: 'Ravenwatch',
    festivalLabel: null,
    crystals: 8924,
    timeLabel: '07:14',
    isNight: false,
    wrongSaveCrystals: null,
    onOpenMenu: fn(),
    worldMapLocked: false,
    onWorldMap: fn(),
    onWorldMapLocked: fn(),
    user: null,
    playerName: 'Commander',
    onSignIn: fn(),
    onSignOut: fn(),
    onPlayerTap: fn(),
    onFeedback: fn(),
    onSettings: fn(),
  },
} satisfies Meta<typeof HubStatusBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Night: Story = {
  args: { isNight: true, timeLabel: '22:40' },
}

/** The world map button stays visible and tappable while locked — it
 *  explains why via onWorldMapLocked instead of just sitting dim and inert.
 *  The old button used HTML `disabled`, which blocks onClick outright; a tap
 *  did nothing, with no way to find out why on a touchscreen. */
export const WorldMapLocked: Story = {
  args: { worldMapLocked: true },
}

/** Regression guard for that fix: tapping the locked button must route to
 *  onWorldMapLocked, never onWorldMap — and the reverse once it's unlocked. */
export const WorldMapClickRouting: Story = {
  tags: ['ci'],
  args: { worldMapLocked: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const mapButton = canvas.getByTitle('World Map — locked')

    await userEvent.click(mapButton)
    expect(args.onWorldMapLocked).toHaveBeenCalledTimes(1)
    expect(args.onWorldMap).not.toHaveBeenCalled()
  },
}

export const DuringAFestival: Story = {
  args: { festivalLabel: '🎪 Harvest Fair' },
}

/** Secret #9 (Wrong Save File) — a momentary glitch on the crystal count. */
export const WrongSaveGlitch: Story = {
  args: { wrongSaveCrystals: 41 },
}

/** Below the toolbar's container-query breakpoint, sign-in/feedback/settings
 *  collapse into the account dropdown instead of sitting inline. */
export const NarrowViewport: Story = {
  globals: { viewport: { value: 'mobile1' } },
}

/** The account menu open on a phone — the state the bar redesign was about.
 *  Rows share one style and carry labels; see ToolbarAccountMenu.stories for
 *  the menu's own coverage. */
export const AccountMenuOpen: Story = {
  globals: { viewport: { value: 'mobile1' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByTitle('Account'))
  },
}
