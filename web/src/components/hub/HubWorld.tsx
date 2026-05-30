import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { HubTownCanvas } from './HubTownCanvas'
import { AreaNameBadge } from './AreaNameBadge'
import { HubReturnButton } from './HubReturnButton'
import { HubDialogue } from './HubDialogue'
import { AVATAR_START, MAP_W, MAP_H } from '../../data/hubLayout'
import { loadDeck, loadCollection, deckTotalCards } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import { CommanderState } from '../../game/commander'
import { loadSkipIntro } from '../screens/SettingsScreen'
import { getSavedHubTile } from './HubTownCanvas'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { User } from 'firebase/auth'
import { loadPlayerName } from '../../game/questline'
import { LoginButton } from '../ui/LoginButton'
const T = 32
const INITIAL_SCROLL = {
  x: AVATAR_START[0] * T + T / 2,
  y: AVATAR_START[1] * T + T / 2,
}
const SPLASH_MS = 10_000

// Module-level flag: once dismissed in this session, never re-show
let _hubSplashShown = false

interface Props {
  onBack:             () => void
  onUseTitleScreen?:  () => void
  onNavigate?:        (screen: string) => void
  onCampaign?:        () => void
  onPlayerTap?:       () => void
  crystals?:          number
  isSignedIn?:        boolean
  commander?: CommanderState
  user: User | null
  onSignIn?:   () => void
  onSignOut?:         () => void
  onFeedback: () => void
  onTileTap?:         (tx: number, ty: number) => void
}

export function HubWorld({ onBack, onUseTitleScreen, onNavigate, onCampaign, onPlayerTap, crystals = 0, isSignedIn = false, commander, user, onSignIn: onLoginToggle, onSignOut, onFeedback, onTileTap }: Props) {
  const [splashVisible, setSplashVisible] = useState(() => !_hubSplashShown && !loadSkipIntro())
  const [splashFading,  setSplashFading]  = useState(false)
  const [currentArea,    setCurrentArea]    = useState<string | null>(null)
  const [dialogueLine,   setDialogueLine]   = useState<string | null>(null)
  const [interiorActive, setInteriorActive] = useState(false)
  const scrollRef        = useRef<HTMLDivElement>(null)
  const returnRef        = useRef(null) as React.MutableRefObject<(() => void) | null>
  const interiorEnterRef = useRef<((buildingId: string) => void) | null>(null)
  const interiorExitRef  = useRef<(() => void) | null>(null)
    const playerName = loadPlayerName()

  const unitCards = useMemo(() => {
    const deck    = loadDeck()
    const catalog = getCardCatalog()
    const names   = new Set(deck.map(e => e.cardName))
    return catalog
      .filter(c => c.cardType === 'unit' && names.has(c.name))
      .map(c => c.name)
  }, [])


  // Secret #9 — Wrong Save File: rare title-screen glitch showing fake stats
  const [wrongSave, setWrongSave] = useState<{ cards: number; crystals: number; deck: number } | null>(null)
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

  const { collectionCount, catalogTotal } = useMemo(() => {
    const catalog    = getCardCatalog()
    const collection = loadCollection()
    return {
      collectionCount: collection.filter(
        e => e.count > 0 && catalog.some(c => c.name === e.cardName)
      ).length,
      catalogTotal: catalog.length,
    }
  }, [])

  const dismissSplash = useCallback(() => {
    _hubSplashShown = true
    setSplashFading(true)
    setTimeout(() => setSplashVisible(false), 500)
  }, [])

  useEffect(() => {
    if (!splashVisible) return
    const t = setTimeout(dismissSplash, SPLASH_MS)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAvatarMove = useCallback((px: number, py: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = px - el.clientWidth  / 2
    el.scrollTop  = py - el.clientHeight / 2
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const saved = getSavedHubTile()
    const px = saved ? saved[0] * T + T / 2 : INITIAL_SCROLL.x
    const py = saved ? saved[1] * T + T / 2 : INITIAL_SCROLL.y
    el.scrollLeft = px - el.clientWidth  / 2
    el.scrollTop  = py - el.clientHeight / 2
  }, [])

  const handleNodeInteract = useCallback((screen: string) => {
    if (screen.startsWith('interior:')) {
      const buildingId = screen.slice(9)
      setInteriorActive(true)
      interiorEnterRef.current?.(buildingId)
      return
    }
    if (screen === 'campaign') { onCampaign?.(); return }
    onNavigate?.(screen)
  }, [onNavigate, onCampaign])

  const handleReturn = useCallback(() => {
    returnRef.current?.()
  }, [])

  const handleLeaveInterior = useCallback(() => {
    interiorExitRef.current?.()
    setInteriorActive(false)
  }, [])

  return (
    <OverlayScreen title="JARVS AMAZING WEB GAME">
              <Toolbar>
                
            <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>💎 {wrongSave ? wrongSave.crystals.toLocaleString() : crystals.toLocaleString()}</ToolbarLabel>
            <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>🃏 {wrongSave ? wrongSave.cards : collectionCount}/{catalogTotal}</ToolbarLabel>
            <ToolbarSpacer/>
     
                 <LoginButton onSignIn={() => onLoginToggle?.()} onSignOut={() => onSignOut?.()} onPlayerTap={onPlayerTap} user={user} playerName={playerName} />
          <ToolbarButton
            className="title-auth-btn"
            onClick={onFeedback}
            title="Send feedback or report a bug"
            icon={'🗣️'}
          />
          
          {onUseTitleScreen && (
            <ToolbarButton className="action-btn hub-hud__btn" onClick={onUseTitleScreen} icon={'⌂'} title="Use Title Screen as home" />
          )}
                      <ToolbarButton className="action-btn hub-hud__btn" onClick={onBack} icon={'⚙'}/>

          </Toolbar>


      <div
        className="nm-map nm-map--camp"
        style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
      >
        <div
          ref={scrollRef}
          style={{ overflowX: 'auto', overflowY: 'auto', width: '100%', height: '100%' }}
        >
          <HubTownCanvas
            onAreaEnter={setCurrentArea}
            onNodeInteract={handleNodeInteract}
            onAvatarMove={handleAvatarMove}
            returnRef={returnRef}
            unitCards={unitCards}
            commander={commander}
            onNpcTap={setDialogueLine}
            interiorEnterRef={interiorEnterRef}
            interiorExitRef={interiorExitRef}
            onExitInterior={() => setInteriorActive(false)}
            onTileTap={onTileTap}
          />
        </div>
        <AreaNameBadge name={currentArea} />


        <HubDialogue line={dialogueLine} onClose={() => setDialogueLine(null)} />
        {interiorActive && (
          <button
            className="action-btn"
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
            onClick={handleLeaveInterior}
          >
            LEAVE
          </button>
        )}

        {/* Persistent HUD — always visible */}
        {/* <div className="hub-hud">
          <div className="hub-hud__stats">
            <span>💎 {crystals}</span>
            <span>🃏 {collectionCount}/{catalogTotal}</span>
          </div>
        </div> */}

        {splashVisible && (
          <div
            className={`hub-splash${splashFading ? ' hub-splash--fading' : ''}`}
            onClick={dismissSplash}
          >
            <div className="title-logo">JARV'S</div>
            <div className="title-subtitle">AMAZING WEB GAME</div>
            <div className="title-logo-ornament">· · · · ·</div>
            <div className="title-deck-info">{collectionCount}/{catalogTotal} cards &nbsp;·&nbsp; 💎 {crystals}</div>
            <p className="hub-splash__hint">tap to continue</p>
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
