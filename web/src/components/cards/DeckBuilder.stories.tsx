import { fn, within, userEvent, expect } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { DeckBuilder } from './DeckBuilder'

// Seeds a full 30-card deck so the split panel actually has something to
// size around — an empty/small deck degenerates to roughly the same layout
// regardless of whether the 45% cap works, which would make these stories
// pass even with the cap broken (#2210 shipped and reached a real device
// with exactly that gap in coverage).
function seedFullDeck() {
  const names = [
    'Goblin', 'Archer', 'Barbarian', 'Knight', 'Wizard', 'Barracks',
    'Stone Wall', 'Lumber Camp', 'Farm', 'Sharpen Blades',
  ]
  localStorage.setItem('jarv_deck', JSON.stringify(names.map(cardName => ({ cardName, count: 3 }))))
  localStorage.setItem('jarv_active_slot', 'a')
  localStorage.setItem('jarv_tutorials_seen', JSON.stringify(['deckbuilder']))
}
seedFullDeck()

const meta = {
  component: DeckBuilder,
  tags: ['ci'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      // DeckBuilder's split panel fills whatever height it's given — in the
      // real app that's .game-container's `height: 100vh`. Storybook mounts
      // stories bare with no such ancestor, so without an explicit height
      // here the split has nothing to fill and geometry assertions below
      // would measure a collapsed 0px container instead of the real layout.
      // This is exactly what made #2209's fix look broken during manual
      // verification until the gap was found (see PR #2209/#2210 history).
      <div style={{ height: 780, width: 400, display: 'flex', flexDirection: 'column' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DeckBuilder>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onBack: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('30/30 cards')

    const deckPanel = canvasElement.querySelector<HTMLElement>('.deckbuilder-top-panel')
    const collectionPanel = canvasElement.querySelector<HTMLElement>('.deckbuilder-bottom-panel')
    if (!deckPanel || !collectionPanel) throw new Error('deck builder panels not found')

    const deckHeight = deckPanel.getBoundingClientRect().height
    const collectionHeight = collectionPanel.getBoundingClientRect().height

    // Both panels open by default — neither should be collapsed to a bare
    // header (~32-45px). This is the state #2212 exists to protect: a
    // percentage max-height against an auto-height flex parent can silently
    // stop resolving on some engines, letting the deck panel claim the
    // entire split and push the collection off-screen.
    expect(deckHeight, 'deck panel height').toBeGreaterThan(60)
    expect(collectionHeight, 'collection panel height').toBeGreaterThan(60)

    // The deck panel is capped at 45% of the split — with a full 30-card
    // deck it should be pressing against that cap, not sized arbitrarily.
    const total = deckHeight + collectionHeight
    const deckPct = (deckHeight / total) * 100
    expect(deckPct, `deck panel is ${deckPct.toFixed(1)}% of the split, expected roughly 45%`).toBeLessThan(50)
    expect(deckPct).toBeGreaterThan(35)
  },
}

export const WithFatiguedCards: Story = {
  args: {
    onBack: fn(),
    fatiguedCards: ['Goblin', 'Archer'],
  },
}

export const DeckPanelCollapsed: Story = {
  name: 'Deck panel collapsed',
  args: {
    onBack: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const collapseBtn = await canvas.findByTitle('Collapse deck panel')
    await userEvent.click(collapseBtn)

    const deckPanel = canvasElement.querySelector<HTMLElement>('.deckbuilder-top-panel')
    const collectionPanel = canvasElement.querySelector<HTMLElement>('.deckbuilder-bottom-panel')
    if (!deckPanel || !collectionPanel) throw new Error('deck builder panels not found')

    // The collection panel takes the space the deck panel gave up — #2208
    // shipped without this and the collapsed panel's space was left empty.
    expect(collectionPanel.getBoundingClientRect().height, 'collection panel height after collapsing deck').toBeGreaterThan(600)

    // Collapsed means "exactly its own header" — #2209 shipped a version
    // that pinned this to a fixed 32px against `overflow: hidden`, which
    // clipped a wrapped header and hid the only control that could expand
    // it again. Confirm the toggle itself is still findable and has a real,
    // non-zero size (jest-dom's toBeVisible() checks the full ancestor
    // chain up to document.body, which is stricter than this test harness
    // — a fixed 780px decorator height on the story root doesn't always
    // read as "visible" by that measure even though the element genuinely
    // renders; the bounding box is the ground truth).
    const expandBtn = await canvas.findByTitle('Expand deck panel')
    const expandBox = expandBtn.getBoundingClientRect()
    expect(expandBox.width, 'expand toggle width').toBeGreaterThan(0)
    expect(expandBox.height, 'expand toggle height').toBeGreaterThan(0)
    await userEvent.click(expandBtn)

    await canvas.findByTitle('Collapse deck panel')
    expect(deckPanel.getBoundingClientRect().height, 'deck panel height after re-expanding').toBeGreaterThan(60)
  },
}

export const CollectionPanelCollapsed: Story = {
  name: 'Collection panel collapsed',
  args: {
    onBack: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const collapseBtn = await canvas.findByTitle('Collapse collection panel')
    await userEvent.click(collapseBtn)

    const deckPanel = canvasElement.querySelector<HTMLElement>('.deckbuilder-top-panel')
    if (!deckPanel) throw new Error('deck panel not found')

    expect(deckPanel.getBoundingClientRect().height, 'deck panel height after collapsing collection').toBeGreaterThan(600)

    const expandBtn = await canvas.findByTitle('Expand collection panel')
    const expandBox = expandBtn.getBoundingClientRect()
    expect(expandBox.width, 'expand toggle width').toBeGreaterThan(0)
    expect(expandBox.height, 'expand toggle height').toBeGreaterThan(0)
    await userEvent.click(expandBtn)
    await canvas.findByTitle('Collapse collection panel')
  },
}
