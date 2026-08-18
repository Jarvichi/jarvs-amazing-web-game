import React, { useRef, useState, useEffect, useCallback } from 'react'
import { type User } from 'firebase/auth'
import { loadDeck, loadCollection, deckTotalCards, isDeckValid, COPIES_MAX, loadWinStreak, loadBestStreak } from '../../game/collection'
import { loadPlayerName, loadRunRaw } from '../../game/questline'
import { getCardCatalog } from '../../game/cards'
import { hasUnclaimedAchievements } from '../../game/achievements'
import { getDailyShopSellSlots } from '../../game/shopSchedule'
import { loadInventory } from '../../game/dailyLogin'
import { ConfirmModal } from '../modals/ConfirmModal'
import { TitleIdleAnimation } from './TitleIdleAnimation'
import { HeroAction } from './titlescreen/HeroAction'
import { SecondaryPlayRow } from './titlescreen/SecondaryPlayRow'
import { PeriodicRow } from './titlescreen/PeriodicRow'
import { UtilityRow } from './titlescreen/UtilityRow'
import { CityAlertBanner } from './titlescreen/CityAlertBanner'
import { ManageNav } from './titlescreen/ManageNav'
import { TitleIdentityFooter } from './titlescreen/TitleIdentityFooter'
import { load8bitUnlocked, unlock8bitMode, save8bitEnabled, apply8bitMode } from '../screens/SettingsScreen'
import { incrementAchievementProgress } from '../../game/achievements'
import { getDailyChallengeState, getDailyWinStreak } from '../../game/dailyChallenge'
import { getWeeklyChallengeState, getNextWeeklyReset } from '../../game/weeklyChallenge'
import { getUnreadChapterCount } from '../../game/chronicle'
import { generatePack, addCardsToCollection } from '../../game/collection'
import { WinStreak } from './WinStreak'
import { Icon } from '../ui/icons/Icon'
import { useToast } from '../ui/Toast'

const CAMPAIGN_UNLOCK_CARDS = 30
const EIGHTBIT_CLICKS = 8

// Konami code: Up Up Down Down Left Right Left Right
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight']
const KONAMI_KEY = 'jarv_konami_used'
function hasUsedKonami(): boolean { try { return !!localStorage.getItem(KONAMI_KEY) } catch { return false } }
function markKonamiUsed(): void   { try { localStorage.setItem(KONAMI_KEY, '1') } catch { /* ignore */ } }

/** "resets in Xh"/"resets in Xd Yh" style label for a periodic mode's reset time. */
function formatResetLabel(resetAt: Date): string {
  const ms = resetAt.getTime() - Date.now()
  if (ms <= 0) return 'resets soon'
  const hours = Math.ceil(ms / (60 * 60 * 1000))
  if (hours < 1) return 'resets soon'
  if (hours < 24) return `resets in ${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `resets in ${days}d ${remHours}h` : `resets in ${days}d`
}

function nextUtcMidnight(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
}

export interface Props {
  crystals: number
  onPlay: () => void
  onEndless: () => void
  onCampaign: () => void
  onCollection: () => void
  onShop: () => void
  onDeckBuilder: () => void
  onSettings: () => void
  onPlayer: () => void
  on8bitUnlocked?: () => void
  onDailyChallenge: () => void
  onWeeklyChallenge: () => void
  onEndlessLeaderboard: () => void
  onCommander?: () => void
  commanderName?: string | null
  onTraining: () => void
  onNews: () => void
  hasUnreadNews: boolean
  onMiniGames: () => void
  onCityBuilder: () => void
  onCodex: () => void
  onChronicle: () => void
  user: User | null
  onSignOut: () => void
  onSignIn: () => void
  onFeedback: () => void
  hubUnlocked?: boolean
  onHub?: () => void
}

export function TitleScreen({ crystals, onPlay, onEndless, onCampaign, onCollection, onShop, onDeckBuilder, onSettings, onPlayer, on8bitUnlocked, onDailyChallenge, onWeeklyChallenge, onEndlessLeaderboard, onCommander, commanderName, onTraining, onNews, hasUnreadNews, onMiniGames, onCityBuilder, onCodex, onChronicle, user, onSignOut, onSignIn, onFeedback, hubUnlocked, onHub }: Props) {
  const deck             = loadDeck()
  const count            = deckTotalCards(deck)
  const valid            = isDeckValid(deck)
  const savedRun         = loadRunRaw()
  const collection       = loadCollection()
  const totalOwned       = collection.reduce((s, e) => s + e.count, 0)
  const campaignUnlocked = savedRun !== null || totalOwned >= CAMPAIGN_UNLOCK_CARDS
  const catalog             = getCardCatalog()
  const distinctUnlocked    = collection.filter(e => e.count > 0 && catalog.some(c => c.name === e.cardName)).length
  const catalogTotal        = catalog.length
  const achievementAlert    = hasUnclaimedAchievements()
  const collectionAlert     = collection.some(e => e.count > COPIES_MAX)
  const shopAlert           = (() => { const inv = loadInventory(); return getDailyShopSellSlots().some(s => inv.some(i => i.id === s.id)) })()
  const winStreak           = loadWinStreak()
  const bestStreak          = loadBestStreak()
  const dailyChallenge      = getDailyChallengeState()
  const dailyStreak         = getDailyWinStreak()
  const chronicleAlert      = getUnreadChapterCount() > 0
  const playerName = loadPlayerName()

  // City attack alert — read directly from localStorage so App.tsx doesn't need changing
  const cityAttackAlert = (() => {
    try {
      const raw = localStorage.getItem('jarv_city_builder')
      if (!raw) return false
      const parsed = JSON.parse(raw) as { nextAttackAt?: number; lastAttack?: { outcome?: string } }
      const now = Date.now()
      const overdue = (parsed.nextAttackAt ?? Infinity) <= now
      const recentDefeat = parsed.lastAttack?.outcome === 'defeated' || parsed.lastAttack?.outcome === 'partial'
      return overdue || recentDefeat
    } catch { return false }
  })()

  const logoClickCount = useRef(0)
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [logoFlash, setLogoFlash] = useState(false)

  // Secret #1 — Konami Code
  const konamiProgress = useRef(0)
  const { showToast } = useToast()
  const handleKonami = useCallback((e: KeyboardEvent) => {
    if (e.key === KONAMI[konamiProgress.current]) {
      konamiProgress.current++
      if (konamiProgress.current === KONAMI.length) {
        konamiProgress.current = 0
        if (!hasUsedKonami()) {
          markKonamiUsed()
          const pack = generatePack()
          addCardsToCollection(pack.map(name => ({ cardName: name, count: 1 })))
          incrementAchievementProgress('misc:konami_code')
          showToast('↑↑↓↓←→←→  •  CHEAT ACCEPTED  •  Pack granted!', { variant: 'reward', duration: 4000 })
        } else {
          showToast('You already claimed this secret. Nice try.', { variant: 'info', duration: 3000 })
        }
      }
    } else {
      konamiProgress.current = 0
    }
  }, [showToast])
  useEffect(() => {
    window.addEventListener('keydown', handleKonami)
    return () => window.removeEventListener('keydown', handleKonami)
  }, [handleKonami])

  function handleLogoClick() {
    if (load8bitUnlocked()) return
    logoClickCount.current += 1
    setLogoFlash(true)
    setTimeout(() => setLogoFlash(false), 150)
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current)
    if (logoClickCount.current >= EIGHTBIT_CLICKS) {
      logoClickCount.current = 0
      unlock8bitMode()
      save8bitEnabled(true)
      apply8bitMode(true)
      incrementAchievementProgress('misc:8bit_unlock')
      on8bitUnlocked?.()
    } else {
      logoClickTimer.current = setTimeout(() => { logoClickCount.current = 0 }, 2000)
    }
  }

  const dailyLabel = dailyChallenge.won === true
    ? 'DAILY ✓'
    : dailyChallenge.attempts > 0
      ? `DAILY (${dailyChallenge.attempts})`
      : 'DAILY CHALLENGE'

  const weeklyChallenge = getWeeklyChallengeState()
  const weeklyLabel = weeklyChallenge.won === true
    ? 'WEEKLY ✓'
    : weeklyChallenge.attempts > 0
      ? `WEEKLY (${weeklyChallenge.attempts})`
      : 'WEEKLY CHALLENGE'
  const dailyResetLabel = formatResetLabel(nextUtcMidnight())
  const weeklyResetLabel = formatResetLabel(getNextWeeklyReset())

  // Secret #9 — Wrong Save File: rare title-screen glitch showing fake stats
  const [wrongSave, setWrongSave] = useState<{ cards: number; crystals: number; deck: number } | null>(null)
  // Shown when a play mode is tapped but the active deck is too small to play.
  const [showDeckWarning, setShowDeckWarning] = useState(false)
  useEffect(() => {
    if (Math.random() > 0.02) return  // 2% chance
    const fake = {
      cards:    Math.floor(Math.random() * catalogTotal),
      crystals: Math.floor(Math.random() * 9999),
      deck:     Math.floor(Math.random() * 10),
    }
    setWrongSave(fake)
    const id = setTimeout(() => setWrongSave(null), 1800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const heroLabel = !campaignUnlocked
    ? 'CAMPAIGN'
    : savedRun ? 'CONTINUE RUN' : 'CAMPAIGN'
  const heroHint = !campaignUnlocked
    ? `Collect ${CAMPAIGN_UNLOCK_CARDS - totalOwned} more cards to unlock Campaign — play Quick Battle to earn cards!`
    : !valid ? `Deck needs ${10 - count} more cards` : undefined
  const handleHeroClick = !campaignUnlocked ? () => {} : valid ? onCampaign : () => setShowDeckWarning(true)

  const quickBattleLabel = valid
    ? <><Icon name="sword" size={16} /> QUICK BATTLE</>
    : `⚠ DECK (${count}/10)`
  const quickBattleHint = valid ? undefined : `Deck needs ${10 - count} more cards`

  return (
    <div className="title-screen u-relative u-col u-items-c u-just-c u-grow">
      <WinStreak winStreak={winStreak} bestStreak={bestStreak} />

      <TitleIdleAnimation />

      {/* Header: logo + subtitle */}
      <div className="title-header u-col u-items-c u-gap-3 u-relative">
        <div
          className={`title-logo${logoFlash ? ' title-logo--flash' : ''}`}
          onClick={handleLogoClick}
          style={{ cursor: load8bitUnlocked() ? 'default' : 'pointer' }}
        >JARV'S</div>
        <div className="title-subtitle">AMAZING WEB GAME</div>
      </div>

      {cityAttackAlert && <CityAlertBanner onClick={onCityBuilder} />}

      <HeroAction label={heroLabel} hint={heroHint} locked={!campaignUnlocked} onClick={handleHeroClick} />

      {!campaignUnlocked && (
        <div className="title-campaign-locked-hint">
          <Icon name="lock" size={14} /> Campaign unlocks at {CAMPAIGN_UNLOCK_CARDS} cards ({totalOwned}/{CAMPAIGN_UNLOCK_CARDS}) — play Quick Battle to earn more!
        </div>
      )}

      <SecondaryPlayRow
        quickBattleLabel={quickBattleLabel}
        quickBattleHint={quickBattleHint}
        onQuickBattle={valid ? onPlay : () => setShowDeckWarning(true)}
        onEndless={valid ? onEndless : () => setShowDeckWarning(true)}
        hubUnlocked={hubUnlocked}
        onHub={onHub}
      />

      <PeriodicRow
        dailyLabel={dailyLabel}
        dailyStreak={dailyStreak}
        dailyResetLabel={dailyResetLabel}
        onDaily={onDailyChallenge}
        weeklyLabel={weeklyLabel}
        weeklyResetLabel={weeklyResetLabel}
        onWeekly={onWeeklyChallenge}
        onLeaderboards={onEndlessLeaderboard}
      />

      <UtilityRow onTraining={onTraining} onMiniGames={onMiniGames} />

      <ManageNav
        onPlayer={onPlayer}
        achievementAlert={achievementAlert}
        onDeckBuilder={onDeckBuilder}
        onCollection={onCollection}
        collectionAlert={collectionAlert}
        onShop={onShop}
        shopAlert={shopAlert}
        onCodex={onCodex}
        onChronicle={onChronicle}
        chronicleAlert={chronicleAlert}
        onNews={onNews}
        hasUnreadNews={hasUnreadNews}
        onSettings={onSettings}
        commanderName={commanderName}
        onCommander={onCommander}
      />

      <TitleIdentityFooter
        playerName={playerName}
        bestStreak={bestStreak}
        cardsLabel={wrongSave ? `${wrongSave.cards}/${catalogTotal}` : `${distinctUnlocked}/${catalogTotal}`}
        crystalsLabel={wrongSave ? wrongSave.crystals.toLocaleString() : crystals.toLocaleString()}
        deckLabel={wrongSave ? String(wrongSave.deck) : String(count)}
        glitch={!!wrongSave}
        user={user}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onFeedback={onFeedback}
      />

      {showDeckWarning && (
        <ConfirmModal
          title="Deck not ready"
          body={`Your deck has ${count} card${count === 1 ? '' : 's'} but needs at least 10 to play. Open the deck builder to add more.`}
          confirmLabel="Open Deck Builder"
          onConfirm={() => { setShowDeckWarning(false); onDeckBuilder() }}
          onCancel={() => setShowDeckWarning(false)}
        />
      )}
    </div>
  )
}
