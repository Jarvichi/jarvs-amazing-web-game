import { useState } from 'react'
import { fn } from 'storybook/test'
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
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (<div className="game-container"><Story /></div>)],
} satisfies Meta<typeof Interactive>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { initial: 'today' } }
export const Empty: Story = { args: { initial: 'quests', empty: true } }

/** Below 768px the nav is a bottom bar; above it becomes a left rail. */
export const Phone: Story = {
  args: { initial: 'today' },
  globals: { viewport: { value: 'mobile1' } },
}
