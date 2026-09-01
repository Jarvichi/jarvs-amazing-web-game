import React from 'react'
import { ModalBackdrop } from '../../ui/ModalBackdrop'
import { TabNav, type TabNavItem } from '../../ui/TabNav'
import { SATCHEL_NAV, type SatchelNavItem, type SatchelSectionId } from './types'
import { CloseButton } from '../../ui/CloseButton'
import { EmptyState } from '../../ui/EmptyState'

interface Props {
  /** Section title — the ONLY place it is drawn. Content renders content. */
  title: string
  /** Right-aligned header figure, e.g. a crystal balance. */
  meta?: React.ReactNode
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder: string
  }
  onClose: () => void
  activeId: SatchelSectionId
  onSelect: (id: SatchelSectionId) => void
  badges?: Partial<Record<SatchelSectionId, boolean>>
  /** Override the nav's sections. Defaults to all five. */
  navItems?: SatchelNavItem[]
  children: React.ReactNode
}

/** The menu shell: one header, one close button, one search field, one nav.
 *
 *  The old tabbed modal drew its title three times (backdrop label, shell tab
 *  label, and again inside every content component, each of which brought its
 *  own ✕ because each had been a standalone modal first). The shell owns all
 *  of that now, so content components render only content. */
export function SatchelSheet({
  title, meta, search, onClose, activeId, onSelect, badges, navItems, children,
}: Props) {
  return (
    <ModalBackdrop onClose={onClose} title={title}>
      <div className="satchel-sheet">
        <header className="satchel-sheet__header">
          <h2 className="satchel-sheet__title">{title}</h2>
          {search && (
            <label className="satchel-sheet__search">
              <span className="satchel-sheet__search-glyph" aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search.value}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                onChange={e => search.onChange(e.target.value)}
              />
            </label>
          )}
          {meta != null && <span className="satchel-sheet__meta">{meta}</span>}
          <CloseButton onClick={onClose} size={16} />
        </header>

        <div
          className="satchel-sheet__body"
          id="satchel-panel"
          role="tabpanel"
          // Land here rather than on the search field, which would pop the
          // keyboard open every time the menu is opened on a phone.
          data-initial-focus=""
          aria-labelledby={`satchel-panel-tab-${activeId}`}
          tabIndex={0}
        >
          {children}
        </div>

        <TabNav
          placement="bar"
          items={(navItems ?? SATCHEL_NAV).map((item): TabNavItem<SatchelSectionId> => ({
            ...item,
            badge: badges?.[item.id] ?? item.badge,
          }))}
          activeId={activeId}
          onSelect={onSelect}
          ariaLabel="Satchel sections"
          panelId="satchel-panel"
        />
      </div>
    </ModalBackdrop>
  )
}

/** Shown when a filtered list comes back empty. The sheet retints the shared
 *  control through --empty-state-color rather than styling its own (satchel.css). */
export function SatchelEmpty({ children }: { children: React.ReactNode }) {
  return <EmptyState size="sm">{children}</EmptyState>
}
