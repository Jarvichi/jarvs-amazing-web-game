import React, { useRef, useState, useEffect, useCallback } from 'react'
import { type User } from 'firebase/auth'
import { loadDeck, loadCollection, deckTotalCards, isDeckValid, COPIES_MAX, loadWinStreak, loadBestStreak } from '../../game/collection'
import { loadPlayerName, loadRun } from '../../game/questline'
import { getCardCatalog } from '../../game/cards'
import { hasUnclaimedAchievements } from '../../game/achievements'
import { getDailyShopSellSlots } from '../../game/shopSchedule'
import { loadInventory } from '../../game/dailyLogin'
import { TitleButton } from '../ui/TitleButton'
import { ConfirmModal } from '../modals/ConfirmModal'
import { SpriteImg } from '../ui/SpriteImg'
import { TitleIdleAnimation } from './TitleIdleAnimation'
import { load8bitUnlocked, unlock8bitMode, save8bitEnabled, apply8bitMode } from '../screens/SettingsScreen'
import { incrementAchievementProgress } from '../../game/achievements'
import { getDailyChallengeState } from '../../game/dailyChallenge'
import { getWeeklyChallengeState } from '../../game/weeklyChallenge'
import { getUnreadChapterCount } from '../../game/chronicle'
import { generatePack, addCardsToCollection } from '../../game/collection'
import { WinStreak } from './WinStreak'
import { LoginButton } from '../ui/LoginButton'
import { Button } from '../ui/Button'

const CAMPAIGN_UNLOCK_CARDS = 30
const EIGHTBIT_CLICKS = 8

// Konami code: Up Up Down Down Left Right Left Right
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight']
const KONAMI_KEY = 'jarv_konami_used'
function hasUsedKonami(): boolean { try { return !!localStorage.getItem(KONAMI_KEY) } catch { return false } }
function markKonamiUsed(): void   { try { localStorage.setItem(KONAMI_KEY, '1') } catch { /* ignore */ } }

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
  const savedRun         = loadRun()
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
  const [konamiToast, setKonamiToast] = useState<string | null>(null)
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
          setKonamiToast('↑↑↓↓←→←→  •  CHEAT ACCEPTED  •  Pack granted!')
          setTimeout(() => setKonamiToast(null), 4000)
        } else {
          setKonamiToast('You already claimed this secret. Nice try.')
          setTimeout(() => setKonamiToast(null), 3000)
        }
      }
    } else {
      konamiProgress.current = 0
    }
  }, [])
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
    ? '📅  DAILY ✓'
    : dailyChallenge.attempts > 0
      ? `📅  DAILY (${dailyChallenge.attempts})`
      : '📅  DAILY CHALLENGE'

  const weeklyChallenge = getWeeklyChallengeState()
  const weeklyLabel = weeklyChallenge.won === true
    ? '🗓  WEEKLY ✓'
    : weeklyChallenge.attempts > 0
      ? `🗓  WEEKLY (${weeklyChallenge.attempts})`
      : '🗓  WEEKLY CHALLENGE'

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

  return (
    <div className="title-screen u-relative u-col u-items-c u-just-c u-grow">
      {/* Animated background scan line */}
      <div className="title-bg-scan" aria-hidden="true" />

      {/* Secret #1 — Konami code toast */}
      {konamiToast && (
        <div className="konami-toast" role="alert">{konamiToast}</div>
      )}

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
        <div className="title-logo-ornament">· · · · ·</div>
      </div>

      {/* Primary actions: play modes */}
      <div className="title-primary-actions">
        <TitleButton
          variant="large"
          extraClass="title-campaign-btn"
          onClick={!campaignUnlocked ? () => {} : valid ? onCampaign : () => setShowDeckWarning(true)}
          disabled={!campaignUnlocked}
          title={
            !campaignUnlocked ? `Collect ${CAMPAIGN_UNLOCK_CARDS - totalOwned} more cards to unlock Campaign — play Quick Battle to earn cards!` :
            !valid ? `Deck needs ${10 - count} more cards` :
            undefined
          }
        >
          {savedRun ? '⚔  CONTINUE RUN' : '⚔  CAMPAIGN'}
        </TitleButton>

        <TitleButton
          onClick={valid ? onPlay : () => setShowDeckWarning(true)}
          extraClass="title-primary-btn"
          title={valid ? undefined : `Deck needs ${10 - count} more cards`}
        >
          {valid ? '▶  QUICK BATTLE' : `⚠ DECK (${count}/10)`}
        </TitleButton>

        <TitleButton
          onClick={valid ? onEndless : () => setShowDeckWarning(true)}
          extraClass="title-primary-btn"
          title={valid ? undefined : `Deck needs ${10 - count} more cards`}
        >
          ∞  ENDLESS MODE
        </TitleButton>

        <TitleButton onClick={onDailyChallenge} extraClass="title-daily-btn">
          {dailyLabel}
        </TitleButton>

        <TitleButton onClick={onWeeklyChallenge} extraClass="title-daily-btn">
          {weeklyLabel}
        </TitleButton>

        <TitleButton onClick={onEndlessLeaderboard} extraClass="title-endless-lb-btn">
          🏆  LEADERBOARDS
        </TitleButton>

        <TitleButton onClick={onTraining} extraClass="title-training-btn">
          ⚔  TRAINING MODE
        </TitleButton>

        <TitleButton onClick={onMiniGames} extraClass={`title-minigames-btn`}>
          🎮  MINI GAMES
        </TitleButton>
        {cityAttackAlert && (
          <TitleButton variant="large" onClick={onCityBuilder} extraClass="title-campaign-btn title-minigames-btn title-btn--alert title-alert-badge">
            ⚔ CITY ALERT
          </TitleButton>
        )}
        {hubUnlocked && onHub && (
          <TitleButton variant="large" onClick={onHub} extraClass="title-campaign-btn">
            🌆  HUB WORLD
          </TitleButton>
        )}
      </div>

      {!campaignUnlocked && (
        <div className="title-campaign-locked-hint">
          🔒 Campaign unlocks at {CAMPAIGN_UNLOCK_CARDS} cards ({totalOwned}/{CAMPAIGN_UNLOCK_CARDS}) — play Quick Battle to earn more!
        </div>
      )}

      {/* Secondary navigation: management buttons */}
      <div className="title-nav-section">
        <div className="title-nav-label">[ MANAGE ]</div>
        <div className="title-nav-grid">
          <TitleButton onClick={onPlayer} badge={achievementAlert}>👤 PLAYER</TitleButton>
          <TitleButton onClick={onDeckBuilder}>🃏 DECK</TitleButton>
          <TitleButton onClick={onCollection} badge={collectionAlert}>📦 COLLECTION</TitleButton>
          <TitleButton onClick={onShop} badge={shopAlert}>🛒 SHOP</TitleButton>
          <TitleButton onClick={onCodex}>📖 CODEX</TitleButton>
          <TitleButton onClick={onChronicle} badge={chronicleAlert}>📜 CHRONICLE</TitleButton>
          <TitleButton onClick={onNews} badge={hasUnreadNews}>📰 WHAT'S NEW</TitleButton>
          <TitleButton onClick={onSettings} extraClass="title-settings-btn">⚙ SETTINGS</TitleButton>
          {commanderName && onCommander && (
            <TitleButton onClick={onCommander} extraClass="title-commander-btn">
              <SpriteImg name={commanderName} className="commander-btn-sprite" />
              {commanderName.toUpperCase()}
            </TitleButton>
          )}
        </div>
      </div>

      {/* Footer: stats + auth */}
      <div className="title-footer u-col u-items-c u-gap-2 u-relative">
        <div className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>
          {wrongSave
            ? <>{wrongSave.cards}/{catalogTotal} cards &nbsp;·&nbsp; 💎 {wrongSave.crystals.toLocaleString()} &nbsp;·&nbsp; Deck: {wrongSave.deck}</>
            : <>{distinctUnlocked}/{catalogTotal} cards &nbsp;·&nbsp; 💎 {crystals.toLocaleString()} &nbsp;·&nbsp; Deck: {count}</>
          }
        </div>
        <div className="title-auth-bar u-flex u-items-c u-gap-5">
          <LoginButton onSignIn={onSignIn} onSignOut={onSignOut} user={user} playerName={playerName} />
          <Button
            className="title-auth-btn"
            onClick={onFeedback}
            title="Send feedback or report a bug"
          >🗣️ Feedback</Button>
        </div>
      </div>

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
