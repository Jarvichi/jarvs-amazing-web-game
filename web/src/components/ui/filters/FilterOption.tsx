import React from 'react'

interface Props {
  active: boolean
  gold?: boolean
  onClick: () => void
  children: React.ReactNode
}

/** One selectable option inside a FilterPopup (TYPE/RARITY/SORT/... rows). */
export function FilterOption({ active, gold, onClick, children }: Props) {
  return (
    <button
      className={`filter-btn filter-btn--sm${active ? ' filter-btn--active' : ''}${gold ? ' filter-btn--gold' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
