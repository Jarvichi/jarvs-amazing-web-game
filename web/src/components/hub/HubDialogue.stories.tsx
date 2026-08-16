import { fn } from 'storybook/test'
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubDialogue } from './HubDialogue'

const meta = {
  component: HubDialogue,
  render: (args) => {
    const [line, setLine] = useState(args.line)
    return <HubDialogue line={line} onClose={() => setLine(null)} />
  },
} satisfies Meta<typeof HubDialogue>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    line: 'The roads beyond the outer walls grow darker by the day. Tread carefully, wanderer.',
    onClose: fn(),
  },
}

export const Closed: Story = {
  args: {
    line: null,
    onClose: fn(),
  },
}

// A self-contained branching conversation: root node offers three choices that
// lead to two different endings, demonstrating the choice-branch rendering.
const BRANCH_TREE: Record<string, { text: string; choices: { label: string; next?: string }[] }> = {
  root: {
    text: 'You again, wanderer. The watch could use sharp eyes tonight — or perhaps you only came to talk?',
    choices: [
      { label: 'I can stand watch with you', next: 'accept' },
      { label: "Tell me about Ravenwatch", next: 'lore' },
      { label: 'Just passing through', next: 'leave' },
    ],
  },
  accept: {
    text: 'Good. Keep to the wall and call out anything that moves. We hold the line together.',
    choices: [{ label: 'Understood', next: undefined }],
  },
  lore: {
    text: 'These walls have weathered three sieges. The ravens stayed through every one — that is how we earned the name.',
    choices: [
      { label: "That's reassuring", next: 'leave' },
      { label: 'Back', next: 'root' },
    ],
  },
  leave: {
    text: 'Safe roads, then. The gate closes at dusk.',
    choices: [{ label: 'Farewell', next: undefined }],
  },
}

export const Branching: Story = {
  args: { line: BRANCH_TREE.root.text, onClose: fn() },
  render: () => {
    const [nodeId, setNodeId] = useState<string | null>('root')
    const node = nodeId ? BRANCH_TREE[nodeId] : null
    return (
      <HubDialogue
        line={node?.text ?? null}
        speakerName="Watch Captain Vane"
        onClose={() => setNodeId(null)}
        choices={node?.choices.map((c, i) => ({
          label:   c.label,
          primary: i === 0,
          onClick: () => setNodeId(c.next ?? null),
        }))}
      />
    )
  },
}

// A shop's "buy" reaction (#1661/#1664): tapping a for-sale item shows the
// shopkeeper's blurb + price, Buy confirms and sells, Maybe not just closes.
// Demonstrates both a day shopkeeper (Gildwyn) and his night counterpart
// (Vorn) — the same purchase flow, different in-character voice.
function buyStory(speakerName: string, itemName: string, price: number): Story {
  return {
    args: { line: `Care to buy ${itemName} for ${price} crystals?`, speakerName, onClose: fn() },
    render: () => {
      const [text, setText] = useState<string | null>(`Care to buy ${itemName} for ${price} crystals?`)
      const [done, setDone] = useState(false)
      return (
        <HubDialogue
          line={text}
          speakerName={speakerName}
          onClose={() => setText(null)}
          choices={done ? undefined : [
            { label: `Buy for ${price} 💎`, primary: true, onClick: () => { setDone(true); setText(`Sold! Enjoy the ${itemName}.`) } },
            { label: 'Maybe not', onClick: () => setText(null) },
          ]}
        />
      )
    },
  }
}

export const GildwynShopGreeting: Story = buyStory('Gildwyn', 'Frost Wyrm', 600)
export const VornShopGreeting: Story = buyStory('Vorn', 'Ashen Sovereign', 1200)

// A tradeHubItem-style sell menu (Fishwife Marta's fish tiers): long enough
// to exceed the game container's height, so the choice list scrolls inside
// its own max-height instead of clipping off-screen. Also mixes in disabled
// (greyed-out) entries, as the choices the player doesn't currently hold.
const FISH_TIER_LABELS = [
  'Tiddler — 3 💎', 'Small Fish — 6 💎', 'Medium Fish — 12 💎', 'Large Fish — 25 💎',
  'Trophy Fish — 45 💎', 'Legendary Fish — 90 💎', 'Shoal — 3 💎', 'Reef Fish — 6 💎',
  'Deep Shelf Fish — 12 💎', 'Open Water Fish — 25 💎', 'Deep Sea Fish — 45 💎', 'Abyss Tide Fish — 90 💎',
]

export const LongSellMenu: Story = {
  args: { line: "Let's see the catch, then. What are you selling?", speakerName: 'Fishwife Marta', onClose: fn() },
  render: () => (
    <HubDialogue
      line="Let's see the catch, then. What are you selling?"
      speakerName="Fishwife Marta"
      onClose={fn()}
      choices={[
        ...FISH_TIER_LABELS.map((label, i) => ({ label, disabled: i % 3 === 0, onClick: fn() })),
        { label: "That's all for now.", isExit: true, onClick: fn() },
      ]}
    />
  ),
}
