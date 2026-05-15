import React, { useState, useCallback } from 'react'
import {
  ACHIEVEMENT_DEFS, AchievementDef, AchievementCategory,
  loadAchievementSave, claimAchievementReward, claimAllAchievementRewards,
} from '../../game/achievements'
import { OverlayScreen } from '../BuildingBlocks/OverlayScreen'
import { addCardsToCollection, loadCrystals, saveCrystals } from '../../game/collection'
import { addToInventory, ALL_ITEMS } from '../../game/dailyLogin'
import { addUnlockedAvatar } from '../../game/questline'

interface Props {
  onBack: () => void
  onCrystalsChanged: (n: number) => void
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  kills:      '⚔  UNIT KILLS',
  structures: '🏰  STRUCTURE DESTROYS',
  events:     '🎲  RARE EVENTS',
  campaign:   '🗺  CAMPAIGN',
  misc:       '✨  MISC',
  daily:      '📅  DAILY CHALLENGE',
  playtime:   '⏱  PLAY TIME',
}

const CATEGORY_ORDER: AchievementCategory[] = ['daily', 'campaign', 'playtime', 'misc', 'events', 'kills', 'structures']

function formatReward(def: AchievementDef): string {
  const r = def.reward
  const parts: string[] = []
  if (r.type === 'avatar' && r.avatarSlug)  parts.push(`🎭 New avatar`)
  if (r.type === 'crystals' && r.crystals)  parts.push(`💎 ${r.crystals}`)
  if (r.type === 'cards' && r.cardName)     parts.push(`${r.count}× ${r.cardName}`)
  if (r.type === 'item' && r.item)          parts.push(`${r.item.icon} ${r.item.name}`)
  if (r.bonusCrystals)                      parts.push(`💎 ${r.bonusCrystals}`)
  if (r.bonusCards)                         parts.push(r.bonusCards.map(c => `${c.count}× ${c.cardName}`).join(', '))
  return parts.join(' + ') || ''
}

function ProgressBar({ value, target }: { value: number; target: number }) {
  const pct = Math.min(1, value / target)
  const filled = Math.round(pct * 20)
  const empty  = 20 - filled
  return (
    <span className="ach-bar">
      {'█'.repeat(filled)}{'░'.repeat(empty)}
      {' '}{value.toLocaleString()}/{target.toLocaleString()}
    </span>
  )
}

export function AchievementsScreen({ onBack, onCrystalsChanged }: Props) {
  const [save, setSave] = useState(() => loadAchievementSave())
  const [claimed, setJustClaimed] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<AchievementCategory>('campaign')

  const handleClaim = useCallback((def: AchievementDef) => {
    const reward = claimAchievementReward(def.id)
    if (!reward) return

    // Process all reward fields — streak achievements may have several
    let crystalDelta = 0
    if (reward.type === 'crystals' && reward.crystals) crystalDelta += reward.crystals
    if (reward.bonusCrystals)                          crystalDelta += reward.bonusCrystals
    if (crystalDelta > 0) {
      const next = loadCrystals() + crystalDelta
      saveCrystals(next)
      onCrystalsChanged(next)
    }
    if (reward.type === 'cards' && reward.cardName && reward.count) {
      addCardsToCollection([{ cardName: reward.cardName, count: reward.count }])
    }
    if (reward.bonusCards) {
      addCardsToCollection(reward.bonusCards)
    }
    if (reward.type === 'item' && reward.item) {
      const full = ALL_ITEMS.find(i => i.id === reward.item!.id) ?? { ...reward.item, lore: '', weight: 1 }
      addToInventory(full)
    }
    if (reward.avatarSlug) {
      addUnlockedAvatar(reward.avatarSlug)
    }

    setSave(loadAchievementSave())
    setJustClaimed(def.id)
    setTimeout(() => setJustClaimed(null), 2000)
  }, [onCrystalsChanged])

  const handleClaimAll = useCallback(() => {
    const results = claimAllAchievementRewards()
    if (results.length === 0) return

    let crystalDelta = 0
    for (const { reward } of results) {
      if (reward.type === 'crystals' && reward.crystals) crystalDelta += reward.crystals
      if (reward.bonusCrystals)                          crystalDelta += reward.bonusCrystals
      if (reward.type === 'cards' && reward.cardName && reward.count) {
        addCardsToCollection([{ cardName: reward.cardName, count: reward.count }])
      }
      if (reward.bonusCards) {
        addCardsToCollection(reward.bonusCards)
      }
      if (reward.type === 'item' && reward.item) {
        const full = ALL_ITEMS.find(i => i.id === reward.item!.id) ?? { ...reward.item, lore: '', weight: 1 }
        addToInventory(full)
      }
      if (reward.avatarSlug) {
        addUnlockedAvatar(reward.avatarSlug)
      }
    }
    if (crystalDelta > 0) {
      const next = loadCrystals() + crystalDelta
      saveCrystals(next)
      onCrystalsChanged(next)
    }
    setSave(loadAchievementSave())
  }, [onCrystalsChanged])

  const defs = ACHIEVEMENT_DEFS
    .filter(d => d.category === activeCategory)
    .sort((a, b) => {
      const aUnclaimed = save.unlocked[a.id] && !save.claimed[a.id] ? 0 : 1
      const bUnclaimed = save.unlocked[b.id] && !save.claimed[b.id] ? 0 : 1
      return aUnclaimed - bUnclaimed
    })

  // Count claimable in each category for badge
  function claimableCount(cat: AchievementCategory) {
    return ACHIEVEMENT_DEFS.filter(d =>
      d.category === cat && save.unlocked[d.id] && !save.claimed[d.id]
    ).length
  }

  // Stats
  const totalUnlocked  = Object.values(save.unlocked).filter(Boolean).length
  const totalClaimed   = Object.values(save.claimed).filter(Boolean).length
  const total          = ACHIEVEMENT_DEFS.length
  const totalClaimable = ACHIEVEMENT_DEFS.filter(d => save.unlocked[d.id] && !save.claimed[d.id]).length

  return (
    <OverlayScreen
      title="🏆 ACHIEVEMENTS"
      onBack={onBack}
      right={<div className="ach-summary">{totalUnlocked}/{total} · {totalClaimed} claimed</div>}
    >

      {/* Category tabs */}
      <div className="ach-tabs">
        {CATEGORY_ORDER.map(cat => {
          const badge = claimableCount(cat)
          return (
            <button
              key={cat}
              className={`ach-tab${activeCategory === cat ? ' ach-tab--active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat].split('  ')[0]}
              {badge > 0 && <span className="ach-badge">{badge}</span>}
            </button>
          )
        })}
      </div>

      <div className="ach-claim-all-bar">
        <div className="ach-category-label">{CATEGORY_LABELS[activeCategory]}</div>
        {totalClaimable > 0 && (
          <button className="action-btn ach-claim-all-btn" onClick={handleClaimAll}>
            CLAIM ALL ({totalClaimable})
          </button>
        )}
      </div>

      <div className="ach-list">
        {defs.map(def => {
          const progress  = save.progress[def.progressKey] ?? 0
          const unlocked  = !!save.unlocked[def.id]
          const isClaimed = !!save.claimed[def.id]
          const justDone  = claimed === def.id

          return (
            <div
              key={def.id}
              className={`ach-row${unlocked ? ' ach-row--unlocked' : ''}${isClaimed ? ' ach-row--claimed' : ''}`}
            >
              <div className="ach-row-left">
                <div className="ach-tier">{def.tier === 2 ? '★★' : '★'}</div>
                <div className="ach-text">
                  <div className="ach-name">{unlocked ? '✓ ' : ''}{def.name}</div>
                  <div className="ach-desc">{def.description}</div>
                  {!isClaimed && (
                    <ProgressBar value={Math.min(progress, def.target)} target={def.target} />
                  )}
                  <div className="ach-reward">Reward: {formatReward(def)}</div>
                </div>
              </div>
              <div className="ach-row-right">
                {isClaimed ? (
                  <span className="ach-status-claimed">CLAIMED</span>
                ) : unlocked ? (
                  <button
                    className={`action-btn ach-claim-btn${justDone ? ' ach-claim-btn--done' : ''}`}
                    onClick={() => handleClaim(def)}
                  >
                    {justDone ? '✓ DONE' : 'CLAIM'}
                  </button>
                ) : (
                  <span className="ach-status-locked">🔒</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </OverlayScreen>
  )
}
