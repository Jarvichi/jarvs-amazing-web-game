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
