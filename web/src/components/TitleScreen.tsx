import React, { useRef, useState } from 'react'
import { type User } from 'firebase/auth'
import { loadDeck, loadCollection, deckTotalCards, isDeckValid, COPIES_MAX, loadWinStreak, loadBestStreak } from '../game/collection'
import { loadRun } from '../game/questline'
import { getCardCatalog } from '../game/cards'
import { hasUnclaimedAchievements } from '../game/achievements'
import { TitleButton } from './TitleButton'
import { SpriteImg } from './SpriteImg'
import { TitleIdleAnimation } from './TitleIdleAnimation'
import { load8bitUnlocked, unlock8bitMode, save8bitEnabled, apply8bitMode } from './SettingsScreen'
import { incrementAchievementProgress } from '../game/achievements'
import { getDailyChallengeState } from '../game/dailyChallenge'

const CAMPAIGN_UNLOCK_CARDS = 30
const EIGHTBIT_CLICKS = 8

interface Props {
  crystals: number
  onPlay: () => void
  onEndless: () => void
  onCampaign: () => void
  onCollection: () => void
  onShop: () => void
  onDeckBuilder: () => void
  onSettings: () => void
  onInventory: () => void
  onAchievements: () => void
  onHeroCards: () => void
  onCharacter: () => void
  on8bitUnlocked?: () => void
  onDailyChallenge: () => void
  onEndlessLeaderboard: () => void
  onCommander?: () => void
  commanderName?: string | null
  user: User | null
  onSignOut: () => void
  onSignIn: () => void
}

export function TitleScreen({ crystals, onPlay, onEndless, onCampaign, onCollection, onShop, onDeckBuilder, onSettings, onInventory, onAchievements, onHeroCards, onCharacter, on8bitUnlocked, onDailyChallenge, onEndlessLeaderboard, onCommander, commanderName, user, onSignOut, onSignIn }: Props) {
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
  const winStreak           = loadWinStreak()
  const bestStreak          = loadBestStreak()
  const dailyChallenge      = getDailyChallengeState()

  const logoClickCount = useRef(0)
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [logoFlash, setLogoFlash] = useState(false)

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

  return (
    <div className="title-screen">
      {/* Animated background scan line */}
      <div className="title-bg-scan" aria-hidden="true" />

      {/* Win streak ribbon (top-left corner) */}
      {winStreak > 0 && (
        <div className="streak-ribbon-wrap">
          <div className="streak-ribbon">🔥 {winStreak}</div>
        </div>
      )}
      {bestStreak > 1 && winStreak === 0 && (
        <div className="streak-ribbon-wrap">
          <div className="streak-ribbon streak-ribbon--faded">🏆 {bestStreak}</div>
        </div>
      )}

      <TitleIdleAnimation />

      {/* Header: logo + subtitle */}
      <div className="title-header">
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
          onClick={onCampaign}
          disabled={!valid || !campaignUnlocked}
          title={
            !valid ? `Deck needs ${10 - count} more cards` :
            !campaignUnlocked ? `Collect ${CAMPAIGN_UNLOCK_CARDS - totalOwned} more cards to unlock Campaign — play Quick Battle to earn cards!` :
            undefined
          }
        >
          {savedRun ? '⚔  CONTINUE RUN' : '⚔  CAMPAIGN'}
        </TitleButton>

        <TitleButton
          onClick={onPlay}
          extraClass="title-primary-btn"
          disabled={!valid}
          title={valid ? undefined : `Deck needs ${10 - count} more cards`}
        >
          {valid ? '▶  QUICK BATTLE' : `⚠ DECK (${count}/10)`}
        </TitleButton>

        <TitleButton
          onClick={onEndless}
          extraClass="title-primary-btn"
          disabled={!valid}
          title={valid ? undefined : `Deck needs ${10 - count} more cards`}
        >
          ∞  ENDLESS MODE
        </TitleButton>

        <TitleButton onClick={onDailyChallenge} extraClass="title-daily-btn">
          {dailyLabel}
        </TitleButton>

        <TitleButton onClick={onEndlessLeaderboard} extraClass="title-endless-lb-btn">
          🏆  LEADERBOARDS
        </TitleButton>
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
          <TitleButton onClick={onDeckBuilder}>DECK BUILDER</TitleButton>
          <TitleButton onClick={onCollection} badge={collectionAlert}>COLLECTION</TitleButton>
          <TitleButton onClick={onShop}>🛒 SHOP</TitleButton>
          <TitleButton onClick={onHeroCards}>🦸 HEROES</TitleButton>
          <TitleButton onClick={onInventory}>🎒 INVENTORY</TitleButton>
          <TitleButton onClick={onAchievements} badge={achievementAlert}>🏆 ACHIEVEMENTS</TitleButton>
          <TitleButton onClick={onCharacter}>👤 CHARACTER</TitleButton>
          {commanderName && onCommander && (
            <TitleButton onClick={onCommander} extraClass="title-commander-btn">
              <SpriteImg name={commanderName} className="commander-btn-sprite" />
              {commanderName.toUpperCase()}
            </TitleButton>
          )}
          <TitleButton onClick={onSettings} extraClass="title-settings-btn">⚙ SETTINGS</TitleButton>
        </div>
      </div>

      {/* Footer: stats + auth */}
      <div className="title-footer">
        <div className="title-deck-info">
          {distinctUnlocked}/{catalogTotal} cards &nbsp;·&nbsp; 💎 {crystals.toLocaleString()} &nbsp;·&nbsp; Deck: {count}
        </div>
        <div className="title-auth-bar">
          {user && !user.isAnonymous ? (
            <>
              <span className="title-auth-label">👤 {user.displayName ?? user.email}</span>
              <button className="title-auth-btn" onClick={onSignOut}>SIGN OUT</button>
            </>
          ) : (
            <button className="title-auth-btn" onClick={onSignIn}>SIGN IN</button>
          )}
        </div>
      </div>
    </div>
  )
}
