import React from 'react'

interface Props {
  active: boolean
  gold?: boolean
  onClick: () => void
  children: React.ReactNode
  /** Battle stance options can be unavailable (cooldown, sudden death). */
  disabled?: boolean
  title?: string
}

/** One selectable option inside a FilterPopup (TYPE/RARITY/SORT/... rows). */
export function FilterOption({ active, gold, onClick, children, disabled = false, title }: Props) {
  return (
    <button
      className={`filter-btn filter-btn--sm${active ? ' filter-btn--active' : ''}${gold ? ' filter-btn--gold' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}
