import { useState } from 'react'
import { fn, within, expect } from 'storybook/test'
import { page } from 'vitest/browser'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SatchelSheet, SatchelEmpty } from './SatchelSheet'
import { GroupHeading } from './GroupHeading'
import { ActionCard } from './ActionCard'
import { ListRow } from './ListRow'
import { CollapsibleGroup } from './CollapsibleGroup'
import { EntityChip } from './EntityChip'
import type { SatchelSectionId } from './types'

function Interactive({ initial, empty, longList }: { initial: SatchelSectionId; empty?: boolean; longList?: boolean }) {
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

          {longList && Array.from({ length: 40 }, (_, i) => (
            <ListRow key={i} icon="✅" title={`Finished quest ${i + 1}`} value="+40 💎" tone="dim" />
          ))}
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

/** A phone-sized section with more rows than fit must scroll inside its own
 *  body, and the nav must stay on screen.
 *
 *  This has to run at phone width: ModalBackdrop centres its wrapper div, so
 *  the wrapper is content-sized and the sheet's `height: 100%` resolved to
 *  `auto` — the sheet grew to 1553px inside an 844px viewport, its body never
 *  overflowed, and the nav sat 355px below the fold. The desktop layout sets
 *  an explicit height and so never showed the bug, which is why this asserts
 *  at 390x844 rather than the default viewport.
 *
 *  Measured with offsetHeight, not getBoundingClientRect: the panel's entry
 *  animation scales from 0.96, and a rect read mid-flight is short. */
export const ScrollsWhenContentOverflows: Story = {
  args: { initial: 'quests', longList: true },
  play: async () => {
    await page.viewport(390, 844)
    await new Promise(r => setTimeout(r, 400))

    const sheet = document.querySelector<HTMLElement>('.satchel-sheet')!
    const body  = document.querySelector<HTMLElement>('.satchel-sheet__body')!
    const nav   = document.querySelector<HTMLElement>('.satchel-nav')!

    // The sheet fits the viewport instead of growing to its content.
    expect(sheet.offsetHeight).toBeLessThanOrEqual(window.innerHeight)

    // The body is what overflows, and it actually scrolls.
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight)
    body.scrollTop = 9999
    expect(body.scrollTop).toBeGreaterThan(0)

    // The nav stays reachable at the bottom of the screen.
    expect(nav.offsetTop + nav.offsetHeight).toBeLessThanOrEqual(window.innerHeight)
  },
}

/** Opening the menu on a phone must not pop the keyboard open. The search
 *  field is the first focusable in the header, so ModalBackdrop used to focus
 *  it on mount; and at 11px iOS Safari zoomed the page in on it. */
export const DoesNotFocusTheSearchFieldOnOpen: Story = {
  args: { initial: 'quests' },
  play: async () => {
    const input = document.querySelector<HTMLInputElement>('.satchel-sheet__search input')!

    expect(document.activeElement).not.toBe(input)
    expect(document.activeElement).toBe(document.querySelector('.satchel-sheet__body'))

    // iOS zooms on focus for anything under 16px.
    expect(parseFloat(getComputedStyle(input).fontSize)).toBeGreaterThanOrEqual(16)
  },
}

/** Below 768px the nav is a bottom bar; above it becomes a left rail. */
export const Phone: Story = {
  args: { initial: 'today' },
  globals: { viewport: { value: 'mobile1' } },
}
