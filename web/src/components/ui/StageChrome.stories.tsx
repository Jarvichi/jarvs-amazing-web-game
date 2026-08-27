import { within, expect } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { StageChrome } from './StageChrome'
import { Toolbar } from './Toolbar/Toolbar'
import { ToolbarButton } from './Toolbar/ToolbarButton'
import { ToolbarSpacer } from './Toolbar/ToolbarSpacer'

/** Stands in for a game canvas: something the chrome floats over, with a
 *  pattern busy enough to show what the bar does and doesn't cover. */
const stage = (children: React.ReactNode) => (
  <div style={{
    position: 'relative', width: '100%', height: 420, overflow: 'hidden',
    background: 'repeating-linear-gradient(45deg, #2d4a1e 0 24px, #375a24 24px 48px)',
  }}>
    {children}
  </div>
)

const meta = {
  component: StageChrome,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div className="game-container">{stage(<Story />)}</div>],
  args: {
    bar: (
      <Toolbar>
        <ToolbarButton icon="📋" title="Menu" />
        <ToolbarButton icon="🗺" title="World Map" />
        <ToolbarSpacer />
        <ToolbarButton icon="⚙" title="Settings" />
      </Toolbar>
    ),
  },
} satisfies Meta<typeof StageChrome>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** For a stage that bled past .game-container's gutter — the chrome puts the
 *  gutter back so the bar stays aligned with chrome on other screens. */
export const Bleed: Story = {
  args: { bleed: true },
}

/** Children anchor to the area *below* the bar, so a corner overlay written
 *  as `top: 16px` clears it rather than hiding under it. */
export const WithOverlayBelowBar: Story = {
  args: {
    children: (
      <div
        className="stage-chrome__control"
        style={{
          position: 'absolute', top: 16, right: 16, width: 96, height: 96,
          background: 'rgba(8,14,8,0.85)', border: '1px solid #88cc88',
        }}
      />
    ),
  },
}

/** The reason the layer spans the whole stage rather than just the bar's
 *  strip: children track the bar's real height with nothing to keep in sync.
 *  Asserts the overlay starts below the bar, not under it. */
export const OverlayClearsAWrappedBar: Story = {
  tags: ['ci'],
  args: {
    ...WithOverlayBelowBar.args,
    bar: (
      <Toolbar>
        {Array.from({ length: 14 }, (_, i) => (
          <ToolbarButton key={i} icon="⬛" label={`ITEM ${i + 1}`} title={`Item ${i + 1}`} />
        ))}
      </Toolbar>
    ),
  },
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector('.toolbar')!.getBoundingClientRect()
    const overlay = canvasElement.querySelector('.stage-chrome__control')!.getBoundingClientRect()

    // The bar really did wrap — otherwise this proves nothing.
    expect(bar.height).toBeGreaterThan(60)
    expect(overlay.top).toBeGreaterThanOrEqual(bar.bottom)
  },
}

/** The layer covers the world, so it must not swallow taps meant for it:
 *  only the bar and anything marked stage-chrome__control are interactive. */
export const PassesTapsThroughToTheStage: Story = {
  tags: ['ci'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chrome = canvasElement.querySelector('.stage-chrome')!.getBoundingClientRect()

    // Mid-stage, well below the bar: should hit the stage, not the chrome.
    const midHit = document.elementFromPoint(chrome.left + chrome.width / 2, chrome.top + chrome.height * 0.7)
    expect(midHit!.closest('.stage-chrome')).toBeNull()

    // The bar itself still takes its own taps.
    const button = canvas.getByTitle('Menu').getBoundingClientRect()
    const barHit = document.elementFromPoint(button.left + button.width / 2, button.top + button.height / 2)
    expect(barHit!.closest('.stage-chrome')).not.toBeNull()
  },
}
