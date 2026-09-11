import React from 'react'
import { Icon } from '../../ui/icons/Icon'

const SPRITE_BASE = '/sprites/'

export interface AvatarGridEntry {
  slug: string
  label: string
  unlocked: boolean
}

interface AvatarButtonProps {
  entry: AvatarGridEntry
  chosen: boolean
  onClick: () => void
  lockHint: string
}

function AvatarButton({ entry, chosen, onClick, lockHint }: AvatarButtonProps) {
  const { slug, label, unlocked } = entry
  return (
    <button
      className={`character-avatar-btn${chosen ? ' character-avatar-btn--chosen' : ''}${!unlocked ? ' character-avatar-btn--locked' : ''}`}
      onClick={unlocked ? onClick : undefined}
      title={unlocked ? label : `${label} — ${lockHint}`}
    >
      {unlocked ? (
        <img src={`${SPRITE_BASE}${slug}.svg`} alt={label} className="character-avatar-img" />
      ) : (
        <span className="character-avatar-lock"><Icon name="lock" size={16} /></span>
      )}
      <span className="character-avatar-label">{unlocked ? label : '???'}</span>
    </button>
  )
}

interface Props {
  entries: AvatarGridEntry[]
  chosen: string
  onChoose: (slug: string) => void
  /** Shown in a locked tile's tooltip — how this avatar gets unlocked. */
  lockHint?: string
}

/** One row of avatar choices — used for the base, win-streak and boss-defeat
 *  categories alike, which differ only in which slugs and unlock hint they pass in. */
export function AvatarGrid({ entries, chosen, onChoose, lockHint = 'locked' }: Props) {
  return (
    <div className="character-avatar-grid">
      {entries.map(entry => (
        <AvatarButton
          key={entry.slug}
          entry={entry}
          chosen={chosen === entry.slug}
          onClick={() => onChoose(entry.slug)}
          lockHint={lockHint}
        />
      ))}
    </div>
  )
}
