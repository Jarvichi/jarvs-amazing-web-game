import React, { useState, useCallback } from 'react'
import {
  ACHIEVEMENT_DEFS, AchievementDef, AchievementCategory,
  loadAchievementSave, claimAchievementReward, claimAllAchievementRewards,
} from '../../game/achievements'
import { OverlayScreen } from '../ui/OverlayScreen'
import { addCardsToCollection, loadCrystals, saveCrystals } from '../../game/collection'
import { addToInventory, ALL_ITEMS } from '../../game/dailyLogin'
import { addUnlockedAvatar } from '../../game/questline'

interface Props {
  onBack:              () => void
  onCrystalsChanged:   (n: number) => void
}

const CATEGORY_ORDER: AchievementCategory[] = [
  'campaign', 'daily', 'playtime', 'misc', 'events', 'kills', 'structures',
]
const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  campaign:   'Campaign',
  daily:      'Daily',
  playtime:   'Playtime',
  misc:       'Misc',
  events:     'Events',
  kills:      'Kills',
  structures: 'Structures',
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">
      <rect x="11" y="27" width="10" height="2" rx="1" fill="#8a6000"/>
      <rect x="9"  y="24" width="14" height="4" rx="1" fill="#aa7800"/>
      <rect x="14" y="18" width="4"  height="7" fill="#aa7800"/>
      <path d="M8 6 Q8 19 16 19 Q24 19 24 6 Z" fill="#ffcc00"/>
      <rect x="8"  y="5"  width="16" height="3" rx="1" fill="#ffe040"/>
      <path d="M8 8 Q3 8 3 13 Q3 17 8 16"  fill="none" stroke="#ffcc00" strokeWidth="2.5"/>
      <path d="M24 8 Q29 8 29 13 Q29 17 24 16" fill="none" stroke="#ffcc00" strokeWidth="2.5"/>
    </svg>
  )
}

function PlinthIcon() {
  return (
    <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">
      <rect x="7"  y="27" width="18" height="3" rx="1" fill="#3a3a4a"/>
      <rect x="10" y="13" width="12" height="15" rx="2" fill="#2a2a3a"/>
      <rect x="12" y="15" width="8"  height="11" rx="1" fill="#1e1e2a"/>
      <text x="16" y="24" textAnchor="middle" fontSize="9" fill="#4a4a6a" fontFamily="monospace">?</text>
    </svg>
  )
}

function formatRewardLine(def: AchievementDef): string {
  const r = def.reward
  const parts: string[] = []
  if (r.type === 'avatar' && r.avatarSlug)  parts.push('New avatar')
  if (r.type === 'crystals' && r.crystals)  parts.push(`💎 ${r.crystals}`)
  if (r.type === 'cards' && r.cardName)     parts.push(`${r.count}× ${r.cardName}`)
  if (r.type === 'item' && r.item)          parts.push(`${r.item.icon} ${r.item.name}`)
  if (r.bonusCrystals)                      parts.push(`💎 ${r.bonusCrystals}`)
  if (r.bonusCards)  parts.push(r.bonusCards.map(c => `${c.count}× ${c.cardName}`).join(', '))
  return parts.join(' + ') || '—'
}

export function HallOfAchievements({ onBack, onCrystalsChanged }: Props) {
  const [save, setSave]               = useState(() => loadAchievementSave())
  const [activeCategory, setCategory] = useState<AchievementCategory>('campaign')
  const [selected, setSelected]       = useState<AchievementDef | null>(null)
  const [justClaimed, setJustClaimed] = useState<string | null>(null)

  const handleClaim = useCallback((def: AchievementDef) => {
    const reward = claimAchievementReward(def.id)
    if (!reward) return
    let crystalDelta = 0
    if (reward.type === 'crystals' && reward.crystals)  crystalDelta += reward.crystals
    if (reward.bonusCrystals)                           crystalDelta += reward.bonusCrystals
    if (crystalDelta > 0) {
      const next = loadCrystals() + crystalDelta
      saveCrystals(next)
      onCrystalsChanged(next)
    }
    if (reward.type === 'cards' && reward.cardName && reward.count)
      addCardsToCollection([{ cardName: reward.cardName, count: reward.count }])
    if (reward.bonusCards) addCardsToCollection(reward.bonusCards)
    if (reward.type === 'item' && reward.item) {
      const full = ALL_ITEMS.find(i => i.id === reward.item!.id) ?? { ...reward.item, lore: '', weight: 1 }
      addToInventory(full)
    }
    if (reward.avatarSlug) addUnlockedAvatar(reward.avatarSlug)
    setSave(loadAchievementSave())
    setJustClaimed(def.id)
    setTimeout(() => setJustClaimed(null), 1800)
  }, [onCrystalsChanged])

  const handleClaimAll = useCallback(() => {
    const results = claimAllAchievementRewards()
    if (results.length === 0) return
    let crystalDelta = 0
    for (const { reward } of results) {
      if (reward.type === 'crystals' && reward.crystals) crystalDelta += reward.crystals
      if (reward.bonusCrystals) crystalDelta += reward.bonusCrystals
      if (reward.type === 'cards' && reward.cardName && reward.count)
        addCardsToCollection([{ cardName: reward.cardName, count: reward.count }])
      if (reward.bonusCards) addCardsToCollection(reward.bonusCards)
      if (reward.type === 'item' && reward.item) {
        const full = ALL_ITEMS.find(i => i.id === reward.item!.id) ?? { ...reward.item, lore: '', weight: 1 }
        addToInventory(full)
      }
      if (reward.avatarSlug) addUnlockedAvatar(reward.avatarSlug)
    }
    if (crystalDelta > 0) {
      const next = loadCrystals() + crystalDelta
      saveCrystals(next)
      onCrystalsChanged(next)
    }
    setSave(loadAchievementSave())
  }, [onCrystalsChanged])

  const defs = ACHIEVEMENT_DEFS.filter(d => d.category === activeCategory)

  const claimableInCategory = (cat: AchievementCategory) =>
    ACHIEVEMENT_DEFS.filter(d => d.category === cat && save.unlocked[d.id] && !save.claimed[d.id]).length

  const totalClaimable = ACHIEVEMENT_DEFS.filter(d => save.unlocked[d.id] && !save.claimed[d.id]).length

  const selectedUnlocked = selected ? !!save.unlocked[selected.id]  : false
  const selectedClaimed  = selected ? !!save.claimed[selected.id]   : false
  const selectedProgress = selected ? (save.progress[selected.progressKey] ?? 0) : 0

  return (
    <OverlayScreen title="HALL OF ACHIEVEMENTS" onBack={onBack}>
      {/* Category tabs */}
      <div className="hoa-tabs">
        {CATEGORY_ORDER.map(cat => {
          const badge = claimableInCategory(cat)
          return (
            <button
              key={cat}
              className={`hoa-tab${cat === activeCategory ? ' hoa-tab--active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
              {badge > 0 && <span className="hoa-badge">{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* Claim all bar */}
      {totalClaimable > 0 && (
        <div className="hoa-claim-bar">
          <span className="hoa-claim-bar-label">{totalClaimable} reward{totalClaimable !== 1 ? 's' : ''} ready</span>
          <button className="action-btn action-btn--gold action-btn--sm" onClick={handleClaimAll}>
            Claim All
          </button>
        </div>
      )}

      {/* Trophy grid */}
      <div className="hoa-grid">
        {defs.map(def => {
          const unlocked = !!save.unlocked[def.id]
          const claimed  = !!save.claimed[def.id]
          const canClaim = unlocked && !claimed
          return (
            <button
              key={def.id}
              className={`hoa-tile${unlocked ? ' hoa-tile--unlocked' : ''}${canClaim ? ' hoa-tile--claimable' : ''}`}
              onClick={() => setSelected(def)}
              title={unlocked ? def.name : '???'}
            >
              <div className="hoa-tile-icon">
                {unlocked ? <TrophyIcon /> : <PlinthIcon />}
              </div>
              <div className="hoa-tile-name">
                {unlocked ? def.name : '???'}
              </div>
              {canClaim && <div className="hoa-tile-dot" />}
            </button>
          )
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="hoa-backdrop" onClick={() => setSelected(null)}>
          <div className="hoa-modal" onClick={e => e.stopPropagation()}>
            <div className="hoa-modal-icon">
              {selectedUnlocked ? <TrophyIcon /> : <PlinthIcon />}
            </div>
            <div className="hoa-modal-name">
              {selectedUnlocked ? selected.name : '???'}
            </div>
            {selectedUnlocked && (
              <div className="hoa-modal-desc">{selected.description}</div>
            )}
            <div className="hoa-modal-criteria">
              {selectedUnlocked
                ? `Criteria: ${selectedProgress.toLocaleString()} / ${selected.target.toLocaleString()}`
                : `Progress: ${selectedProgress.toLocaleString()} / ${selected.target.toLocaleString()}`}
            </div>
            <div className="hoa-modal-reward">
              Reward: {formatRewardLine(selected)}
            </div>
            {selectedUnlocked && (
              <div className="hoa-modal-unlocked">UNLOCKED ✓</div>
            )}
            {selectedUnlocked && !selectedClaimed && (
              <button
                className={`action-btn action-btn--gold${justClaimed === selected.id ? ' action-btn--dim' : ''}`}
                onClick={() => handleClaim(selected)}
                disabled={justClaimed === selected.id}
              >
                {justClaimed === selected.id ? 'Claimed!' : 'Claim Reward'}
              </button>
            )}
            {selectedClaimed && (
              <div className="hoa-modal-claimed">Reward Collected</div>
            )}
            <button className="action-btn hoa-modal-close" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </OverlayScreen>
  )
}
