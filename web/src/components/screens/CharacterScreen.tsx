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
import { Panel } from '../ui/Panel'
import { Section } from '../ui/Section'
import { Button } from '../ui/Button'
import { TabNav } from '../ui/TabNav'
import { AvatarGrid, type AvatarGridEntry } from './player/AvatarGrid'
import { ArchetypeGrid } from './player/ArchetypeGrid'

const BASE_AVATAR_LABELS: Record<string, string> = {
  'jarv':       'Blue Cloak',
  'jarv-red':   'Red Cloak',
  'jarv-green': 'Green Cloak',
  'jarv-gold':  'Gold Cloak',
}

interface Props {
  onDone: () => void
  embedded?: boolean
}

/** Allow only alphanumeric characters (a-z, A-Z, 0-9). */
function sanitiseName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ')
}

function toAvatarEntries(slugs: readonly string[], labels: Record<string, string>): AvatarGridEntry[] {
  return slugs.map(slug => ({ slug, label: labels[slug] ?? slug, unlocked: isAvatarUnlocked(slug) }))
}

type AvatarTab = 'base' | 'streak' | 'boss'

export function CharacterScreen({ onDone, embedded }: Props) {
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

  const inner = (
    <div className="character-screen-scroll">
      <Panel elevation="raised" runeCorners className="character-frame">
        <div className="settings-panel-title">WHO ARE YOU?</div>

        <Section title="NAME">
          <input
            className="character-name-input"
            type="text"
            maxLength={20}
            value={name}
            placeholder="Jarv"
            onChange={e => handleNameChange(e.target.value)}
          />
          {nameError && <div className="character-name-error">{nameError}</div>}
        </Section>

        <Section title="APPEARANCE">
          <TabNav
            items={[
              { id: 'base',   label: 'Base' },
              { id: 'streak', label: 'Win Streak' },
              { id: 'boss',   label: 'Boss' },
            ]}
            activeId={activeTab}
            onSelect={setActiveTab}
            ariaLabel="Avatar categories"
          />

          {activeTab === 'base' && (
            <AvatarGrid
              entries={toAvatarEntries(BASE_AVATAR_SLUGS, BASE_AVATAR_LABELS)}
              chosen={avatar}
              onChoose={slug => setAvatar(slug as AvatarSlug)}
            />
          )}

          {activeTab === 'streak' && (
            <AvatarGrid
              entries={toAvatarEntries(STREAK_AVATAR_SLUGS, STREAK_AVATAR_LABELS)}
              chosen={avatar}
              onChoose={slug => setAvatar(slug as AvatarSlug)}
              lockHint="complete a win streak achievement"
            />
          )}

          {activeTab === 'boss' && (
            <AvatarGrid
              entries={toAvatarEntries(BOSS_AVATAR_SLUGS, BOSS_AVATAR_LABELS)}
              chosen={avatar}
              onChoose={slug => setAvatar(slug as AvatarSlug)}
              lockHint="defeat this act's boss"
            />
          )}
        </Section>

        <Section title="ARCHETYPE">
          <ArchetypeGrid
            defs={archetypeDefs}
            selected={archetype}
            onChoose={id => { setArchetype(id); savePlayerArchetype(id) }}
          />
        </Section>

        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? 'CHECKING NAME…' : 'SAVE & CONTINUE ›'}
        </Button>
      </Panel>
    </div>
  )

  if (embedded) return inner
  return <OverlayScreen title="Character" onBack={onDone}>{inner}</OverlayScreen>
}
