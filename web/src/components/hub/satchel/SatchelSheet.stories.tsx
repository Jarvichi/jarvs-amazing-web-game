import { useState } from 'react'
import { fn, within, expect, userEvent } from 'storybook/test'
import { page } from 'vitest/browser'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SatchelSheet, SatchelEmpty } from './SatchelSheet'
import { GroupHeading } from './GroupHeading'
import { ActionCard } from './ActionCard'
import { ListRow } from './ListRow'
import { CollapsibleGroup } from './CollapsibleGroup'
import { EntityChip } from './EntityChip'
import type { SatchelSectionId } from './types'

/** What SatchelMenu actually puts in the header, per section: a figure on
 *  Quests/Town/Codex, a search field on Satchel/Quests, and nothing at all on
 *  Today. Mirrored here because that variance is what the shell has to absorb
 *  — every combination has to produce the same header. */
const SECTION_META: Partial<Record<SatchelSectionId, string>> = {
  quests: '3 active',
  town:   '💎 6,412',
  codex:  '68% complete',
}
const SECTION_SEARCH: Partial<Record<SatchelSectionId, string>> = {
  satchel: 'Search items',
  quests:  'Search quests',
}

function Interactive({ initial, empty, longList }: { initial: SatchelSectionId; empty?: boolean; longList?: boolean }) {
  const [activeId, setActiveId] = useState<SatchelSectionId>(initial)
  const [query, setQuery] = useState('')

  const placeholder = SECTION_SEARCH[activeId]

  return (
    <SatchelSheet
      title="Ravenwatch"
      meta={SECTION_META[activeId]}
      search={placeholder ? { value: query, onChange: setQuery, placeholder } : undefined}
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
    const nav   = document.querySelector<HTMLElement>('.tab-nav')!

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

/** The header has to be one fixed shape across all five sections.
 *
 *  It wasn't: each section put something different in it — a search field
 *  (Satchel, Quests), a figure (Town, Codex), or nothing (Today) — and the
 *  header sized itself to whatever that was. Switching tabs made the bar jump
 *  about 14px, and with nothing between the title and the ✕ to take up the
 *  slack the close button slid left to sit against the title, so it landed
 *  somewhere different on every section.
 *
 *  Measured rather than screenshotted: a few pixels of drift in the header is
 *  exactly the kind of thing that survives a look at a screenshot. */
export const HeaderIsTheSameShapeInEverySection: Story = {
  args: { initial: 'today' },
  play: async () => {
    // Both layouts: the sheet is a full-bleed sheet with a bottom bar below
    // 768px and a dialog with a left rail above it, and the header's padding
    // differs between them — so each has its own height to be consistent at.
    for (const [w, h] of [[390, 844], [1024, 800]] as const) {
      await page.viewport(w, h)
      await new Promise(r => setTimeout(r, 400))

      const tabs = Array.from(document.querySelectorAll<HTMLElement>('.tab-nav__item'))
      expect(tabs.length).toBeGreaterThan(1)

      const shapes: { width: number; section: string; height: number; closeRight: number }[] = []
      for (const tab of tabs) {
        await userEvent.click(tab)
        const header = document.querySelector<HTMLElement>('.satchel-sheet__header')!
        // The glyph, not the button box: the shared close control (#close-btn,
        // buttons.css) pads out to a 44px touch target and pulls the surplus
        // back with a negative margin, so its border box overhangs the header
        // on every side. What the eye tracks is the ✕ itself.
        const close  = document.querySelector<HTMLElement>('.close-btn svg')!
        shapes.push({
          width: w,
          section: tab.textContent ?? '',
          height: header.offsetHeight,
          // Distance from the right edge of the sheet, which is what the eye
          // tracks when the ✕ moves.
          closeRight: Math.round(header.getBoundingClientRect().right - close.getBoundingClientRect().right),
        })
      }

      // Every section, one height and one ✕ position.
      expect(new Set(shapes.map(s => s.height)).size, JSON.stringify(shapes)).toBe(1)
      expect(new Set(shapes.map(s => s.closeRight)).size, JSON.stringify(shapes)).toBe(1)
    }
  },
}

/** The bottom bar sits on the very edge of the screen, and on a phone that
 *  edge is neither straight nor entirely the app's: the home indicator runs
 *  along it and the rounded display corners cut into the outer two tabs. The
 *  labels were landing inside both. */
export const BarKeepsItsLabelsOffTheScreenEdge: Story = {
  args: { initial: 'today' },
  play: async () => {
    await page.viewport(390, 844)
    await new Promise(r => setTimeout(r, 400))

    const items = Array.from(document.querySelectorAll<HTMLElement>('.tab-nav--bar .tab-nav__item'))
    expect(items.length).toBeGreaterThan(1)

    for (const item of items) {
      expect(parseFloat(getComputedStyle(item).paddingBottom)).toBeGreaterThanOrEqual(26)
    }
    // Only the tabs next to a corner are inset horizontally.
    expect(parseFloat(getComputedStyle(items[0]).paddingLeft)).toBeGreaterThanOrEqual(10)
    expect(parseFloat(getComputedStyle(items[items.length - 1]).paddingRight)).toBeGreaterThanOrEqual(10)

    // A left rail touches neither, and the end-tab selectors must not leave it
    // with the bar's side padding — every rail item is padded the same.
    await page.viewport(1024, 800)
    await new Promise(r => setTimeout(r, 400))
    const rail = Array.from(document.querySelectorAll<HTMLElement>('.tab-nav--bar .tab-nav__item'))
    const pads = rail.map(i => getComputedStyle(i).padding)
    expect(new Set(pads).size, JSON.stringify(pads)).toBe(1)
  },
}
