import React, { useState } from 'react'
import {
  AVATAR_SLUGS, AvatarSlug,
  loadPlayerName, savePlayerName,
  loadPlayerAvatar, savePlayerAvatar,
} from '../game/questline'

const SPRITE_BASE = '/jarvs-amazing-web-game/sprites/'

const AVATAR_LABELS: Record<AvatarSlug, string> = {
  'jarv':       'Blue Cloak',
  'jarv-red':   'Red Cloak',
  'jarv-green': 'Green Cloak',
  'jarv-gold':  'Gold Cloak',
}

interface Props {
  onDone: () => void
}

export function CharacterScreen({ onDone }: Props) {
  const [name,   setName]   = useState(loadPlayerName())
  const [avatar, setAvatar] = useState<AvatarSlug>(loadPlayerAvatar())

  function handleSave() {
    savePlayerName(name)
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
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div style={{ margin: '1.2rem 0 0.5rem' }}>
        <div style={{ color: '#aaffaa', fontSize: '0.8rem', marginBottom: '0.6rem' }}>APPEARANCE</div>
        <div className="character-avatar-grid">
          {AVATAR_SLUGS.map(slug => (
            <button
              key={slug}
              className={`character-avatar-btn${avatar === slug ? ' character-avatar-btn--chosen' : ''}`}
              onClick={() => setAvatar(slug)}
            >
              <img
                src={`${SPRITE_BASE}${slug}.svg`}
                alt={AVATAR_LABELS[slug]}
                className="character-avatar-img"
              />
              <span className="character-avatar-label">{AVATAR_LABELS[slug]}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="action-btn action-btn--large" style={{ marginTop: '1.5rem' }} onClick={handleSave}>
        SAVE &amp; CONTINUE ›
      </button>
    </div>
  )
}
