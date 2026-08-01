import React, { useRef, useEffect, useState } from 'react'
import { BattlefieldCanvas } from './BattlefieldCanvas'
import { GameState, Unit, BATTLEFIELD_ASPECT_RATIO, LANE_ASPECT_RATIO, Card } from '../../game/types'
import { CardTile } from '../cards/CardTile'
import { useCardDetail } from '../cards/useCardDetail'
import { spriteSlug } from '../../game/sprites'
import { BattleEventOverlay } from './BattleEventOverlay'
import { isNoDamageMode } from '../../game/debug'
import { MAX_UPGRADE_LEVEL, getEffectiveCardCost } from '../../game/engine/cards'
import { CAST_WINDUP_MS, COUNTER_DAMAGE_FLOOR_PCT } from '../../game/engine/constants'
import { SUDDEN_DEATH_FORCE_MS } from '../../game/engine/suddenDeath'
import { getRelicDef } from '../../game/relics'
import { getUnitLore, getCardCatalog } from '../../game/cards'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../modals/ConfirmModal'
import { loadPlayerName, loadPlayerAvatar } from '../../game/questline'
import { loadBattlePopups } from '../screens/SettingsScreen'
import { TutorialOverlay } from '../modals/TutorialOverlay'
import { hasSeen, markSeen } from '../../game/tutorial'
import { useLetterboxSize } from '../../hooks/useLetterboxSize'
import { loadDevConfig, patchDevConfig } from '../../game/devStore'
import { isDevMode } from '../../game/debug'

const modalAutoDismissTime = 2000
const BATTLE_TUTORIAL_ID = 'gameplay'
const BATTLE_TUTORIAL_STEPS = [
  {
    title: 'YOUR HAND',
    body: 'These cards are ready to play. Tap a card to deploy a unit, build a structure, or cast an upgrade onto the battlefield.',
  },
  {
    title: 'MANA',
    body: 'Each card costs mana ◆. Your mana refills over time. Some cards can place structures to increase your max mana.',
  },
  {
    title: 'OBJECTIVE',
    body: 'Destroy the enemy base before it destroys yours. Your base is at the bottom — the enemy\'s is at the top. Good luck!',
  },
]

interface Props {
  state: GameState
  onPlayCard: (cardId: string) => void
  onPlayAoeCard?: (cardId: string, cx: number, cy: number) => void
  onGiveUp?: () => void
  onPause?: (paused: boolean) => void
  actTheme?: string       // e.g. 'act1' — applied as CSS modifier class
  activeRelic?: string | null  // relic name currently equipped, if any
  showBossSplash?: boolean
  activeModifiers?: { label: string }[]  // replay modifiers active this run
  isCampaign?: boolean
  stance?: NonNullable<GameState['playerStance']>
  onSetStance?: (s: NonNullable<GameState['playerStance']>) => void
  speedMultiplier?: 1 | 2 | 4 | 8
  onCycleSpeed?: () => void
  onCounterSpell?: () => void
  /** True for the game admin. Together with `?dev` this reveals the dev-only
   *  passability overlay toggle in the pause menu. Passed as a boolean rather
   *  than resolved here so this component stays free of a Firebase dependency
   *  (its Storybook story renders without auth) and so useAuth's
   *  onAuthStateChanged listener isn't duplicated for a cosmetic gate. */
  isAdmin?: boolean
}

function ManaBar({ mana, maxMana, manaAccum }: { mana: number; maxMana: number; manaAccum: number }) {
  const pips = Array.from({ length: maxMana }, (_, i) => {
    if (i < mana) return 'full'
    if (i === mana) return 'partial'
    return 'empty'
  })
  return (
    <div className="mana-bar u-flex u-items-c">
      {pips.map((pipState, i) => (
        <span key={i} className={`mana-pip mana-pip--${pipState}`}>
          {pipState === 'partial'
            ? <span className="mana-pip-fill" style={{ width: `${manaAccum * 100}%` }} />
            : null}
        </span>
      ))}
    </div>
  )
}

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, (current / max) * 100)
  return (
    <div className="hp-bar-track">
      <div className="hp-bar-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="hp-bar-text">{current}/{max}</span>
    </div>
  )
}

const STRATEGY_LABELS: Record<string, string> = {
  swarm:  'SWARM',
  turtle: 'TURTLE',
  rush:   'RUSH',
}

// Maps bossAI or actTheme to an opponent portrait sprite slug.
const OPPONENT_PORTRAIT: Record<string, string> = {
  // Boss-specific
  thornlord:  'thornlord',
  kragg:      'barbarian',
  ashwalker:  'ash-elemental',
  archivist:  'wizard',
  // Act fallbacks
  act1: 'goblin',
  act2: 'ironclad-guard',
  act3: 'skeleton',
  act4: 'fire-mage',
}

const BASE_SPRITE_PATH = '/sprites/'

function opponentPortraitSlug(bossAI: string | undefined, actTheme: string | undefined): string {
  if (bossAI && OPPONENT_PORTRAIT[bossAI]) return OPPONENT_PORTRAIT[bossAI]
  if (actTheme && OPPONENT_PORTRAIT[actTheme]) return OPPONENT_PORTRAIT[actTheme]
  return 'bandit'
}

export function Battlefield({ state, onPlayCard, onPlayAoeCard, onGiveUp, onPause, actTheme, activeRelic, showBossSplash, activeModifiers, isCampaign, stance = 'auto', onSetStance, speedMultiplier = 1, onCycleSpeed, onCounterSpell, isAdmin = false }: Props) {
  const { openDetail, cardDetailNode } = useCardDetail()
  const [heroLightning, setHeroLightning] = useState<{ owner: 'player' | 'opponent'; key: number } | null>(null)
  const [paused, setPaused] = useState(false)
  const [importantMsgQueue, setImportantMsgQueue] = useState<string[]>([])
  const lastLogLenRef = useRef(0)
  const [inspectedUnit, setInspectedUnit] = useState<Unit | null>(null)
  // Seeded from the persisted dev config, but also flippable from the pause
  // menu so the overlay can be compared against a live battle without leaving
  // it. BattlefieldCanvas reads this every frame, so it takes effect at once.
  const [debugOverlay, setDebugOverlay] = useState(() => loadDevConfig().battlefieldDebugOverlay)
  const [showDeckViewer, setShowDeckViewer] = useState(false)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  const [showBattleTutorial, setShowBattleTutorial] = useState(
    () => !isCampaign && !hasSeen(BATTLE_TUTORIAL_ID)
  )
  const [pendingAoeCard, setPendingAoeCard] = useState<Card | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const frameSize = useLetterboxSize(stageRef, BATTLEFIELD_ASPECT_RATIO)
  // The lane is letterboxed inside the slot the HUD bands leave, just as the
  // frame is letterboxed inside the stage. Those bands are fixed pixel heights,
  // so the slot's shape drifts with the frame's; locking the lane's shape is
  // what keeps the terrain art's tile grid identical to the engine's collision
  // grid on every screen (see LANE_ASPECT_RATIO in game/types.ts).
  const laneSlotRef = useRef<HTMLDivElement>(null)
  const laneSize = useLetterboxSize(laneSlotRef, LANE_ASPECT_RATIO)
  const playerName   = loadPlayerName()
  const playerAvatar = loadPlayerAvatar()

  // Derive the opponent portrait slug from the actual commander/boss unit on the field
  // so the health bar portrait always matches what's rendered on the battlefield.
  const opponentCmd = state.field.find(u => u.isCommander && u.owner === 'opponent')
    ?? state.field.find(u => u.owner === 'opponent' && !!state.bossCard && u.name === state.bossCard)
  const opponentCommanderSlug = opponentCmd
    ? spriteSlug(opponentCmd.spriteName ?? opponentCmd.name)
    : opponentPortraitSlug(state.bossAI, actTheme)

  const doPause = (p: boolean) => { setPaused(p); onPause?.(p); if (!p) { setInspectedUnit(null); setShowDeckViewer(false) } }
  const prevHeroIdsRef = useRef<Set<string>>(new Set())

  // Cancel AoE targeting on Escape
  useEffect(() => {
    if (!pendingAoeCard) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPendingAoeCard(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingAoeCard])

  // Counter an opponent's incoming spell cast via Space/Enter
  useEffect(() => {
    if (!state.pendingSpellCast || state.pendingSpellCast.counterPct != null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); onCounterSpell?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.pendingSpellCast?.cardName, state.pendingSpellCast?.counterPct, onCounterSpell])

  // Detect when a new hero unit appears on the field and fire the lightning effect
  useEffect(() => {
    const heroIds = new Set(state.field.filter(u => u.isHero).map(u => u.id))
    for (const id of heroIds) {
      if (!prevHeroIdsRef.current.has(id)) {
        const hero = state.field.find(u => u.id === id)!
        setHeroLightning({ owner: hero.owner, key: Date.now() })
        setTimeout(() => setHeroLightning(null), 900)
        break
      }
    }
    prevHeroIdsRef.current = heroIds
  }, [state.field])

  // Watch for important log messages (prefixed !!) and auto-pause to show them
  useEffect(() => {
    if (state.log.length < lastLogLenRef.current) lastLogLenRef.current = 0  // new battle
    const newEntries = state.log.slice(lastLogLenRef.current)
    lastLogLenRef.current = state.log.length
    if (!loadBattlePopups()) return
    const important = newEntries.filter(e => e.startsWith('!!')).map(e => e.slice(2))
    if (important.length === 0) return
    setImportantMsgQueue(q => [...q, ...important])
    onPause?.(true)
  }, [state.log])

  const dismissImportantMsg = () => {
    setImportantMsgQueue(prev => {
      const next = prev.slice(1)
      if (next.length === 0 && !paused) onPause?.(false)
      return next
    })
  }

  // Auto-dismiss the current important message after x s (resets for each new message)
  useEffect(() => {
    if (importantMsgQueue.length === 0) return
    const id = setTimeout(dismissImportantMsg, modalAutoDismissTime)
    return () => clearTimeout(id)
  }, [importantMsgQueue[0]])

  const gameTimeSec = Math.floor(state.gameTime / 1000)
  const minutes = Math.floor(gameTimeSec / 60)
  const seconds = gameTimeSec % 60
  const elapsedStr = `${minutes}:${String(seconds).padStart(2, '0')}`
  const countdownMs = Math.max(0, SUDDEN_DEATH_FORCE_MS - state.gameTime)
  const cdSec = Math.ceil(countdownMs / 1000)
  const cdMin = Math.floor(cdSec / 60)
  const cdSecRem = cdSec % 60
  const countdownStr = `${cdMin}:${String(cdSecRem).padStart(2, '0')}`
  const timeStr = (isCampaign && !state.suddenDeath) ? countdownStr : elapsedStr
  const sdSec = Math.ceil(state.suddenDeathTimer / 1000)
  const event = state.activeBattleEvent

  // The battlefield always renders at a fixed aspect ratio (BATTLEFIELD_ASPECT_RATIO),
  // letterboxed within the stage rather than stretched — see useLetterboxSize. Falls
  // back to filling the stage until the first ResizeObserver measurement lands.
  const frameStyle: React.CSSProperties = frameSize
    ? { width: frameSize.width, height: frameSize.height }
    : { width: '100%', height: '100%' }
  // Rounded to whole pixels: BattlefieldCanvas measures its own box with
  // Math.ceil, so a fractional size would land the canvas a pixel off the ratio
  // and reintroduce a small collision/art drift across the lane's 17 columns.
  const laneStyle: React.CSSProperties = laneSize
    ? { width: Math.round(laneSize.width), height: Math.round(laneSize.height) }
    : { width: '100%', height: '100%' }
  const isCompactFrame = !!frameSize && frameSize.width <= 480
  const isTinyFrame = !!frameSize && frameSize.width <= 380
  const frameClassName = `battlefield-frame${isCompactFrame ? ' battlefield-frame--compact' : ''}${isTinyFrame ? ' battlefield-frame--tiny' : ''}`

  return (
    <div
      ref={stageRef}
      className={`battlefield u-grow${actTheme ? ` battlefield--${actTheme}` : ''}${paused ? ' battlefield--paused' : ''}`}
      onClick={paused && !inspectedUnit ? () => doPause(false) : undefined}
    >
    <div className={frameClassName} style={frameStyle}>

      {/* Dramatic battle event overlay (center-screen flash) */}
      <BattleEventOverlay event={event} />

      {/* Important message banner — pauses game until dismissed */}
      {importantMsgQueue.length > 0 && (
        <div key={importantMsgQueue[0]} className="bf-important-msg" onClick={dismissImportantMsg} role="alertdialog">
          <div className="bf-important-msg-text">{importantMsgQueue[0]}</div>
          {importantMsgQueue.length > 1 && (
            <div className="bf-important-msg-count">+{importantMsgQueue.length - 1} more</div>
          )}
        </div>
      )}

      {/* Hero spawn lightning bolt */}
      {heroLightning && (
        <div key={heroLightning.key} className={`hero-lightning hero-lightning--${heroLightning.owner}`}>
          <svg viewBox="0 0 60 200" xmlns="http://www.w3.org/2000/svg" className="hero-lightning-bolt">
            <polygon points="36,0 18,90 32,90 14,200 52,75 36,75 54,0" fill="#ffe066" opacity="0.95"/>
            <polygon points="36,0 18,90 32,90 14,200 52,75 36,75 54,0" fill="white" opacity="0.4" transform="scale(0.6) translate(16,16)"/>
          </svg>
        </div>
      )}

      {/* Sudden death banner */}
      {state.suddenDeath && (
        <div className="sudden-death-overlay">
          <span className="sudden-death-icon">⚡</span>
          <span className="sudden-death-text">SUDDEN DEATH — {sdSec}s</span>
        </div>
      )}

      {/* Top cluster: floats above the lane in the reserved top band */}
      <div className="bf-top-cluster">
      {/* Top bar: clock, scores */}
      <div className={`top-bar${state.suddenDeath ? ' top-bar--sudden-death' : ''}`}>
        <button className="bf-pause-btn" onClick={() => doPause(true)} title="Menu">MENU</button>
        <span className="game-clock">{timeStr}</span>
        {state.endlessMode && (
          <span className="endless-wave-chip">WAVE {state.endlessWave ?? 1}</span>
        )}
        {state.endlessMode && (state.endlessWaveTruceMs ?? 0) > 0 && (
          <span className="endless-truce-chip">TRUCE {Math.ceil((state.endlessWaveTruceMs ?? 0) / 1000)}s</span>
        )}
        <span className="score-display">
          <span className="score-player">{state.playerScore}</span>
          <span className="score-sep"> – </span>
          <span className="score-opponent">{state.opponentScore}</span>
        </span>
        {event && (
          <span className={`event-status-chip event-status-chip--${event.type}`}>
            {event.type === 'bloodMoon' ? '🌑 BLOOD MOON'
            : event.type === 'fogOfWar' ? '🌫 FOG OF WAR'
            : event.type === 'supplyDrop' ? '📦 SUPPLY DROP'
            : '🌋 QUAKE'}
          </span>
        )}
        {activeRelic && (() => {
          const def = getRelicDef(activeRelic)
          return def ? (
            <span className="relic-chip" title={def.desc}>
              {def.icon} {def.name}
            </span>
          ) : null
        })()}
        {isNoDamageMode() && (
          <span className="dev-badge">DEV MODE</span>
        )}
      </div>

      {/* Replay modifier strip — only shown in pause menu */}
      {paused && activeModifiers && activeModifiers.length > 0 && (
        <div className="replay-modifier-strip u-flex u-wrap u-gap-2">
          {activeModifiers.map((m, i) => (
            <span key={i} className="replay-modifier-tag">⚠ {m.label}</span>
          ))}
        </div>
      )}

      {/* Opponent base */}
      <div className="base-bar base-bar--opponent">
        <img
          className="base-bar-portrait base-bar-portrait--opponent"
          src={`${BASE_SPRITE_PATH}${opponentCommanderSlug}.svg`}
          alt="opponent"
        />
        <HpBar current={state.opponentBase.hp} max={state.opponentBase.maxHp} color="#ff4444" />
        <span className="base-bar-info u-flex u-items-c u-gap-3">
          {STRATEGY_LABELS[state.opponentStrategy] && (
            <span className="strategy-label">{STRATEGY_LABELS[state.opponentStrategy]}</span>
          )}
        </span>
      </div>
      </div>

      {/* The Lane — letterboxed to LANE_ASPECT_RATIO inside the slot the HUD
          bands leave, so its shape (and therefore its tile grid) is the same on
          every device. The slot is the absolutely-positioned box; the lane is
          the play area centred within it. */}
      {(() => {
        return (
      <div className="lane-slot" ref={laneSlotRef}>
      <div
        className={`lane${pendingAoeCard ? ' lane--aoe-targeting' : ''}`}
        style={laneStyle}
      >
        <BattlefieldCanvas
          state={state}
          paused={paused}
          onInspect={u => setInspectedUnit(u)}
          playerAvatar={playerAvatar}
          opponentCommanderSlug={opponentCommanderSlug}
          pendingAoeCard={pendingAoeCard}
          onPlayAoeCard={onPlayAoeCard}
          onAoeCancel={() => setPendingAoeCard(null)}
          debugOverlay={debugOverlay}
          selectedUnitId={inspectedUnit?.id ?? null}
        />

        {/* AoE targeting overlay */}
        {pendingAoeCard && (
          <div className="aoe-targeting-banner">
            <span>⚡ {pendingAoeCard.name} — tap to place</span>
            <button className="aoe-targeting-cancel" onClick={e => { e.stopPropagation(); setPendingAoeCard(null) }}>✕</button>
          </div>
        )}

        {/* Opponent spell-cast telegraph + Counter QTE */}
        {state.pendingSpellCast && (() => {
          const cast = state.pendingSpellCast!
          const remainingMs = Math.max(0, cast.resolvesAtMs - state.gameTime)
          const pct = Math.max(0, Math.min(1, remainingMs / CAST_WINDUP_MS))
          const elapsed = state.gameTime - cast.startedAtMs
          // The damage cap a press would lock in right now — grows linearly the longer the
          // player waits, so "waiting for a better moment" is never actually better.
          const liveCapPct = Math.max(COUNTER_DAMAGE_FLOOR_PCT, Math.min(1, elapsed / CAST_WINDUP_MS))
          const dangerZone = liveCapPct >= 0.7
          return (
            <>
              <div className="spell-cast-banner">
                <span className="spell-cast-banner-name">⚡ {cast.cardName} incoming!</span>
                <span className="spell-cast-banner-timer">{(remainingMs / 1000).toFixed(1)}s</span>
                <div className="spell-cast-banner-bar"><div className="spell-cast-banner-bar-fill" style={{ width: `${pct * 100}%` }} /></div>
              </div>
              {cast.counterPct == null && (
                <button className={`spell-cast-counter-btn ${dangerZone ? 'spell-cast-counter-btn--closing' : ''}`} onClick={() => onCounterSpell?.()}>
                  COUNTER! <span className="spell-cast-counter-btn-cap">(caps at {Math.round(liveCapPct * 100)}%)</span>
                </button>
              )}
              {cast.counterPct != null && (() => {
                const gradeColor = `hsl(${140 - 110 * cast.counterPct!}, 80%, 65%)`
                return (
                  <div className="spell-cast-grade" style={{ borderColor: gradeColor, color: gradeColor }}>
                    COUNTERED! Capped at {Math.round(cast.counterPct! * 100)}% HP
                  </div>
                )
              })()}
            </>
          )
        })()}
      </div>
      </div>
        )
      })()}

      {/* Bottom cluster: floats below the lane in the reserved bottom band */}
      <div className="bf-bottom-cluster">
      {/* Player base */}
      <div className="base-bar base-bar--player">
        <img
          className="base-bar-portrait base-bar-portrait--player"
          src={`${BASE_SPRITE_PATH}${playerAvatar}.svg`}
          alt={playerName}
        />
        <HpBar current={state.playerBase.hp} max={state.playerBase.maxHp} color="#33ff33" />
        <span className="base-bar-info u-flex u-items-c u-gap-3">
          MANA {state.mana}/{state.maxMana}
          <ManaBar mana={state.mana} maxMana={state.maxMana} manaAccum={state.manaAccum} />
        </span>
      </div>

      {/* Stance + speed controls */}
      {(() => {
        const rules = state.stanceRules
        const onCooldown = rules?.cooldownMs !== undefined &&
          state.stanceCooldownUntil !== undefined &&
          state.gameTime < state.stanceCooldownUntil
        const cooldownSecsLeft = onCooldown
          ? Math.ceil((state.stanceCooldownUntil! - state.gameTime) / 1000)
          : 0
        const durationSecsLeft = (state.stanceActiveUntil !== undefined && stance !== 'auto')
          ? Math.ceil((state.stanceActiveUntil - state.gameTime) / 1000)
          : 0

        return (
          <div className="stance-bar">
            {(['attack', 'hold', 'defend', 'auto'] as const).map(s => {
              const isAllowed = !rules || rules.allowed.includes(s)
              if (!isAllowed) return null
              const label = s === 'attack' ? 'CHARGE' : s === 'hold' ? 'HOLD' : s === 'defend' ? 'DEFEND' : 'ATTACK'
              const isActive = stance === s
              const isCoolingDown = onCooldown && s !== 'auto' && !isActive
              const showCountdown = isActive && s !== 'auto' && durationSecsLeft > 0
              const showCooldown  = isCoolingDown && cooldownSecsLeft > 0
              return (
                <button
                  key={s}
                  className={`filter-btn${isActive ? ' filter-btn--active' : ''}${isCoolingDown ? ' filter-btn--cooldown' : ''}`}
                  onClick={() => onSetStance?.(s)}
                  disabled={(state.suddenDeath && s !== 'attack') || isCoolingDown}
                  title={isCoolingDown ? `Available in ${cooldownSecsLeft}s` : undefined}
                >
                  {label}
                  {showCountdown && <span className="stance-timer"> {durationSecsLeft}s</span>}
                  {showCooldown  && <span className="stance-timer stance-timer--cd"> {cooldownSecsLeft}s</span>}
                </button>
              )
            })}
            <button className="filter-btn stance-bar__speed" onClick={onCycleSpeed}>
              x{speedMultiplier}
            </button>
          </div>
        )
      })()}

      {/* Hand */}
      {(() => {
        const truceMs = state.endlessWaveTruceMs ?? 0
        const truceLocked = truceMs > 0
        return (
      <div className={`hand-panel${truceLocked ? ' hand-panel--truce' : ''}`}>
        {truceLocked && (
          <div className="hand-truce-banner">
            Regrouping… <span className="hand-truce-secs">{Math.ceil(truceMs / 1000)}s</span>
          </div>
        )}
        <div className="hand-cards u-flex u-gap-3 u-just-c">
          {state.playerHand.length === 0
            ? <span className="field-empty">No cards</span>
            : state.playerHand.map(card => {
              const heroLockedSecs = card.isHero
                ? Math.ceil(Math.max(0, 30000 - state.gameTime) / 1000)
                : 0
              const isMaxUpgrade = card.cardType === 'structure' && card.unit != null &&
                state.field.some(u => u.owner === 'player' && u.name === card.unit!.name && (u.upgradeLevel ?? 1) >= MAX_UPGRADE_LEVEL)
              return (
              <div key={card.id} className="hand-card-wrap u-relative u-col" title={isMaxUpgrade ? 'Already at max level' : undefined}>
                <CardTile
                  card={card}
                  canAfford={!isMaxUpgrade && state.mana >= getEffectiveCardCost(card, state)}
                  displayCost={getEffectiveCardCost(card, state)}
                  onClick={() => {
                    if (truceLocked) return
                    if (onPlayAoeCard && card.cardType === 'upgrade' && card.upgradeEffect?.type === 'aoe') {
                      setPendingAoeCard(card)
                    } else {
                      onPlayCard(card.id)
                    }
                  }}
                  lockedSecs={heroLockedSecs}
                />
                <button
                  className="hand-card-info-btn"
                  onClick={e => { e.stopPropagation(); openDetail(card) }}
                >ⓘ</button>
              </div>
            )})}
        </div>
      </div>
        )
      })()}
      </div>

      {cardDetailNode}

      {showBossSplash && (
        <div className="boss-splash-overlay u-absolute u-flex u-items-c u-just-c">
          <div className="boss-splash-content u-text-c u-col u-gap-4">
            <div className="boss-splash-warning">⚡ WARNING ⚡</div>
            <div className="boss-splash-title">BOSS FIGHT</div>
            <div className="boss-splash-unit">{state.bossName ?? state.bossCard}</div>
            <div className="boss-splash-sub">has entered the battlefield</div>
          </div>
        </div>
      )}

      {/* Pause panel — anchored, no backdrop so the field remains tappable */}
      {paused && importantMsgQueue.length === 0 && (
        <div className="bf-pause-panel" onClick={e => e.stopPropagation()}>
            {inspectedUnit ? (
              <div className="bf-inspect-panel u-col u-items-c u-gap-2 u-grow">
                {/* Name + buffs */}
                <div className="bf-inspect-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>
                    {inspectedUnit.name}
                    {inspectedUnit.upgradeLevel != null && inspectedUnit.upgradeLevel >= 2 && (
                      <span className={`lane-unit-level lane-unit-level--${Math.min(inspectedUnit.upgradeLevel, MAX_UPGRADE_LEVEL)}`}>
                        {' '}{'★'.repeat(inspectedUnit.upgradeLevel)}
                      </span>
                    )}
                  </span>
                  {(inspectedUnit.buffs && inspectedUnit.buffs.length > 0 || inspectedUnit.affinityActive) && (
                    <div className="lane-unit-buffs u-row u-just-c" style={{ justifyContent: 'flex-start', gap: 4 }}>
                      {inspectedUnit.buffs?.map(tag => (
                        <span key={tag} className={`lane-unit-buff lane-unit-buff--${tag}`}>
                          {tag === 'atk' ? '⚔ atk' : tag === 'spd' ? '▶ spd' : tag === 'hp' ? '♥ hp' : '◎ rng'}
                        </span>
                      ))}
                      {inspectedUnit.affinityActive && (
                        <span className="lane-unit-buff lane-unit-buff--affinity">✦ {inspectedUnit.affinity?.label ?? 'affinity'}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Traits — directly below name row */}
                {(() => {
                  const u = inspectedUnit
                  const traits: string[] = []
                  if (u.moveSpeed === 0) traits.push('structure')
                  if (u.isWall)         traits.push('wall')
                  if (u.flying)         traits.push('flying')
                  if (u.climber)        traits.push('climber')
                  if (u.bypassWall && u.moveSpeed > 0) traits.push('ranged')
                  for (const t of (u.tags ?? [])) { if (!traits.includes(t)) traits.push(t) }
                  return traits.length > 0 ? (
                    <div className="cdm-traits u-flex u-wrap u-gap-2">
                      {traits.map(t => <span key={t} className="cdm-trait">{t}</span>)}
                    </div>
                  ) : null
                })()}

                {/* Scrollable detail area */}
                <div className="bf-inspect-scroll u-grow u-col u-gap-2">
                  <div className="bf-inspect-stats">
                    <div className="bf-inspect-row"><span>HP</span><span>{inspectedUnit.hp}/{inspectedUnit.maxHp}</span></div>
                    {inspectedUnit.attack > 0 && (
                      <div className="bf-inspect-row"><span>ATK</span><span>{inspectedUnit.attack}</span></div>
                    )}
                    {inspectedUnit.upgradeLevel != null && inspectedUnit.upgradeLevel >= 2 && (
                      <div className="bf-inspect-row"><span>Lvl</span><span>{inspectedUnit.upgradeLevel}</span></div>
                    )}
                  </div>

                  {/* Strengths, Weaknesses & Affinity — all on one line */}
                  {(inspectedUnit.strengths?.length || inspectedUnit.weaknesses?.length || inspectedUnit.affinity) ? (
                    <div className="cdm-sw-row u-flex u-gap-3" style={{ flexWrap: 'wrap', gap: '0 8px' }}>
                      {inspectedUnit.strengths && inspectedUnit.strengths.length > 0 && (
                        <span className="cdm-sw-label--strong">↑ {inspectedUnit.strengths.join(', ')}</span>
                      )}
                      {inspectedUnit.weaknesses && inspectedUnit.weaknesses.length > 0 && (
                        <span className="cdm-sw-label--weak">↓ {inspectedUnit.weaknesses.join(', ')}</span>
                      )}
                      {inspectedUnit.affinity && (
                        <span className="cdm-sw-label--affinity">♥ {inspectedUnit.affinity.label}{inspectedUnit.affinityActive ? ' ✦' : ''}</span>
                      )}
                    </div>
                  ) : null}

                  {/* Lore */}
                  {getUnitLore(inspectedUnit.name) && (
                    <div className="bf-inspect-lore">"{getUnitLore(inspectedUnit.name)}"</div>
                  )}
                </div>

                <Button size="xs" style={{ marginTop: 4 }} onClick={() => setInspectedUnit(null)}>← Back</Button>
              </div>
            ) : showDeckViewer ? (
              <div className="bf-deck-viewer u-col u-gap-3">
                <div className="bf-deck-viewer-header">
                  <span>MY DECK</span>
                  <Button size="xs" onClick={() => setShowDeckViewer(false)}>← Back</Button>
                </div>
                <div className="bf-deck-viewer-list u-grow u-col u-gap-1">
                  {(() => {
                    const catalog = getCardCatalog()
                    const inHand = new Set(state.playerHand.map(c => c.id))
                    const handCards = state.playerHand.map(c => ({ card: c, status: 'hand' as const }))
                    const deckCards = state.playerDeck.map(c => ({ card: c, status: 'deck' as const }))
                    const playedCards = Object.entries(state.battleStats?.cardsPlayed ?? {}).flatMap(([name, count]) => {
                      const found = catalog.find(c => c.name === name)
                      if (!found) return []
                      return Array.from<unknown, { card: Card & { id: string }; status: 'played' }>(
                        { length: count },
                        (_, i) => ({ card: { ...found, id: `played-${name}-${i}` }, status: 'played' as const })
                      )
                    })
                    const all = [...handCards, ...deckCards, ...playedCards]
                    if (all.length === 0) return <span className="field-empty">No cards</span>
                    return all.map(({ card, status }) => (
                      <div key={card.id} className={`bf-deck-row bf-deck-row--${status}`}>
                        <span className="bf-deck-row-cost">{card.cost}</span>
                        <span className="bf-deck-row-name">{card.name}</span>
                        <span className="bf-deck-row-type">{card.cardType}</span>
                        {status === 'hand' && <span className="bf-deck-row-badge">HAND</span>}
                        {status === 'played' && <span className="bf-deck-row-badge bf-deck-row-badge--played">PLAYED</span>}
                      </div>
                    ))
                  })()}
                </div>
              </div>
            ) : (
              <>
                <div className="bf-pause-hint">Tap a unit or building on the field to inspect it</div>
                <div className="bf-pause-actions u-row u-gap-5">
                  <Button size="lg" onClick={() => doPause(false)}>▶ Resume</Button>
                  <Button size="md" onClick={() => setShowDeckViewer(true)}>📋 My Deck</Button>
                  {onGiveUp && (
                    <Button size="md" variant="danger" onClick={() => setConfirmGiveUp(true)}>✕ Give Up</Button>
                  )}
                  {(isDevMode() || isAdmin) && (
                    <Button
                      size="md"
                      onClick={() => {
                        const next = !debugOverlay
                        setDebugOverlay(next)
                        patchDevConfig({ battlefieldDebugOverlay: next })
                      }}
                    >
                      {debugOverlay ? '🟩 Tiles ON' : '⬛ Tiles OFF'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
      )}
      {confirmGiveUp && onGiveUp && (
        <ConfirmModal
          title="Abandon Run?"
          body="All progress for this run will be lost."
          confirmLabel="Yes, Abandon"
          onConfirm={onGiveUp}
          onCancel={() => setConfirmGiveUp(false)}
        />
      )}
      {showBattleTutorial && (
        <TutorialOverlay
          steps={BATTLE_TUTORIAL_STEPS}
          onDone={() => { markSeen(BATTLE_TUTORIAL_ID); setShowBattleTutorial(false) }}
        />
      )}
    </div>
    </div>
  )
}
