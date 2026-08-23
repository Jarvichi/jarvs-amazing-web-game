import { useState } from 'react'
import { fn, within, expect } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SatchelSheet, SatchelEmpty } from './SatchelSheet'
import { GroupHeading } from './GroupHeading'
import { ActionCard } from './ActionCard'
import { ListRow } from './ListRow'
import { CollapsibleGroup } from './CollapsibleGroup'
import { EntityChip } from './EntityChip'
import type { SatchelSectionId } from './types'

function Interactive({ initial, empty }: { initial: SatchelSectionId; empty?: boolean }) {
  const [activeId, setActiveId] = useState<SatchelSectionId>(initial)
  const [query, setQuery] = useState('')

  return (
    <SatchelSheet
      title="Ravenwatch"
      meta="💎 500"
      search={{ value: query, onChange: setQuery, placeholder: 'Search everything' }}
      onClose={fn()}
      activeId={activeId}
      onSelect={setActiveId}
      badges={{ codex: true }}
    >
      {empty ? (
        <SatchelEmpty>Nothing here yet — talk to the townsfolk.</SatchelEmpty>
      ) : (
        <>
          <GroupHeading tone="gold" count={1}>Do this now</GroupHeading>
          <ActionCard
            title="The Merchant's Ingredient — ready"
            detail={<>Hand Moonleaf Herb to <EntityChip label="Mira" onClick={fn()} /> · Market Row</>}
            actionLabel="SHOW ON MAP"
            onAction={fn()}
          />

          <GroupHeading count={2}>In progress</GroupHeading>
          <ListRow icon="📜" title="Bait for Greyfish" subtitle="Catch Greyfish" value="2/4" progress={{ current: 2, required: 4 }} onClick={fn()} />
          <ListRow icon="🎯" title="Cellar Sweep" subtitle="Clear the crates · +60 💎" value="5/8" progress={{ current: 5, required: 8, tone: 'gold' }} onClick={fn()} />

          <CollapsibleGroup title="✅ Completed" count={108}>
            <ListRow icon="✅" title="Feed the Stray" value="+40 💎" tone="dim" />
            <ListRow icon="✅" title="Where's Rover?" value="+35 💎" tone="dim" />
          </CollapsibleGroup>
        </>
      )}
    </SatchelSheet>
  )
}

const meta = {
  component: Interactive,
  tags: ['ci'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (<div className="game-container"><Story /></div>)],
} satisfies Meta<typeof Interactive>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { initial: 'today' } }
export const Empty: Story = { args: { initial: 'quests', empty: true } }

/** The whole point of the shell: the old menu drew its title three times and
 *  offered two close buttons, because each section had been a standalone modal
 *  first. One of each, or this fails. */
export const OwnsItsChromeExactlyOnce: Story = {
  args: { initial: 'today' },
  play: async () => {
    // The sheet is portaled to document.body by ModalBackdrop.
    const body = within(document.body)
    expect(body.getAllByRole('button', { name: 'Close' })).toHaveLength(1)
    expect(body.getAllByRole('heading', { name: 'Ravenwatch' })).toHaveLength(1)
    expect(body.getAllByRole('tabpanel')).toHaveLength(1)
  },
}

/** Below 768px the nav is a bottom bar; above it becomes a left rail. */
export const Phone: Story = {
  args: { initial: 'today' },
  globals: { viewport: { value: 'mobile1' } },
}
