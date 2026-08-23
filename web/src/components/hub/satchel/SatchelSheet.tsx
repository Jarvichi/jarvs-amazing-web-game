import React from 'react'
import { ModalBackdrop } from '../../ui/ModalBackdrop'
import { SatchelNav } from './SatchelNav'
import type { SatchelSectionId } from './types'

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
  children: React.ReactNode
}

/** The menu shell: one header, one close button, one search field, one nav.
 *
 *  The old tabbed modal drew its title three times (backdrop label, shell tab
 *  label, and again inside every content component, each of which brought its
 *  own ✕ because each had been a standalone modal first). The shell owns all
 *  of that now, so content components render only content. */
export function SatchelSheet({
  title, meta, search, onClose, activeId, onSelect, badges, children,
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
          <button type="button" className="satchel-sheet__close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div
          className="satchel-sheet__body"
          id="satchel-panel"
          role="tabpanel"
          aria-labelledby={`satchel-tab-${activeId}`}
          tabIndex={0}
        >
          {children}
        </div>

        <SatchelNav activeId={activeId} onSelect={onSelect} badges={badges} />
      </div>
    </ModalBackdrop>
  )
}

/** Shown when a filtered list comes back empty. */
export function SatchelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="satchel-empty">{children}</p>
}
