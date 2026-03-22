import React, { useRef, useState } from 'react'
import { loadDeck, loadCollection, deckTotalCards, isDeckValid, COPIES_MAX, loadWinStreak, loadBestStreak } from '../game/collection'
import { loadRun } from '../game/questline'
import { getCardCatalog } from '../game/cards'
import { hasUnclaimedAchievements } from '../game/achievements'
import { TitleButton } from './TitleButton'
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
}

export function TitleScreen({ crystals, onPlay, onEndless, onCampaign, onCollection, onShop, onDeckBuilder, onSettings, onInventory, onAchievements, onHeroCards, onCharacter, on8bitUnlocked, onDailyChallenge }: Props) {
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

  return (
    <div className="title-screen">
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
      <div
        className={`title-logo${logoFlash ? ' title-logo--flash' : ''}`}
        onClick={handleLogoClick}
        style={{ cursor: load8bitUnlocked() ? 'default' : 'pointer' }}
      >JARV'S</div>
      <div className="title-subtitle">AMAZING WEB GAME</div>

      <div className="title-buttons">
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

        {!campaignUnlocked && (
          <div className="title-campaign-locked-hint">
            🔒 Campaign unlocks at {CAMPAIGN_UNLOCK_CARDS} cards ({totalOwned}/{CAMPAIGN_UNLOCK_CARDS}) — play Quick Battle to earn more!
          </div>
        )}

        <TitleButton onClick={onPlay} disabled={!valid} title={valid ? undefined : `Deck needs ${10 - count} more cards`}>
          {valid ? '▶  QUICK BATTLE' : `⚠ DECK TOO SMALL (${count}/10)`}
        </TitleButton>

        <TitleButton onClick={onEndless} disabled={!valid} title={valid ? undefined : `Deck needs ${10 - count} more cards`}>
          ∞  ENDLESS MODE
        </TitleButton>

        <TitleButton onClick={onDailyChallenge}>
          {dailyChallenge.won === true
            ? '📅  DAILY CHALLENGE ✓'
            : dailyChallenge.attempts > 0
              ? `📅  DAILY CHALLENGE (${dailyChallenge.attempts} attempt${dailyChallenge.attempts !== 1 ? 's' : ''})`
              : '📅  DAILY CHALLENGE'}
        </TitleButton>

        <TitleButton onClick={onDeckBuilder}>DECK BUILDER</TitleButton>

        <TitleButton onClick={onCollection} badge={collectionAlert}>COLLECTION</TitleButton>

        <TitleButton onClick={onShop}>🛒 SHOP</TitleButton>

        <TitleButton onClick={onHeroCards}>🦸 HERO CARDS</TitleButton>

        <TitleButton onClick={onInventory}>🎒 INVENTORY</TitleButton>

        <TitleButton onClick={onAchievements} badge={achievementAlert}>🏆 ACHIEVEMENTS</TitleButton>

        <TitleButton onClick={onCharacter}>👤 CHARACTER</TitleButton>

        <TitleButton onClick={onSettings} extraClass="title-settings-btn">⚙ SETTINGS</TitleButton>
      </div>

      <div className="title-deck-info">
        {distinctUnlocked}/{catalogTotal} cards &nbsp;·&nbsp; 💎 {crystals.toLocaleString()} &nbsp;·&nbsp; Deck: {count}
      </div>

    </div>
  )
}
