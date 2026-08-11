import React from 'react'
import { useApp } from './AppContext'
import { CardTile } from '../components/cards/CardTile'
import { ConfirmModal } from '../components/modals/ConfirmModal'
import { StreakBrokenModal } from '../components/modals/StreakBrokenModal'
import { DeckSelectorModal } from '../components/cards/DeckSelectorModal'
import { DailyLoginModal } from '../components/screens/DailyLoginModal'
import { GiftClaimModal } from '../components/admin/GiftClaimModal'
import { RelicSpinScreen } from './lazyScreens'
import { getCardCatalog } from '../game/cards'
import {
  loadDeck, deckTotalCards, DECK_MAX, generatePack,
  addCardsToCollection, loadCrystals, saveCrystals,
} from '../game/collection'
import { clearRun, loadFatigued, addToConsumableStash } from '../game/questline'
import { markDailyRewardClaimed, addToInventory } from '../game/dailyLogin'
import { incrementAchievementProgress } from '../game/achievements'
import { describeReward } from '../game/chronicle'
import { getWeeklyChallenge } from '../game/weeklyChallenge'
import { getRelicDef } from '../game/relics'
import { applyGiftRewards } from '../game/gifts'
import { applySave, uploadSave } from '../game/cloudSave'
import { formatTimeAgo } from '../utils/formatTimeAgo'
import { journal } from '../utils/resumeJournal'

/**
 * Every overlay that is not keyed on the current screen — toasts, reward
 * reveals, confirmation modals and the service-worker update prompt.
 *
 * Extracted from App.tsx (#316). Each block is a verbatim move; all of these
 * carry an explicit z-index in styles.css, so rendering them together after the
 * route groups does not change how they stack.
 */
export function AppOverlays() {
  const {
    screen, setScreen, setRun, user, setCrystals, fatiguedCards,
    pendingEventCard, setPendingEventCard,
    deckWarningNode, setDeckWarningNode, skipDeckWarningRef,
    campaignRestingAlert, setCampaignRestingAlert,
    campaign2AbandonConfirm, setCampaign2AbandonConfirm,
    relicSpinData,
    integrityWarning, setIntegrityWarning,
    achievementToasts, setAchievementToasts,
    needRefresh, updateDismissed, setUpdateDismissed, updateServiceWorker,
    syncPrompt, clearSyncPrompt, flushPlaytimeToStorage,
    pendingGifts, setPendingGifts,
    showWinCelebration, setShowWinCelebration, celebrationMilestone,
    streakBrokenData, setStreakBrokenData,
    timeCapsuleVisible, setTimeCapsuleVisible,
    pendingBattleFn, setPendingBattleFn, pendingBattleIsCampaign,
    exoticDrop, setExoticDrop,
    questCompletes, setQuestCompletes,
    chronicleCompletes, setChronicleCompletes,
    weeklyReward, setWeeklyReward,
    dailyReward, setDailyReward,
    handleSelectNode, launchCampaign,
  } = useApp()

  return (
    <>
      {/* Event card reveal overlay */}
      {pendingEventCard && (() => {
        const catalog = getCardCatalog()
        const card = catalog.find(c => c.name === pendingEventCard)
        if (!card) { setPendingEventCard(null); return null }
        return (
          <div className="event-card-reveal-backdrop u-col u-items-c u-just-c u-gap-8" onClick={() => { setPendingEventCard(null); setScreen('nodemap') }}>
            <div className="event-card-reveal-label">YOU GAINED A CARD</div>
            <CardTile card={card} canAfford={true} />
            <div className="event-card-reveal-sub">Click anywhere to continue</div>
          </div>
        )
      })()}

      {deckWarningNode && (() => {
        const allEntries   = loadDeck()
        const fat          = loadFatigued()
        const restingCount = allEntries.filter(e => fat.includes(e.cardName)).length
        const totalCards   = deckTotalCards(allEntries)
        const isUnderMax   = totalCards < DECK_MAX
        const parts: string[] = []
        if (restingCount > 0)
          parts.push(`${restingCount} resting card${restingCount !== 1 ? 's' : ''} won't be available in battle`)
        if (isUnderMax)
          parts.push(`Your deck has only ${totalCards} of ${DECK_MAX} cards. Consider adding more cards in the Deck Builder for more consistency.`)
        return (
          <ConfirmModal
            title="Weak Deck"
            body={parts.join(' · ')}
            confirmLabel="Enter Battle"
            onConfirm={() => {
              const node = deckWarningNode
              setDeckWarningNode(null)
              skipDeckWarningRef.current = true
              handleSelectNode(node)
            }}
            onCancel={() => setDeckWarningNode(null)}
          />
        )
      })()}

      {campaignRestingAlert && (
        <ConfirmModal
          title="Deck Notice"
          body="Your deck may contain resting cards. They will not be available during campaign battles."
          confirmLabel="OK"
          onConfirm={() => setCampaignRestingAlert(false)}
          onCancel={() => setCampaignRestingAlert(false)}
        />
      )}

      {campaign2AbandonConfirm && (
        <ConfirmModal
          title="Abandon Current Run?"
          body="You have a campaign run in progress. Setting out for the Forgotten Kingdom will abandon it — unused consumables return to your stash, but map progress is lost."
          confirmLabel="Abandon & Set Out"
          onConfirm={() => {
            setCampaign2AbandonConfirm(false)
            clearRun(); setRun(null)
            launchCampaign('c2act1')
          }}
          onCancel={() => setCampaign2AbandonConfirm(false)}
        />
      )}

      {relicSpinData && (
        <RelicSpinScreen
          relicName={relicSpinData.relicName}
          relicIcon={relicSpinData.relicIcon}
          breaks={relicSpinData.breaks}
          brokenName={relicSpinData.brokenName}
          brokenIcon={relicSpinData.brokenIcon}
          brokenDesc={relicSpinData.brokenDesc}
          onContinue={relicSpinData.onContinue}
        />
      )}

      {/* Integrity warning */}
      {integrityWarning && (
        <div className="integrity-warning" role="alert">
          <span>⚠ Inventory data was modified externally. Play nice!</span>
          <button className="integrity-warning-dismiss" onClick={() => setIntegrityWarning(false)}>✕</button>
        </div>
      )}

      {/* Achievement unlock toast */}
      {achievementToasts.length > 0 && (
        <div className="ach-toast-stack">
          {achievementToasts.slice(0, 3).map((def, i) => (
            <div key={`${def.id}-${i}`} className="ach-toast" onClick={() => setAchievementToasts(prev => prev.filter((_, j) => j !== i))}>
              🏆 <strong>{def.name}</strong>
              <span className="ach-toast-sub">Achievement unlocked!</span>
            </div>
          ))}
        </div>
      )}

      {/* Service-worker update prompt — replaces the old force-reload-on-resume.
          The player reloads on their terms; dismiss hides it for the session.
          Only surfaced on the title screen or a hub town (screen 'hubworld' /
          'location', both rendered by HubWorld) — safe, non-disruptive spots to
          reload from, never mid-battle or in a menu. */}
      {needRefresh && !updateDismissed
        && (screen === 'title' || screen === 'hubworld' || screen === 'location') && (
        <div className="sw-update-toast">
          <span className="sw-update-toast-text">A new version is available.</span>
          <div className="sw-update-toast-actions">
            <button
              className="action-btn action-btn--sm"
              onClick={() => {
                journal('sw-update-accepted')
                updateServiceWorker(true)
              }}
            >
              UPDATE
            </button>
            <button
              className="sw-update-toast-dismiss"
              aria-label="Dismiss update"
              onClick={() => setUpdateDismissed(true)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {syncPrompt && (
        <div className="sync-prompt-backdrop">
          <div className="sync-prompt-modal">
            <div className="sync-prompt-header">☁ CLOUD SAVE FOUND</div>
            <div className="sync-prompt-sub">
              A newer save was detected on the server<br />
              ({formatTimeAgo(syncPrompt.remoteDate)})
            </div>
            <div className="sync-prompt-question">Which save would you like to keep?</div>
            <div className="sync-prompt-buttons u-col u-gap-4">
              <button className="action-btn" onClick={() => {
                applySave(syncPrompt.data)
                clearSyncPrompt()
                window.location.reload()
              }}>
                ☁ LOAD REMOTE
              </button>
              <button className="action-btn action-btn--dim" onClick={() => {
                clearSyncPrompt()
                const uid = user?.uid
                if (uid && !user?.isAnonymous) { flushPlaytimeToStorage(); uploadSave(uid).catch(() => {}) }
              }}>
                💾 KEEP LOCAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer gift modal — shown when unclaimed gifts exist in gifts.json */}
      {pendingGifts.length > 0 && !dailyReward && (
        <GiftClaimModal
          gifts={pendingGifts}
          onClaim={() => {
            let crystalsDelta = 0
            for (const gift of pendingGifts) {
              crystalsDelta += applyGiftRewards(gift)
            }
            if (crystalsDelta > 0) setCrystals(c => c + crystalsDelta)
            setPendingGifts([])
          }}
        />
      )}

      {/* Secret 10 — Wins Milestone Celebration */}
      {showWinCelebration && (() => {
        const isGrand = celebrationMilestone % 1000 === 0
        const isMajor = !isGrand && celebrationMilestone % 500 === 0
        const tier = isGrand ? 'grand' : isMajor ? 'major' : 'standard'
        const confettiCount = isGrand ? 60 : isMajor ? 45 : 30
        const crystalBonus = isGrand ? 100 : isMajor ? 50 : 0
        const legendaryCount = isGrand ? 2 : 1
        const modalClass = `win-celebration-modal${isGrand ? ' win-celebration-modal--grand' : isMajor ? ' win-celebration-modal--major' : ''}`
        return (
          <div className="win-celebration-backdrop">
            <div className={modalClass}>
              <div className="win-celebration-confetti" aria-hidden="true">
                {Array.from({ length: confettiCount }, (_, i) => (
                  <span key={i} className="confetti-char" style={{ '--i': i } as React.CSSProperties}>
                    {['★', '✦', '◆', '▲', '●', '✿'][i % 6]}
                  </span>
                ))}
              </div>
              <div className="win-celebration-header">
                🎉 {celebrationMilestone.toLocaleString()} VICTORIES! 🎉
              </div>
              <div className="win-celebration-body">
                {isGrand ? (
                  <>
                    <p>{celebrationMilestone.toLocaleString()} battles won. A true legend.</p>
                    <p>The world bows. History remembers.</p>
                    <p>You have earned {legendaryCount} legendary cards and {crystalBonus} 💎.</p>
                  </>
                ) : isMajor ? (
                  <>
                    <p>{celebrationMilestone.toLocaleString()} battles won. An epic achievement.</p>
                    <p>The enemy despairs. The chronicles take note.</p>
                    <p>You have earned a legendary card and {crystalBonus} 💎.</p>
                  </>
                ) : (
                  <>
                    <p>{celebrationMilestone.toLocaleString()} battles won.</p>
                    <p>The enemy trembles. The game developers are impressed.</p>
                    <p>You have earned a legendary card.</p>
                  </>
                )}
              </div>
              <button className="action-btn" onClick={() => {
                const pool = getCardCatalog().filter(c => c.rarity === 'legendary')
                if (pool.length > 0) {
                  const picks = Array.from({ length: legendaryCount }, () =>
                    ({ cardName: pool[Math.floor(Math.random() * pool.length)].name, count: 1 })
                  )
                  addCardsToCollection(picks)
                }
                if (crystalBonus > 0) {
                  const next = loadCrystals() + crystalBonus
                  saveCrystals(next)
                  setCrystals(next)
                }
                setShowWinCelebration(false)
              }}>
                {tier === 'grand' ? 'CLAIM GRAND REWARD' : tier === 'major' ? 'CLAIM EPIC REWARD' : 'CLAIM REWARD'}
              </button>
            </div>
          </div>
        )
      })()}

      {streakBrokenData && (
        <StreakBrokenModal
          streak={streakBrokenData.streak}
          bestStreak={streakBrokenData.bestStreak}
          onClose={() => setStreakBrokenData(null)}
        />
      )}

      {/* Secret 5 — Time Capsule: 100th battle milestone overlay */}
      {timeCapsuleVisible && (
        <div className="time-capsule-backdrop">
          <div className="time-capsule-modal">
            <div className="time-capsule-header">📦 TIME CAPSULE OPENED</div>
            <div className="time-capsule-body">
              <p>You've started your <strong>100th battle</strong>.</p>
              <p>Somewhere, a developer is crying tears of joy.</p>
              <p>You have been awarded a commemorative pack.</p>
            </div>
            <button className="action-btn" onClick={() => {
              const pack = generatePack()
              addCardsToCollection(pack.map(n => ({ cardName: n, count: 1 })))
              incrementAchievementProgress('misc:battle_100')
              setTimeCapsuleVisible(false)
            }}>
              CLAIM REWARD
            </button>
          </div>
        </div>
      )}

      {/* Deck selector — shown before quick battle / endless when Deck B has content */}
      {pendingBattleFn && (
        <DeckSelectorModal
          fatiguedCards={pendingBattleIsCampaign ? fatiguedCards : []}
          onConfirm={() => {
            const fn = pendingBattleFn
            setPendingBattleFn(null)
            fn()
          }}
          onCancel={() => setPendingBattleFn(null)}
        />
      )}

      {/* Exotic relic drop — gold reveal overlay, shown over whatever screen follows the battle */}
      {exoticDrop && (() => {
        const def = getRelicDef(exoticDrop)
        return (
          <div className="exotic-drop-overlay" onClick={() => setExoticDrop(null)}>
            <div className="exotic-drop-modal" onClick={e => e.stopPropagation()}>
              <div className="exotic-drop-title">✦ EXOTIC RELIC ACQUIRED ✦</div>
              <div className="exotic-drop-icon">{def?.icon ?? '✨'}</div>
              <div className="exotic-drop-name">{exoticDrop}</div>
              <div className="exotic-drop-desc">{def?.desc}</div>
              <button className="action-btn" onClick={() => setExoticDrop(null)}>TAKE IT</button>
            </div>
          </div>
        )
      })()}

      {/* Exotic quest chain completed — guaranteed card reveal */}
      {questCompletes.length > 0 && (
        <div className="exotic-drop-overlay" onClick={() => setQuestCompletes(prev => prev.slice(1))}>
          <div className="exotic-drop-modal" onClick={e => e.stopPropagation()}>
            <div className="exotic-drop-title">✦ QUEST COMPLETE ✦</div>
            <div className="exotic-drop-icon">{questCompletes[0].icon}</div>
            <div className="exotic-drop-name">{questCompletes[0].name}</div>
            <div className="exotic-drop-desc">
              <strong>{questCompletes[0].targetCard}</strong> has been added to your collection. Earned, not lucky.
            </div>
            <button className="action-btn" onClick={() => setQuestCompletes(prev => prev.slice(1))}>CLAIM</button>
          </div>
        </div>
      )}

      {/* Fracture Chronicle chapter completed — reward reveal */}
      {questCompletes.length === 0 && chronicleCompletes.length > 0 && (
        <div className="exotic-drop-overlay" onClick={() => setChronicleCompletes(prev => prev.slice(1))}>
          <div className="exotic-drop-modal" onClick={e => e.stopPropagation()}>
            <div className="exotic-drop-title">📜 CHAPTER COMPLETE 📜</div>
            <div className="exotic-drop-name">{chronicleCompletes[0].title}</div>
            <div className="exotic-drop-desc">
              The Chronicle remembers. You earned <strong>{describeReward(chronicleCompletes[0].reward)}</strong> and
              unlocked this chapter's Codex entry.
            </div>
            <button className="action-btn" onClick={() => setChronicleCompletes(prev => prev.slice(1))}>CLAIM</button>
          </div>
        </div>
      )}

      {/* Weekly challenge first win — Chronicle Fragment reward */}
      {weeklyReward && (
        <div className="exotic-drop-overlay" onClick={() => setWeeklyReward(null)}>
          <div className="exotic-drop-modal" onClick={e => e.stopPropagation()}>
            <div className="exotic-drop-title">📜 WEEKLY CHALLENGE COMPLETE 📜</div>
            <div className="exotic-drop-icon">{weeklyReward.combined ? '💠' : '📜'}</div>
            <div className="exotic-drop-name">{getWeeklyChallenge().loreTitle}</div>
            <div className="exotic-drop-desc">
              {weeklyReward.combined
                ? <>Your Chronicle Fragments fused into an <strong>Exotic Relic Shard</strong>! Shards: {weeklyReward.shards}.</>
                : <>You earned a <strong>Chronicle Fragment</strong> ({weeklyReward.fragments}/3). Three fragments fuse into an Exotic Relic Shard.</>}
            </div>
            <button className="action-btn" onClick={() => setWeeklyReward(null)}>CLAIM</button>
          </div>
        </div>
      )}

      {/* Daily login reward modal — shown as overlay on first visit each day */}
      {dailyReward && (
        <DailyLoginModal
          reward={dailyReward}
          onClose={() => {
            // Mark claimed and grant the reward only when user taps CLAIM
            markDailyRewardClaimed()
            const catalog = getCardCatalog()
            if (dailyReward.type === 'crystals' && dailyReward.amount) {
              const next = loadCrystals() + dailyReward.amount
              saveCrystals(next)
              setCrystals(next)
            } else if (dailyReward.type === 'card' && dailyReward.cardName) {
              addCardsToCollection([{ cardName: dailyReward.cardName, count: 1 }])
            } else if (dailyReward.type === 'pack') {
              const n = dailyReward.count ?? 5
              const names = Array.from({ length: n }, () => catalog[Math.floor(Math.random() * catalog.length)].name)
              addCardsToCollection(names.map(name => ({ cardName: name, count: 1 })))
            } else if (dailyReward.type === 'item') {
              addToInventory(dailyReward)
            } else if (dailyReward.type === 'consumable' && dailyReward.consumableId) {
              addToConsumableStash(dailyReward.consumableId)
            } else {
              // Fallback: grant 10 crystals for unrecognised reward types
              const next = loadCrystals() + 10
              saveCrystals(next)
              setCrystals(next)
            }
            setDailyReward(null)
          }}
        />
      )}
    </>
  )
}
