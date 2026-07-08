// ─── Mini Games Menu ──────────────────────────────────────────────────────────
// Hub screen for the arcade mini-game feature. Players spend crystals to play,
// earn tickets, and redeem tickets for prizes.

import React, { useState, useEffect, useCallback } from 'react'
import { type User } from 'firebase/auth'
import {
  MiniGameId, MINI_GAME_COSTS, MINI_GAME_LABELS, MINI_GAME_DESCRIPTIONS, MINI_GAME_ICONS,
  loadTickets, addTickets, spendTickets,
  TICKET_PRIZES, TicketPrize,
  loadLocalHighScore, saveLocalHighScore,
  publishMiniGameScore, fetchMiniGameLeaderboard, MiniGameLeaderboardEntry,
} from '../../game/miniGames'
import { loadCrystals, saveCrystals, addCardsToCollection, loadCollection, getOwnedCount } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import { incrementAchievementProgress, setAchievementProgress } from '../../game/achievements'
import { MarbleRun } from '../minigames/MarbleRun'
import { TileFlip } from '../minigames/TileFlip'
import { CrystalCatch } from '../minigames/CrystalCatch'
import { LuckySpinner } from '../minigames/LuckySpinner'
import { MarbleRace } from '../minigames/MarbleRace'
import { HigherOrLower } from '../minigames/HigherOrLower'
import { FruitMachine } from '../minigames/FruitMachine'
import { VideoPoker } from '../minigames/VideoPoker'
import { CityBuilder } from '../minigames/CityBuilder'
import { Fishing } from '../minigames/Fishing'
import { TowerDefence, TowerPool } from '../minigames/TowerDefence'
import { HarbourRegatta } from '../minigames/HarbourRegatta'
import { PageHeader } from '../ui/PageHeader'
import { OverlayScreen } from '../ui/OverlayScreen'

export type SubScreen = 'menu' | MiniGameId | 'prizes' | 'leaderboard' | 'citybuilder' | 'fishing' | 'towerDefence'

interface Props {
  crystals: number
  onCrystalsChange: (n: number) => void
  user: User | null
  characterName: string
  onBack: () => void
  onGameDone?: () => void
  initialSubScreen?: SubScreen
}

// Build tower pool from owned unit cards in the player's collection
function buildCollectionTowerPool(): TowerPool[] {
  const catalog = getCardCatalog()
  const collection = loadCollection()
  return catalog
    .filter(c => c.cardType === 'unit' && c.unit && !c.unit.isWall && getOwnedCount(collection, c.name) > 0)
    .map(c => {
      // Use the spawner building's name if one exists, otherwise fall back to the unit card name
      const spawner = catalog.find(s =>
        s.unit?.structureEffect?.type === 'spawn' &&
        (s.unit.structureEffect as { type: 'spawn'; unitTemplate: { name: string } }).unitTemplate.name === c.unit!.name
      )
      return { template: c.unit!, total: getOwnedCount(collection, c.name), buildingName: spawner?.name ?? c.name }
    })
}

// Pick N random cards from catalog, optionally filtered by rarity
function pickRandomCards(count: number, rarity?: 'uncommon' | 'rare' | 'legendary'): string[] {
  const catalog = getCardCatalog()
  const pool = rarity ? catalog.filter(c => c.rarity === rarity) : catalog
  if (pool.length === 0) return []
  const results: string[] = []
  for (let i = 0; i < count; i++) {
    results.push(pool[Math.floor(Math.random() * pool.length)].name)
  }
  return results
}

export function MiniGamesMenu({ crystals, onCrystalsChange, user, characterName, onBack, onGameDone, initialSubScreen }: Props) {
  const [subScreen, setSubScreen] = useState<SubScreen>(initialSubScreen ?? 'menu')
  const [tickets, setTickets] = useState(() => loadTickets())
  const [toast, setToast] = useState<string | null>(null)
  const [lbEntries, setLbEntries] = useState<MiniGameLeaderboardEntry[]>([])
  const [lbGame, setLbGame] = useState<MiniGameId>('marble')
  const [lbMode, setLbMode] = useState<'today' | 'allTime'>('allTime')
  const [lbLoading, setLbLoading] = useState(false)
  const [prizeToast, setPrizeToast] = useState<string | null>(null)

  function showToast(msg: string, duration = 3000) {
    setToast(msg)
    setTimeout(() => setToast(null), duration)
  }

  function refreshTickets() {
    setTickets(loadTickets())
  }

  // ── Start a game ─────────────────────────────────────────────────────────────

  function startGame(id: MiniGameId) {
    const cost = MINI_GAME_COSTS[id]
    const currentCrystals = loadCrystals()
    if (currentCrystals < cost) {
      showToast(`Not enough crystals! Need ${cost} 💎`)
      return
    }
    const newCrystals = currentCrystals - cost
    saveCrystals(newCrystals)
    onCrystalsChange(newCrystals)
    setSubScreen(id)
  }

  // ── Game completion handler ───────────────────────────────────────────────────

  const handleGameDone = useCallback((gameId: MiniGameId, ticketsEarned: number, opts?: { perfect?: boolean; jackpot?: boolean; score?: number }) => {
    if (ticketsEarned > 0) {
      addTickets(ticketsEarned)
      refreshTickets()
    }

    // Track achievements
    incrementAchievementProgress('miniGame:gamesPlayed')
    incrementAchievementProgress('miniGame:ticketsEarned', ticketsEarned)

    // Game-specific achievements
    const best = loadLocalHighScore(gameId)
    const newBest = Math.max(best, ticketsEarned)
    saveLocalHighScore(gameId, newBest)

    if (gameId === 'marble') {
      setAchievementProgress('miniGame:marble:bestScore', newBest)
    } else if (gameId === 'tileflip') {
      setAchievementProgress('miniGame:tileflip:bestScore', newBest)
      if (opts?.perfect) incrementAchievementProgress('miniGame:tileflip:perfectGames')
    } else if (gameId === 'crystalcatch') {
      setAchievementProgress('miniGame:crystalcatch:bestScore', newBest)
    } else if (gameId === 'spinner') {
      setAchievementProgress('miniGame:spinner:bestScore', newBest)
      if (opts?.jackpot) incrementAchievementProgress('miniGame:spinner:jackpots')
    } else if (gameId === 'marblerace') {
      setAchievementProgress('miniGame:marblerace:bestScore', newBest)
    } else if (gameId === 'higherOrLower') {
      setAchievementProgress('miniGame:higherOrLower:bestScore', newBest)
    } else if (gameId === 'fruitMachine') {
      setAchievementProgress('miniGame:fruitMachine:bestScore', newBest)
    } else if (gameId === 'videoPoker') {
      setAchievementProgress('miniGame:videoPoker:bestScore', newBest)
    } else if (gameId === 'fishing') {
      setAchievementProgress('miniGame:fishing:bestScore', newBest)
      if (opts?.score) setAchievementProgress('miniGame:fishing:bestWeightG', opts.score)
    } else if (gameId === 'towerDefence') {
      setAchievementProgress('miniGame:towerDefence:bestScore', newBest)
    } else if (gameId === 'regatta') {
      setAchievementProgress('miniGame:regatta:bestScore', newBest)
    }

    // Publish to leaderboard if signed in
    if (user && !user.isAnonymous) {
      publishMiniGameScore({
        uid: user.uid,
        characterName,
        gameId,
        score: opts?.score ?? ticketsEarned,
      }).catch(() => { /* offline — ignore */ })
    }

    if (onGameDone) { onGameDone() } else { setSubScreen('menu') }
  }, [user, characterName, onGameDone])

  // ── Prize redemption ──────────────────────────────────────────────────────────

  function redeemPrize(prize: TicketPrize) {
    if (!spendTickets(prize.cost)) {
      setPrizeToast(`Not enough tickets! Need ${prize.cost} 🎫`)
      setTimeout(() => setPrizeToast(null), 3000)
      return
    }

    refreshTickets()
    incrementAchievementProgress('miniGame:prizesRedeemed')

    const { reward } = prize
    if (reward.type === 'crystals') {
      const current = loadCrystals()
      const next = current + reward.amount
      saveCrystals(next)
      onCrystalsChange(next)
      setPrizeToast(`+${reward.amount} 💎 Crystals added!`)
    } else if (reward.type === 'card') {
      const names = pickRandomCards(1, reward.rarity)
      if (names.length > 0) {
        addCardsToCollection([{ cardName: names[0], count: 1 }])
        setPrizeToast(`🃏 ${names[0]} added to your collection!`)
      }
    } else if (reward.type === 'cards') {
      const names = pickRandomCards(reward.count, reward.rarity)
      addCardsToCollection(names.map(n => ({ cardName: n, count: 1 })))
      setPrizeToast(`🃏 ${reward.count} cards added to your collection!`)
    } else if (reward.type === 'bundle') {
      const current = loadCrystals()
      const next = current + 500
      saveCrystals(next)
      onCrystalsChange(next)
      const names = pickRandomCards(5)
      addCardsToCollection(names.map(n => ({ cardName: n, count: 1 })))
      setPrizeToast('Bundle redeemed! +500 💎 + 5 cards!')
    }

    setTimeout(() => setPrizeToast(null), 4000)
  }

  // ── Leaderboard loading ───────────────────────────────────────────────────────

  async function loadLeaderboard(gameId: MiniGameId, mode: 'today' | 'allTime') {
    setLbGame(gameId)
    setLbMode(mode)
    setLbLoading(true)
    setLbEntries([])
    const entries = await fetchMiniGameLeaderboard(gameId, mode, 10)
    setLbEntries(entries)
    setLbLoading(false)
  }

  useEffect(() => {
    if (subScreen === 'leaderboard') {
      loadLeaderboard(lbGame, lbMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subScreen])

  const currentCrystals = crystals

  // ── Render ────────────────────────────────────────────────────────────────────

  if (subScreen === 'marble') {
    return <MarbleRun onDone={(t) => handleGameDone('marble', t)} />
  }
  if (subScreen === 'tileflip') {
    return <TileFlip onDone={(t, perfect) => handleGameDone('tileflip', t, { perfect })} />
  }
  if (subScreen === 'crystalcatch') {
    return <CrystalCatch onDone={(t) => handleGameDone('crystalcatch', t)} />
  }
  if (subScreen === 'spinner') {
    return <LuckySpinner onDone={(t, jackpot) => handleGameDone('spinner', t, { jackpot })} />
  }
  if (subScreen === 'marblerace') {
    return <MarbleRace onDone={(t) => handleGameDone('marblerace', t)} />
  }
  if (subScreen === 'regatta') {
    return <HarbourRegatta onDone={(t) => handleGameDone('regatta', t)} />
  }
  if (subScreen === 'higherOrLower') {
    return <HigherOrLower onDone={(t) => handleGameDone('higherOrLower', t)} />
  }
  if (subScreen === 'fruitMachine') {
    return <FruitMachine onDone={(t) => handleGameDone('fruitMachine', t)} />
  }
  if (subScreen === 'videoPoker') {
    return <VideoPoker onDone={(t) => handleGameDone('videoPoker', t)} />
  }
  if (subScreen === 'fishing') {
    return (
      <Fishing
        onDone={(tickets, weightG) => handleGameDone('fishing', tickets, { score: weightG })}
      />
    )
  }
  if (subScreen === 'towerDefence') {
    const pool = buildCollectionTowerPool()
    return (
      <TowerDefence
        pool={pool}
        mode="collection"
        onDone={(tickets) => handleGameDone('towerDefence', tickets)}
      />
    )
  }
  if (subScreen === 'citybuilder') {
    return <CityBuilder onBack={() => initialSubScreen === 'citybuilder' ? onBack() : setSubScreen('menu')} />
  }

  return (
    <OverlayScreen title="🎮 ARCADE" onBack={onBack} right={
      <div className="ticket-balance"><span>🎫 {tickets} tickets</span></div>
    } >

      <div className="minigame-hub">
        {/* Toast */}
        {toast && <div className="minigame-toast" role="alert">{toast}</div>}


        <div className="minigame-hub-currency">💎 {currentCrystals.toLocaleString()} crystals</div>

        {subScreen === 'menu' && (
          <>
            {/* City Builder — separate from the ticket economy */}
            <div className="city-builder-hub-entry">
              <div className="city-builder-hub-icon">🏙</div>
              <div className="city-builder-hub-info">
                <div className="city-builder-hub-name">CITY BUILDER</div>
                <div className="city-builder-hub-desc">Place units &amp; buildings to earn gold. Level up your cards permanently.</div>
              </div>
              <button className="action-btn action-btn--gold" onClick={() => setSubScreen('citybuilder')}>
                ENTER
              </button>
            </div>

            {/* Game grid */}
            <div className="minigame-grid">
              {(['marble', 'tileflip', 'crystalcatch', 'spinner', 'marblerace', 'regatta', 'higherOrLower', 'fruitMachine', 'videoPoker', 'fishing', 'towerDefence'] as MiniGameId[]).map(id => {
                const cost = MINI_GAME_COSTS[id]
                const locked = currentCrystals < cost
                const best = loadLocalHighScore(id)
                return (
                  <div key={id} className={`minigame-card u-col u-items-c u-gap-3 u-text-c${locked ? ' minigame-card--locked' : ''}`}>
                    <div className="minigame-card-icon">{MINI_GAME_ICONS[id]}</div>
                    <div className="minigame-card-name">{MINI_GAME_LABELS[id]}</div>
                    <div className="minigame-card-desc">{MINI_GAME_DESCRIPTIONS[id]}</div>
                    <div className="minigame-card-meta u-flex u-gap-6">
                      <span className="minigame-card-cost">💎 {cost}</span>
                      {best > 0 && <span className="minigame-card-best">Best: {best} 🎫</span>}
                    </div>
                    <button
                      className={`action-btn${locked ? '' : ' action-btn--gold'}`}
                      onClick={() => startGame(id)}
                      disabled={locked}
                      title={locked ? `Need ${cost} crystals to play` : undefined}
                    >
                      {locked ? `NEED ${cost} 💎` : 'PLAY'}
                    </button>
                  </div>
                )
              })}
            </div>




            <div className="minigame-hub-actions u-flex u-gap-6 u-wrap u-just-c">
              <button className="action-btn" onClick={() => setSubScreen('prizes')}>
                🎁 PRIZE SHOP ({tickets} 🎫)
              </button>
              <button className="action-btn" onClick={() => setSubScreen('leaderboard')}>
                🏆 LEADERBOARDS
              </button>
            </div>
          </>
        )}

        {subScreen === 'prizes' && (
          <div className="prize-screen u-col">
            <div className="overlay-header u-flex u-items-c u-gap-6">
              <button className="action-btn" onClick={() => initialSubScreen === 'prizes' ? onBack() : setSubScreen('menu')}>← BACK</button>
              <span className="overlay-title">🎁 PRIZE SHOP</span>
              <div className="ticket-balance">🎫 {tickets}</div>
            </div>

            {prizeToast && <div className="minigame-toast minigame-toast--prize" role="alert">{prizeToast}</div>}

            <div className="prize-list u-col u-gap-3">
              {TICKET_PRIZES.map(prize => {
                const canAfford = tickets >= prize.cost
                return (
                  <div key={prize.id} className={`prize-row u-flex u-items-c u-just-sb u-gap-5${canAfford ? '' : ' prize-row--locked'}`}>
                    <div className="prize-row-info u-grow">
                      <div className="prize-row-label">{prize.label}</div>
                      <div className="prize-row-desc">{prize.desc}</div>
                    </div>
                    <div className="prize-row-right u-col u-items-end u-gap-2">
                      <div className="prize-row-cost">🎫 {prize.cost.toLocaleString()}</div>
                      <button
                        className={`action-btn${canAfford ? ' action-btn--gold' : ''}`}
                        onClick={() => redeemPrize(prize)}
                        disabled={!canAfford}
                      >
                        REDEEM
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {subScreen === 'leaderboard' && (
          <div className="lb-screen u-col">
            <div className="overlay-header u-flex u-items-c u-gap-6">
              <button className="action-btn" onClick={() => initialSubScreen === 'leaderboard' ? onBack() : setSubScreen('menu')}>← BACK</button>
              <span className="overlay-title">🏆 LEADERBOARDS</span>
            </div>

            <div className="lb-controls u-col u-gap-3">
              <div className="lb-game-tabs">
                {(['marble', 'tileflip', 'crystalcatch', 'spinner', 'marblerace', 'regatta', 'higherOrLower', 'fruitMachine', 'videoPoker', 'fishing', 'towerDefence'] as MiniGameId[]).map(id => (
                  <button
                    key={id}
                    className={`filter-btn${lbGame === id ? ' filter-btn--active' : ''}`}
                    onClick={() => loadLeaderboard(id, lbMode)}
                  >
                    {MINI_GAME_ICONS[id]} {MINI_GAME_LABELS[id]}
                  </button>
                ))}
              </div>
              <div className="lb-mode-tabs">
                <button
                  className={`filter-btn${lbMode === 'today' ? ' filter-btn--active' : ''}`}
                  onClick={() => loadLeaderboard(lbGame, 'today')}
                >
                  TODAY
                </button>
                <button
                  className={`filter-btn${lbMode === 'allTime' ? ' filter-btn--active' : ''}`}
                  onClick={() => loadLeaderboard(lbGame, 'allTime')}
                >
                  ALL TIME
                </button>
              </div>
            </div>

            {lbLoading && <div className="lb-loading">Loading...</div>}
            {!lbLoading && lbEntries.length === 0 && (
              <div className="lb-empty">No scores yet. Be the first!</div>
            )}
            {!lbLoading && lbEntries.length > 0 && (
              <ol className="lb-list">
                {lbEntries.map((e, i) => (
                  <li key={e.uid} className="lb-entry">
                    <span className="lb-rank">{i + 1}</span>
                    <span className="lb-name">{e.characterName}</span>
                    <span className="lb-score">{e.score} 🎫</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
