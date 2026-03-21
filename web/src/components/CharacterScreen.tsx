import React, { useState } from 'react'
import {
  BASE_AVATAR_SLUGS, STREAK_AVATAR_SLUGS, STREAK_AVATAR_LABELS, AvatarSlug,
  loadPlayerName, savePlayerName,
  loadPlayerAvatar, savePlayerAvatar,
  isAvatarUnlocked,
} from '../game/questline'

const SPRITE_BASE = '/jarvs-amazing-web-game/sprites/'

const BASE_AVATAR_LABELS: Record<string, string> = {
  'jarv':       'Blue Cloak',
  'jarv-red':   'Red Cloak',
  'jarv-green': 'Green Cloak',
  'jarv-gold':  'Gold Cloak',
}

interface Props {
  onDone: () => void
}

/** Allow only alphanumeric characters (a-z, A-Z, 0-9). */
function sanitiseName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ')
}

function AvatarButton({ slug, chosen, onClick }: { slug: string; chosen: boolean; onClick: () => void }) {
  const unlocked = isAvatarUnlocked(slug)
  const label = BASE_AVATAR_LABELS[slug] ?? STREAK_AVATAR_LABELS[slug] ?? slug
  return (
    <button
      className={`character-avatar-btn${chosen ? ' character-avatar-btn--chosen' : ''}${!unlocked ? ' character-avatar-btn--locked' : ''}`}
      onClick={unlocked ? onClick : undefined}
      title={unlocked ? label : `${label} — locked (win streak achievement)`}
    >
      {unlocked ? (
        <img src={`${SPRITE_BASE}${slug}.svg`} alt={label} className="character-avatar-img" />
      ) : (
        <span className="character-avatar-lock">🔒</span>
      )}
      <span className="character-avatar-label">{unlocked ? label : '???'}</span>
    </button>
  )
}

export function CharacterScreen({ onDone }: Props) {
  const [name,   setName]   = useState(loadPlayerName())
  const [avatar, setAvatar] = useState<AvatarSlug>(loadPlayerAvatar())

  function handleSave() {
    const finalName = sanitiseName(name).trim() || 'Jarv'
    savePlayerName(finalName)
    savePlayerAvatar(avatar)
    onDone()
  }

  return (
    <div className="event-screen" style={{ maxWidth: 480 }}>
      <div className="event-type-tag">[CHARACTER]</div>
      <div className="event-title">Who are you?</div>

      <div style={{ margin: '1rem 0 0.5rem' }}>
        <label style={{ color: '#aaffaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.4rem' }}>
          NAME
        </label>
        <input
          className="character-name-input"
          type="text"
          maxLength={20}
          value={name}
          placeholder="Jarv"
          onChange={e => setName(sanitiseName(e.target.value))}
        />
      </div>

      <div style={{ margin: '1.2rem 0 0.5rem' }}>
        <div style={{ color: '#aaffaa', fontSize: '0.8rem', marginBottom: '0.6rem' }}>APPEARANCE</div>
        <div className="character-avatar-grid">
          {BASE_AVATAR_SLUGS.map(slug => (
            <AvatarButton key={slug} slug={slug} chosen={avatar === slug} onClick={() => setAvatar(slug)} />
          ))}
        </div>

        <div style={{ color: '#aaffaa', fontSize: '0.75rem', margin: '1rem 0 0.6rem' }}>
          WIN STREAK AVATARS
        </div>
        <div className="character-avatar-grid">
          {STREAK_AVATAR_SLUGS.map(slug => (
            <AvatarButton
              key={slug}
              slug={slug}
              chosen={avatar === slug}
              onClick={() => setAvatar(slug as AvatarSlug)}
            />
          ))}
        </div>
      </div>

      <button className="action-btn action-btn--large" style={{ marginTop: '1.5rem' }} onClick={handleSave}>
        SAVE &amp; CONTINUE ›
      </button>
    </div>
  )
}
