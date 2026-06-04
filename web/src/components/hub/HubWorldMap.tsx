import React, { useRef, useState, useEffect, useMemo } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { WORLD_MAP_NODES, WorldNodeDef } from '../../data/world/worldMapDef'
import { WORLD_DECOR_FILE, WORLD_ENV_TILES } from '../../data/tiles/worldTileIndex'
import { loadTileTexture, makeClickable } from '../../utils/pixiHelpers'
import { buildTerrainGfx, buildBorderGfx } from '../../utils/terrainLayer'
import { getCurrentWorldLocation, isNodeCleared } from '../../game/world/worldState'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { ToolbarDropdown } from '../ui/Toolbar/ToolbarDropdown'
import { useHubClock } from '../../hooks/useHubClock'
import { formatGameTime } from '../../game/hub/hubClock'
import { loadCrystals, loadCollection } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import { QuestsModal } from './QuestsModal'
import { HUB_QUEST_DEFS } from '../../data/hub/questDefs'
import { unmarkPickedUp } from '../../game/hub/pickups'
import { resetQuest } from '../../game/hub/quests'
import { LoginButton } from '../ui/LoginButton'
import { loadPlayerName } from '../../game/questline'
import type { User } from 'firebase/auth'

const MAP_W = 700
const MAP_H = 520
const DECOR_COLS = 8

function isNodeAvailable(node: WorldNodeDef): boolean {
  if (!node.requiredClears || node.requiredClears.length === 0) return true
  return node.requiredClears.every(req => {
    if (req.includes('|')) return req.split('|').some(id => isNodeCleared(id))
    return isNodeCleared(req)
  })
}

interface Props {
  onSelectNode:  (node: WorldNodeDef) => void
  onBack:        () => void
  user:         User | null
  onSignIn?:     () => void
  onSignOut?:    () => void
  onPlayerTap?:  () => void
  onFeedback?:   () => void
}

export function HubWorldMap({ onSelectNode, onBack, user, onSignIn, onSignOut, onPlayerTap, onFeedback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const deadRef      = useRef(false)
  const [selected, setSelected]   = useState<WorldNodeDef | null>(null)
  const [questsOpen, setQuestsOpen] = useState(false)
  const [wrongSave, setWrongSave]   = useState<{ cards: number; crystals: number; deck: number } | null>(null)
  const currentLocation = getCurrentWorldLocation()
  const { isNight: isGameNight } = useHubClock()
  const playerName = loadPlayerName()
  const crystals = loadCrystals()
  const { collectionCount, catalogTotal } = useMemo(() => {
    const catalog    = getCardCatalog()
    const collection = loadCollection()
    return {
      collectionCount: collection.filter(e => e.count > 0 && catalog.some(c => c.name === e.cardName)).length,
      catalogTotal: catalog.length,
    }
  }, [])

  useEffect(() => {
    if (Math.random() > 0.02) return
    const fake = { cards: Math.floor(Math.random() * catalogTotal), crystals: Math.floor(Math.random() * 9999), deck: Math.floor(Math.random() * 10) }
    setWrongSave(fake)
    const id = setTimeout(() => setWrongSave(null), 1800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleQuestAbandon = (questId: string) => {
    const quest = HUB_QUEST_DEFS.find(q => q.id === questId)
    if (!quest) return
    unmarkPickedUp(quest.steps.flatMap(s => s.pickupIds ?? []))
    resetQuest(questId)
  }

  useEffect(() => () => { deadRef.current = true }, [])

  usePixiApp(containerRef, MAP_W, MAP_H, async (app) => {
    deadRef.current = false

    // Layered ground
    const baseContainer  = new PIXI.Container()
    const riverContainer = new PIXI.Container()
    const worldLayer     = new PIXI.Container()
    app.stage.addChild(baseContainer, riverContainer, worldLayer)

    buildTerrainGfx(baseContainer, riverContainer, worldLayer,
      { environment: 'farmland', envDef: WORLD_ENV_TILES.farmland, terrainItems: [], rivers: [] },
      MAP_W, MAP_H)
    buildBorderGfx(worldLayer, { envDef: WORLD_ENV_TILES.farmland }, MAP_W, MAP_H)

    // Connection lines
    const pathGfx = new PIXI.Graphics()
    worldLayer.addChild(pathGfx)
    for (const node of WORLD_MAP_NODES) {
      for (const connId of node.connections) {
        const target = WORLD_MAP_NODES.find(n => n.id === connId)
        if (!target) continue
        const lit = isNodeAvailable(node) && isNodeAvailable(target)
        pathGfx
          .moveTo(node.x, node.y)
          .lineTo(target.x, target.y)
          .stroke({ color: lit ? 0xb08040 : 0x3a3a28, width: 6, alpha: lit ? 0.8 : 0.3 })
      }
    }

    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
    const decorUrl = `${base}${WORLD_DECOR_FILE.slice(1)}`

    for (const node of WORLD_MAP_NODES) {
      if (deadRef.current) return
      const available = isNodeAvailable(node)
      const isCurrent = node.id === currentLocation
      const container = new PIXI.Container()
      container.position.set(node.x, node.y)

      // Node background circle
      const circle = new PIXI.Graphics()
      circle.circle(0, 0, 22)
        .fill({ color: isCurrent ? 0x1a6b1a : available ? 0x3a3a20 : 0x222218, alpha: 0.9 })
        .stroke({ color: isCurrent ? 0x66ff66 : available ? 0xccaa44 : 0x444430, width: 2 })
      container.addChild(circle)

      // WORLD_DECOR sprites
      for (let i = 0; i < node.decorTiles.length; i++) {
        try {
          const tex = await loadTileTexture(decorUrl, node.decorTiles[i], DECOR_COLS)
          if (deadRef.current) return
          const sprite = new PIXI.Sprite(tex)
          const off = node.decorOffsets?.[i] ?? [-16, -16]
          sprite.position.set(off[0], off[1])
          container.addChild(sprite)
        } catch { /* sprite unavailable */ }
      }

      // Lock badge for unavailable nodes
      if (!available && !isCurrent) {
        container.alpha = 0.38
        const lockLabel = new PIXI.Text({ text: '🔒',
          style: { fontSize: 13, fontFamily: 'monospace' } })
        lockLabel.anchor.set(0.5, 1)
        lockLabel.position.set(0, -25)
        container.addChild(lockLabel)
      }

      // Name label below node
      const label = new PIXI.Text({ text: node.name,
        style: { fontSize: 11, fill: '#ffffff', fontFamily: 'monospace',
          dropShadow: { alpha: 1, blur: 3, distance: 1, color: '#000000' } } })
      label.anchor.set(0.5, 0)
      label.position.set(0, 26)
      container.addChild(label)

      if (available || isCurrent) {
        makeClickable(container, () => setSelected(node))
      }

      worldLayer.addChild(container)
    }

    // Pulsing ring on current location node
    const curNode = WORLD_MAP_NODES.find(n => n.id === currentLocation)
    if (curNode) {
      const ring = new PIXI.Graphics()
      ring.position.set(curNode.x, curNode.y)
      worldLayer.addChild(ring)
      let t = 0
      app.ticker.add(() => {
        t += 0.04
        ring.clear()
        ring.circle(0, 0, 25 + Math.sin(t) * 5)
          .stroke({ color: 0x55ff55, width: 2, alpha: 0.4 + Math.sin(t) * 0.25 })
      })
    }
  })

  const isCurrent = selected?.id === currentLocation
  const canTravel = selected && isNodeAvailable(selected) && !isCurrent

  return (
    <OverlayScreen title="🗺 World Map">
      <Toolbar>
          <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>💎 {wrongSave ? wrongSave.crystals.toLocaleString() : crystals.toLocaleString()}</ToolbarLabel>
          <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>🃏 {wrongSave ? wrongSave.cards : collectionCount}/{catalogTotal}</ToolbarLabel>
          <ToolbarLabel className="title-deck-info">{isGameNight ? '🌙' : '☀️'} {formatGameTime()}</ToolbarLabel>
        <ToolbarButton icon="📜" title="Quests" onClick={() => setQuestsOpen(true)} />
        <ToolbarButton icon="🏠" title="Back to Town" onClick={onBack} />          
        <ToolbarSpacer />



        <div className="toolbar-overflow-inline">
                  <LoginButton onSignIn={() => onSignIn?.()} onSignOut={() => onSignOut?.()} onPlayerTap={onPlayerTap} user={user} playerName={playerName} />
        <ToolbarButton
          className="title-auth-btn"
          onClick={onFeedback}
          title="Send feedback or report a bug"
          icon={'🗣️'}
        />
        <ToolbarButton className="action-btn hub-hud__btn" onClick={onBack} icon={'⚙'}/>
        </div>
        <div className="toolbar-overflow-dropdown">
          <ToolbarDropdown label="📊" align="right">
        <LoginButton onSignIn={() => onSignIn?.()} onSignOut={() => onSignOut?.()} onPlayerTap={onPlayerTap} user={user} playerName={playerName} />
        <ToolbarButton
          className="title-auth-btn"
          onClick={onFeedback}
          title="Send feedback or report a bug"
          icon={'🗣️'}
        />
        <ToolbarButton className="action-btn hub-hud__btn" onClick={onBack} icon={'⚙'}/>          </ToolbarDropdown>
        </div>

      </Toolbar>
      {questsOpen && <QuestsModal onClose={() => setQuestsOpen(false)} onAbandon={handleQuestAbandon} />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div ref={containerRef} style={{ cursor: 'crosshair' }} />
        {selected && (
          <div className="nm-peek-backdrop" onClick={() => setSelected(null)}>
            <div className="nm-peek-panel" onClick={e => e.stopPropagation()}>
              <div className="nm-peek-header u-col u-items-c u-gap-1">
                <span className={`nm-peek-type nm-node-type-badge--${selected.type}`}>
                  {selected.type.toUpperCase()}
                </span>
              </div>
              <div style={{ fontWeight: 'bold', margin: '6px 0 2px', textAlign: 'center' }}>
                {selected.name}
              </div>
              {isCurrent && (
                <div style={{ color: '#88ee88', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                  Current location
                </div>
              )}
              {!isCurrent && !canTravel && (
                <div style={{ color: '#888', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                  🔒 Not yet accessible
                </div>
              )}
              {canTravel && (
                <button
                  className="action-btn"
                  style={{ marginTop: 8, display: 'block', width: '100%' }}
                  onClick={() => { setSelected(null); onSelectNode(selected) }}
                >
                  Travel ➤
                </button>
              )}
              <button
                style={{ marginTop: 6, background: 'transparent', border: '1px solid #555', color: '#aaa', cursor: 'pointer', padding: '2px 10px', fontSize: 12, width: '100%' }}
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
