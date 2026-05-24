import React, { useState } from 'react'
import {
  BASE_AVATAR_SLUGS, STREAK_AVATAR_SLUGS, STREAK_AVATAR_LABELS, AvatarSlug,
  BOSS_AVATAR_SLUGS, BOSS_AVATAR_LABELS,
  loadPlayerName, savePlayerName,
  loadPlayerAvatar, savePlayerAvatar,
  isAvatarUnlocked,
  getArchetypeDefs, loadPlayerArchetype, savePlayerArchetype, loadActCount,
} from '../../game/questline'
import type { Archetype } from '../../game/types'
import { auth } from '../../firebase'
import { claimPlayerName } from '../../game/playerName'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Button } from '../ui/Button'

const SPRITE_BASE = '/sprites/'

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

function AvatarButton({ slug, chosen, onClick, lockHint }: { slug: string; chosen: boolean; onClick: () => void; lockHint?: string }) {
  const unlocked = isAvatarUnlocked(slug)
  const label = BASE_AVATAR_LABELS[slug] ?? STREAK_AVATAR_LABELS[slug] ?? BOSS_AVATAR_LABELS[slug] ?? slug
  const hint = lockHint ?? 'locked'
  return (
    <button
      className={`character-avatar-btn${chosen ? ' character-avatar-btn--chosen' : ''}${!unlocked ? ' character-avatar-btn--locked' : ''}`}
      onClick={unlocked ? onClick : undefined}
      title={unlocked ? label : `${label} — ${hint}`}
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

type AvatarTab = 'base' | 'streak' | 'boss'

export function CharacterScreen({ onDone }: Props) {
  const [name,      setName]      = useState(loadPlayerName())
  const [nameChanged, setNameChanged] = useState(false)
  const [avatar,    setAvatar]    = useState<AvatarSlug>(loadPlayerAvatar())
  const [saving,    setSaving]    = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AvatarTab>('base')
  const [archetype, setArchetype] = useState<Archetype | null>(loadPlayerArchetype())
  const archetypeDefs = getArchetypeDefs(loadActCount('actfinale'))

  async function handleSave() {

    if (nameChanged) {
    const finalName = sanitiseName(name).trim() || 'Jarv'
    const user = auth.currentUser
    if (user) {
      setSaving(true)
      setNameError(null)
      const result = await claimPlayerName(user.uid, user.isAnonymous, finalName)
      setSaving(false)
      if (!result.ok) {
        setNameError('That name is already taken. Please choose another.')
        return
      }
    }
    savePlayerName(finalName)
  }
    savePlayerAvatar(avatar)
    if (archetype) savePlayerArchetype(archetype)
    onDone()
  }

  async function handleNameChange(newName: string) {
    const sanitised = sanitiseName(newName)

    if (newName === name) {
      // No change, do nothing
      return
    }

    setName(sanitised)
    setNameChanged(true)
    setNameError(null) 
  }

  return (
    <OverlayScreen title="Character" onBack={onDone}>
    <div className="character-screen-scroll">
      <div className="event-screen" >
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
            onChange={e =>handleNameChange(e.target.value)}
          />
          {nameError && (
            <div style={{ color: '#ff6666', fontSize: '0.75rem', marginTop: '0.3rem' }}>
              {nameError}
            </div>
          )}
        </div>

        <div style={{ margin: '1.2rem 0 0.5rem', width: '100%' }}>
          <div style={{ color: '#aaffaa', fontSize: '0.8rem', marginBottom: '0.6rem' }}>APPEARANCE</div>

          <div className="character-avatar-tabs">
            <button
              className={`character-avatar-tab${activeTab === 'base' ? ' character-avatar-tab--active' : ''}`}
              onClick={() => setActiveTab('base')}
            >
              BASE
            </button>
            <button
              className={`character-avatar-tab${activeTab === 'streak' ? ' character-avatar-tab--active' : ''}`}
              onClick={() => setActiveTab('streak')}
            >
              WIN STREAK
            </button>
            <button
              className={`character-avatar-tab${activeTab === 'boss' ? ' character-avatar-tab--active' : ''}`}
              onClick={() => setActiveTab('boss')}
            >
              BOSS
            </button>
          </div>

          {activeTab === 'base' && (
            <div className="character-avatar-grid">
              {BASE_AVATAR_SLUGS.map(slug => (
                <AvatarButton key={slug} slug={slug} chosen={avatar === slug} onClick={() => setAvatar(slug)} />
              ))}
            </div>
          )}

          {activeTab === 'streak' && (
            <div className="character-avatar-grid">
              {STREAK_AVATAR_SLUGS.map(slug => (
                <AvatarButton
                  key={slug}
                  slug={slug}
                  chosen={avatar === slug}
                  onClick={() => setAvatar(slug as AvatarSlug)}
                  lockHint="complete a win streak achievement"
                />
              ))}
            </div>
          )}

          {activeTab === 'boss' && (
            <div className="character-avatar-grid">
              {BOSS_AVATAR_SLUGS.map(slug => (
                <AvatarButton
                  key={slug}
                  slug={slug}
                  chosen={avatar === slug}
                  onClick={() => setAvatar(slug as AvatarSlug)}
                  lockHint="defeat this act's boss"
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ margin: '1.2rem 0 0.5rem', width: '100%' }}>
          <div style={{ color: '#aaffaa', fontSize: '0.8rem', marginBottom: '0.6rem' }}>ARCHETYPE</div>
          <div className="character-archetype-grid">
            {archetypeDefs.map(def => (
              <button
                key={def.id}
                className={`character-archetype-btn${archetype === def.id ? ' character-archetype-btn--chosen' : ''}${def.locked ? ' character-archetype-btn--locked' : ''}`}
                onClick={def.locked ? undefined : () => setArchetype(def.id)}
                title={def.locked ? `${def.name} — complete the campaign to unlock` : def.name}
              >
                {archetype === def.id && (
                  <span className="character-archetype-selected-badge">✓ SELECTED</span>
                )}
                <span className="character-archetype-icon">{def.locked ? '🔒' : def.icon}</span>
                <span className="character-archetype-name">{def.locked ? '???' : def.name}</span>
                {!def.locked && <span className="character-archetype-identity">{def.identity}</span>}
                {!def.locked && <span className="character-archetype-passive">{def.passive}</span>}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          size={'lg'}
        >
          {saving ? 'CHECKING NAME…' : 'SAVE & CONTINUE ›'}
        </Button>
      </div>
    </div>
    </OverlayScreen>
  )
}
