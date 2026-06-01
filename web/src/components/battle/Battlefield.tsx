import React, { useRef, useEffect, useState } from 'react'
import { BattlefieldTerrainCanvas } from './battlefield/BattlefieldTerrainCanvas'
import battlefieldConfig from '../../data/battlefield.json'
import { GameState, Unit, LANE_WIDTH, Card, TerrainObstacle, TerrainType, BuffTag, TERRAIN_AVOID_SHAPE } from '../../game/types'
import { CardTile } from '../cards/CardTile'
import { useCardDetail } from '../cards/useCardDetail'
import { SpriteImg, AnimatedSpriteImg } from '../ui/SpriteImg'
import { spriteSlug } from '../../game/sprites'
import { BattleEventOverlay } from './BattleEventOverlay'
import { isNoDamageMode, isDebugMode } from '../../game/debug'
import { MAX_UPGRADE_LEVEL, getEffectiveCardCost } from '../../game/engine/cards'
import { SUDDEN_DEATH_FORCE_MS } from '../../game/engine/suddenDeath'
import { getRelicDef } from '../../game/relics'
import { getUnitLore, getCardCatalog } from '../../game/cards'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../modals/ConfirmModal'
import { loadPlayerName, loadPlayerAvatar } from '../../game/questline'
import { loadBattlePopups } from '../screens/SettingsScreen'
import { TutorialOverlay } from '../modals/TutorialOverlay'
import { hasSeen, markSeen } from '../../game/tutorial'

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
}

const SPAWN_GROW_MS = 1500

// ─── Moat graphic ────────────────────────────────────────────────────────────
// Full-width terrain channel rendered in place of the sprite for moat units.
// Each variant has distinct colours and detail elements.

const MoatSvg = React.memo(function MoatSvg({ owner, name }: { owner: 'player' | 'opponent'; name: string }) {
  const W = 360, H = 16
  const edgeCol = 'rgba(0,0,0,0.55)'
  const rippleXs = [20, 65, 110, 155, 200, 245, 290, 335]

  // ── Lava Moat ─────────────────────────────────────────────────────────────
  if (name === 'Lava Moat') {
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#6a1000"/>
          <rect x="0" y="2" width={W} height="12" fill="#c83000" opacity="0.7"/>
          {rippleXs.map((x, i) => <ellipse key={i} cx={x} cy="8" rx="20" ry="3" fill="none" stroke="rgba(255,180,0,0.45)" strokeWidth="1"/>)}
          {[40, 120, 200, 280].map((x, i) => <ellipse key={i} cx={x} cy="8" rx="8" ry="4" fill="#ff6a00" opacity="0.5"/>)}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Acid Moat ─────────────────────────────────────────────────────────────
  if (name === 'Acid Moat') {
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#1a3a00"/>
          <rect x="0" y="2" width={W} height="12" fill="#4aaa00" opacity="0.6"/>
          {rippleXs.map((x, i) => <ellipse key={i} cx={x} cy="8" rx="20" ry="3" fill="none" stroke="rgba(150,255,50,0.4)" strokeWidth="0.9"/>)}
          {[55, 135, 215, 300].map((x, i) => <circle key={i} cx={x} cy="6" r="3" fill="rgba(180,255,0,0.5)"/>)}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Spike Pit ─────────────────────────────────────────────────────────────
  if (name === 'Spike Pit') {
    const spikePts = (cx: number) => `${cx},2 ${cx-4},14 ${cx},10 ${cx+4},14`
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#2a1a0a"/>
          <rect x="0" y="10" width={W} height="6" fill="#3a2a18" opacity="0.9"/>
          {[30, 75, 120, 165, 210, 255, 300, 345].map((x, i) => (
            <polygon key={i} points={spikePts(x)} fill="#8a8a8a" stroke="#4a4a4a" strokeWidth="0.5"/>
          ))}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Tar Pit ───────────────────────────────────────────────────────────────
  if (name === 'Tar Pit') {
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#0a0808"/>
          <rect x="0" y="2" width={W} height="12" fill="#1a1212" opacity="0.85"/>
          {rippleXs.map((x, i) => <ellipse key={i} cx={x} cy="8" rx="18" ry="2.5" fill="none" stroke="rgba(80,60,40,0.5)" strokeWidth="0.8"/>)}
          {[90, 180, 270].map((x, i) => <circle key={i} cx={x} cy="7" r="4" fill="rgba(30,20,10,0.8)" stroke="rgba(60,40,20,0.4)" strokeWidth="0.5"/>)}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Frost Moat ────────────────────────────────────────────────────────────
  if (name === 'Frost Moat') {
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#0a2040"/>
          <rect x="0" y="2" width={W} height="12" fill="#3080b0" opacity="0.55"/>
          <rect x="0" y="0" width={W} height="5" fill="#c8e8ff" opacity="0.3"/>
          {rippleXs.map((x, i) => <ellipse key={i} cx={x} cy="8" rx="20" ry="3" fill="none" stroke="rgba(200,240,255,0.45)" strokeWidth="0.9"/>)}
          {[50, 150, 250, 350].map((x, i) => <polygon key={i} points={`${x},4 ${x-3},9 ${x},7 ${x+3},9`} fill="rgba(200,240,255,0.55)"/>)}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Poison Bog ────────────────────────────────────────────────────────────
  if (name === 'Poison Bog') {
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#0e200e"/>
          <rect x="0" y="2" width={W} height="12" fill="#2a5020" opacity="0.7"/>
          {rippleXs.map((x, i) => <ellipse key={i} cx={x} cy="8" rx="18" ry="2.5" fill="none" stroke="rgba(100,200,50,0.3)" strokeWidth="0.8"/>)}
          {[45, 130, 210, 295].map((x, i) => <ellipse key={i} cx={x} cy="7" rx="6" ry="3" fill="rgba(60,150,20,0.45)"/>)}
          {[80, 185, 275].map((x, i) => <circle key={i} cx={x} cy="9" r="2" fill="rgba(160,255,80,0.35)"/>)}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Lightning Rift ────────────────────────────────────────────────────────
  if (name === 'Lightning Rift') {
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#0a0a30"/>
          <rect x="0" y="2" width={W} height="12" fill="#1a1a60" opacity="0.7"/>
          {[40, 120, 200, 280].map((x, i) => (
            <polyline key={i} points={`${x},2 ${x-5},7 ${x+3},7 ${x-3},14`} fill="none" stroke="rgba(180,200,255,0.7)" strokeWidth="1.2"/>
          ))}
          {rippleXs.map((x, i) => <ellipse key={i} cx={x} cy="8" rx="18" ry="2.5" fill="none" stroke="rgba(100,120,255,0.35)" strokeWidth="0.8"/>)}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Quicksand ─────────────────────────────────────────────────────────────
  if (name === 'Quicksand') {
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#a08040"/>
          <rect x="0" y="2" width={W} height="12" fill="#c8a850" opacity="0.6"/>
          {rippleXs.map((x, i) => <ellipse key={i} cx={x} cy="8" rx="20" ry="3" fill="none" stroke="rgba(200,160,80,0.4)" strokeWidth="0.9"/>)}
          {[60, 160, 260].map((x, i) => <ellipse key={i} cx={x} cy="9" rx="9" ry="4" fill="rgba(140,100,30,0.45)"/>)}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Blood Pool ────────────────────────────────────────────────────────────
  if (name === 'Blood Pool') {
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#3a0010"/>
          <rect x="0" y="2" width={W} height="12" fill="#800020" opacity="0.75"/>
          {rippleXs.map((x, i) => <ellipse key={i} cx={x} cy="8" rx="20" ry="3" fill="none" stroke="rgba(200,0,40,0.35)" strokeWidth="0.8"/>)}
          {[70, 170, 270].map((x, i) => <ellipse key={i} cx={x} cy="8" rx="7" ry="3.5" fill="rgba(180,0,30,0.45)"/>)}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Shadow Mire ───────────────────────────────────────────────────────────
  if (name === 'Shadow Mire') {
    return (
      <div style={{ display:'block', width:'100%', height: H }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block' }} xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width={W} height={H} fill="#0a0018"/>
          <rect x="0" y="2" width={W} height="12" fill="#280050" opacity="0.7"/>
          {rippleXs.map((x, i) => <ellipse key={i} cx={x} cy="8" rx="20" ry="3" fill="none" stroke="rgba(160,80,255,0.35)" strokeWidth="0.9"/>)}
          {[50, 150, 250, 320].map((x, i) => <circle key={i} cx={x} cy="7" r="3" fill="rgba(120,0,200,0.4)"/>)}
          <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
          <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
        </svg>
      </div>
    )
  }

  // ── Default water moat ────────────────────────────────────────────────────
  const deep = owner === 'player' ? '#1a4a68' : '#1a3050'
  const mid  = owner === 'player' ? '#2a6888' : '#243858'
  return (
    <div style={{ display: 'block', width: '100%', height: H }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ display: 'block' }} xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width={W} height={H} fill={deep} opacity="0.9"/>
        <rect x="0" y="2" width={W} height="12" fill={mid} opacity="0.6"/>
        {rippleXs.map((x, i) => (
          <ellipse key={i} cx={x} cy="8" rx="22" ry="3" fill="none" stroke="rgba(120,210,255,0.35)" strokeWidth="0.9"/>
        ))}
        <rect x="0" y="0"  width={W} height="2" fill={edgeCol}/>
        <rect x="0" y={H-2} width={W} height="2" fill={edgeCol}/>
      </svg>
    </div>
  )
})

// ─── Wall graphic ─────────────────────────────────────────────────────────────
// Rendered in-place of the sprite for wall units.  Full-width SVG showing
// staggered stone blocks, battlements, and progressive damage cracks.

const WallSvg = React.memo(function WallSvg({ hp, maxHp, owner, wallNames = [] }: { hp: number; maxHp: number; owner: 'player' | 'opponent'; wallNames?: string[] }) {
  const dmgPct = 1 - hp / maxHp
  // Player = cool grey-blue stone; opponent = warm tan stone
  const [stone, hiStone, merlon] = owner === 'player'
    ? ['#606878', '#70788a', '#707888'] as const
    : ['#7a5838', '#8a6848', '#906a40'] as const
  const op = 1 - dmgPct * 0.4   // fade slightly with damage

  const hasThorn = wallNames.includes('Thornwall')
  const hasBone  = wallNames.includes('Bone Wall')

  return (
    <div className="wall-svg" style={{ display: 'block', width: '100%', height: 30 }}>
    <svg
      width="100%" height="30"
      viewBox="0 0 360 30"
      preserveAspectRatio="none"
      style={{ display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Bottom stone row — 12 blocks */}
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={`b${i}`} x={i*30+1} y="17" width="28" height="12" fill={stone}   stroke="#18100a" strokeWidth="0.8" opacity={op}/>
      ))}
      {/* Upper row (staggered) */}
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={`u${i}`} x={i*30-14} y="8" width="28" height="10" fill={hiStone} stroke="#18100a" strokeWidth="0.8" opacity={op}/>
      ))}
      {/* Battlements (merlons) */}
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={`m${i}`} x={i*52+2} y="1" width="22" height="9" fill={merlon} stroke="#18100a" strokeWidth="0.8" opacity={op}/>
      ))}
      {/* Base shadow strip */}
      <rect x="0" y="28" width="360" height="2" fill="#0a0500" opacity="0.4"/>

      {/* ── Bone Wall overlay: skulls in mortar joints, bone segments in face ── */}
      {hasBone && (
        <g opacity={op * 0.88}>
          {[45, 135, 225, 315].map((x, i) => (
            <g key={`sk${i}`} transform={`translate(${x}, 20)`}>
              <ellipse cx="0" cy="-3" rx="4" ry="3.5" fill="#d4c49a" stroke="#8a7a50" strokeWidth="0.5"/>
              <circle cx="-1.5" cy="-3.5" r="1" fill="#3a2a10"/>
              <circle cx="1.5"  cy="-3.5" r="1" fill="#3a2a10"/>
              <rect x="-3" y="0.5" width="6" height="1.8" rx="0.8" fill="#c8b480" stroke="#8a7a50" strokeWidth="0.4"/>
            </g>
          ))}
          {[75, 165, 255].map((x, i) => (
            <g key={`bn${i}`}>
              <line x1={x-7} y1={13} x2={x+7} y2={13} stroke="#d0c090" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx={x-7} cy={13} r="2.2" fill="#c8b480" stroke="#9a8a60" strokeWidth="0.5"/>
              <circle cx={x+7} cy={13} r="2.2" fill="#c8b480" stroke="#9a8a60" strokeWidth="0.5"/>
            </g>
          ))}
        </g>
      )}

      {/* ── Thornwall overlay: vine along top, thorn spikes, small leaves ── */}
      {hasThorn && (
        <g opacity={op * 0.92}>
          <path d="M0,13 Q45,7 90,12 Q135,17 180,10 Q225,5 270,11 Q315,16 360,10"
            fill="none" stroke="#3a6a1a" strokeWidth="2.5" strokeLinecap="round"/>
          {[18,52,88,122,158,192,228,262,298,332].map((x, i) => (
            <path key={`th${i}`}
              d={`M${x},11 L${x-3},5 M${x},11 L${x+3},4`}
              stroke="#1e4008" strokeWidth="1.2" strokeLinecap="round"/>
          ))}
          {[35,105,180,255,325].map((x, i) => (
            <ellipse key={`lf${i}`} cx={x} cy={9} rx="5" ry="2.8"
              fill="#4a8a22" stroke="#2a5a10" strokeWidth="0.6"
              transform={`rotate(${i % 2 === 0 ? -25 : 20}, ${x}, 9)`}/>
          ))}
        </g>
      )}

      {/* Progressive damage cracks */}
      {dmgPct > 0.25 && <line x1="86"  y1="8"  x2="83"  y2="29" stroke="#050200" strokeWidth="1.5" opacity="0.7"/>}
      {dmgPct > 0.45 && <line x1="200" y1="1"  x2="197" y2="29" stroke="#050200" strokeWidth="2"   opacity="0.8"/>}
      {dmgPct > 0.65 && (
        <>
          <line x1="145" y1="8"  x2="148" y2="29" stroke="#050200" strokeWidth="1.2" opacity="0.7"/>
          <line x1="290" y1="1"  x2="286" y2="29" stroke="#050200" strokeWidth="1.5" opacity="0.8"/>
        </>
      )}
      {/* Crumbled battlements at heavy damage */}
      {dmgPct > 0.5 && <rect x="106" y="1" width="22" height="9" fill="#050200" opacity="0.55"/>}
      {dmgPct > 0.75 && <rect x="264" y="1" width="22" height="9" fill="#050200" opacity="0.7"/>}
    </svg>
    </div>
  )
}, (prev, next) =>
  prev.hp === next.hp &&
  prev.maxHp === next.maxHp &&
  prev.owner === next.owner &&
  (prev.wallNames ?? []).join() === (next.wallNames ?? []).join()
)

/** Stable per-unit percentage offset derived from ID so overlapping units don't pile up. */
function unitJitter(id: string): { dxPct: number; dyPct: number } {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return {
    dxPct: ((h & 0xff) / 255 - 0.5) * 10,        // ±5% of lane width
    dyPct: (((h >> 8) & 0xff) / 255 - 0.5) * 10,  // ±5% of lane height
  }
}

/** Returns a CSS class suffix for persistent damage/blood augment based on HP ratio. */
function spriteDamageClass(hp: number, maxHp: number): string {
  if (maxHp <= 0 || hp >= maxHp) return ''
  const ratio = hp / maxHp
  if (ratio < 0.25) return ' lane-unit-sprite--damaged-heavy'
  if (ratio < 0.5)  return ' lane-unit-sprite--damaged-med'
  return ' lane-unit-sprite--damaged'
}

const LaneUnit = React.memo(function LaneUnit({ unit, stackIndex = 0, wallStack, onInspect, showName, celebrating = false, spriteOverride }: { unit: Unit; stackIndex?: number; wallStack?: Unit[]; onInspect?: (u: Unit) => void; showName?: boolean; celebrating?: boolean; spriteOverride?: string }) {
  const hpPct = Math.max(0, (unit.hp / unit.maxHp) * 100)
  const isStructure = unit.moveSpeed === 0

  // Vertical lane: top% based on x position (high x = near enemy = near top)
  const topPct = (1 - unit.x / LANE_WIDTH) * 100

  // Unit just attacked if timer is in the upper half of its cooldown
  const isAttacking = unit.attack > 0 && unit.attackCooldownMs > 0 &&
    unit.attackTimer > unit.attackCooldownMs * 0.6

  // Spawn grow-in animation: scale from 0 → 1 as spawnGrowTimer counts down
  const growScale = unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0
    ? Math.max(0.05, 1 - unit.spawnGrowTimer / SPAWN_GROW_MS)
    : 1

  let style: React.CSSProperties
  if (unit.isWall) {
    // Walls span the full lane width, positioned by their x value
    style = { top: `${topPct}%`, left: 0, right: 0, transform: 'translateY(-50%)' }
  } else if (unit.isMoat) {
    // Moat spans full width like a wall — a horizontal water barrier
    style = { top: `${topPct}%`, left: 0, right: 0, transform: 'translateY(-50%)' }
  } else if (isStructure) {
    // Structures anchor to their base edge; horizontal position from unit.y (same scale as mobile units)
    const hPct = 50 + (unit.y / 80) * 36
    // Spread into multiple rows: every 6 buildings push one row deeper into the field
    const BUILDINGS_PER_ROW = 6
    const row = Math.floor(stackIndex / BUILDINGS_PER_ROW)
    const rowDepthPx = row * 44
    style = unit.owner === 'player'
      ? { bottom: `${5 + rowDepthPx}px`, left: `${hPct}%`, transform: 'translateX(-50%)' }
      : { top: `${5 + rowDepthPx}px`, left: `${hPct}%`, transform: 'translateX(-50%)' }
  } else {
    // Mobile units: lateral position derived from unit.y (-80..80 → 14..86%)
    const hPct = 50 + (unit.y / 80) * 36
    // Apply a stable per-unit percentage jitter so units never perfectly overlap,
    // scaled to the lane dimensions rather than fixed pixels
    const { dxPct, dyPct } = unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0
      ? { dxPct: 0, dyPct: 0 }
      : unitJitter(unit.id)
    style = {
      top: `${topPct + dyPct}%`,
      left: `${hPct + dxPct}%`,
      transform: `translateX(-50%) translateY(-50%) scale(${growScale})`,
    }
  }

  const isDying = unit.dyingTimer != null
  const isDamageFlash = unit.damageFlashTimer != null && unit.damageFlashTimer > 0
  const isKillFlash = unit.killFlashTimer != null && unit.killFlashTimer > 0
  const isCelebrating = celebrating && !isDying && !isStructure && !unit.isWall
  const isBurning  = !isDying && unit.burnTimer   != null && unit.burnTimer   > 0
  const isFrozen   = !isDying && unit.freezeTimer  != null && unit.freezeTimer  > 0
  const isPoisoned = !isDying && unit.poisonTimer  != null && unit.poisonTimer  > 0
  const isShocked  = !isDying && unit.stunTimer    != null && unit.stunTimer    > 0 && !isBurning && !isFrozen && !isPoisoned

  return (
    <div
      className={[
        'lane-unit u-absolute u-col u-items-c u-gap-1',
        `lane-unit--${unit.owner}`,
        isStructure ? 'lane-unit--structure' : '',
        unit.isWall ? 'lane-unit--wall' : '',
        unit.isMoat ? 'lane-unit--moat' : '',
        unit.flying ? 'lane-unit--flying' : '',
        isAttacking ? 'lane-unit--attacking' : '',
        isStructure && unit.upgradeLevel && unit.upgradeLevel >= 2 ? `lane-unit--upgraded-${Math.min(unit.upgradeLevel, MAX_UPGRADE_LEVEL)}` : '',
        unit.isHero ? 'lane-unit--hero' : '',
        isDying ? 'lane-unit--dying' : '',
        isDamageFlash ? 'lane-unit--damage-flash' : '',
        isKillFlash ? 'lane-unit--kill-flash' : '',
        unit.climbing ? 'lane-unit--climbing' : '',
        unit.size ? `lane-unit--size-${unit.size}` : '',
        isCelebrating ? 'lane-unit--celebrating' : '',
        unit.invisTimer != null && unit.invisTimer > 0 ? 'lane-unit--invisible' : '',
        unit.cardVariant ? `lane-unit--variant-${unit.cardVariant}` : '',
        isBurning  ? 'lane-unit--burning'  : '',
        isFrozen   ? 'lane-unit--frozen'   : '',
        isPoisoned ? 'lane-unit--poisoned' : '',
        isShocked  ? 'lane-unit--shocked'  : '',
      ].filter(Boolean).join(' ')}
      style={isCelebrating ? { ...style, animationDelay: `${(unit.id.charCodeAt(0) % 7) * 0.1}s` } : style}
      title={`${unit.name} — ${unit.hp}/${unit.maxHp} HP, ${unit.attack} ATK`}
      onClick={onInspect ? (e) => { e.stopPropagation(); onInspect(unit) } : undefined}
    >
      {/* Ground shadow cast by flying units */}
      {unit.flying && (
        <div style={{
          position: 'absolute',
          bottom: '-14px',
          left: '50%',
          width: '30px',
          height: '10px',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)',
          transform: 'translateX(-50%)',
          filter: 'blur(3px)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
      )}
      {/* Buffs above the sprite so they aren't clipped by lane overflow:hidden at the base edge */}
      {(unit.buffs && unit.buffs.length > 0 || unit.affinityActive) && (
        <div className="lane-unit-buffs u-row u-just-c">
          {unit.buffs?.map(tag => (
            <span key={tag} className={`lane-unit-buff lane-unit-buff--${tag}`}>
              {tag === 'atk' ? '⚔' : tag === 'spd' ? '▶' : tag === 'hp' ? '♥' : '◎'}
            </span>
          ))}
          {unit.affinityActive && (
            <span className="lane-unit-buff lane-unit-buff--affinity" title={unit.affinity?.label}>✦</span>
          )}
        </div>
      )}
      {unit.isMoat
        ? <MoatSvg owner={unit.owner} name={unit.name} />
        : unit.isWall
          ? <WallSvg hp={unit.hp} maxHp={unit.maxHp} owner={unit.owner} wallNames={(wallStack ?? [unit]).map(w => w.name)} />
          : isStructure
            ? <SpriteImg name={unit.spriteName ?? unit.name} className={`lane-unit-sprite${spriteDamageClass(unit.hp, unit.maxHp)}`} />
            : unit.isCommander
            ? <AnimatedSpriteImg name={spriteOverride ?? unit.spriteName ?? unit.name} frameCount={3} fps={6} className={`lane-unit-sprite${spriteDamageClass(unit.hp, unit.maxHp)}`} />
            : <AnimatedSpriteImg name={unit.spriteName ?? unit.name} frameCount={3} fps={6} className={`lane-unit-sprite${unit.isHero ? ' lane-unit-sprite--hero' : ''}${spriteDamageClass(unit.hp, unit.maxHp)}`} />
      }
      {!unit.isWall && !unit.isMoat && showName && (
        <div className="lane-unit-name">
          {unit.name}
        </div>
      )}
      {!isDying && !unit.isMoat && (
        <div className="lane-unit-hp-row u-flex u-items-c u-gap-1">
          <div className="lane-unit-hp-bar">
            <div className="lane-unit-hp-fill" style={{ width: `${hpPct}%` }} />
          </div>
          {unit.upgradeLevel != null && unit.upgradeLevel >= 1 && (
            <span className={`lane-unit-level lane-unit-level--${Math.min(unit.upgradeLevel, MAX_UPGRADE_LEVEL)}`}>
              {'★'.repeat(unit.upgradeLevel)}
            </span>
          )}
        </div>
      )}
      {isBurning  && <div className="status-overlay status-overlay--burning"  aria-hidden />}
      {isFrozen   && <div className="status-overlay status-overlay--frozen"   aria-hidden />}
      {isPoisoned && <div className="status-overlay status-overlay--poisoned" aria-hidden />}
      {isShocked  && <div className="status-overlay status-overlay--shocked"  aria-hidden />}
    </div>
  )
}, (prev, next) => {
  const pu = prev.unit, nu = next.unit
  return (
    pu.hp === nu.hp &&
    pu.x === nu.x && pu.y === nu.y &&
    pu.dyingTimer === nu.dyingTimer &&
    pu.damageFlashTimer === nu.damageFlashTimer &&
    pu.killFlashTimer === nu.killFlashTimer &&
    pu.spawnGrowTimer === nu.spawnGrowTimer &&
    pu.burnTimer === nu.burnTimer &&
    pu.freezeTimer === nu.freezeTimer &&
    pu.poisonTimer === nu.poisonTimer &&
    pu.stunTimer === nu.stunTimer &&
    pu.invisTimer === nu.invisTimer &&
    pu.attackTimer === nu.attackTimer &&
    pu.affinityActive === nu.affinityActive &&
    pu.climbing === nu.climbing &&
    pu.upgradeLevel === nu.upgradeLevel &&
    (pu.buffs?.length ?? 0) === (nu.buffs?.length ?? 0) &&
    prev.stackIndex === next.stackIndex &&
    prev.showName === next.showName &&
    prev.celebrating === next.celebrating &&
    prev.spriteOverride === next.spriteOverride &&
    (prev.onInspect !== undefined) === (next.onInspect !== undefined)
  )
})

// ─── Lane background ──────────────────────────────────────────────────────────
// Full-size SVG rendered as the ground layer: grass, dirt path, crop rows,
// sandy patches. Uses preserveAspectRatio="none" so it always fills the lane.

const BATTLEFIELD_SPRITE_PATH = '/sprites/battlefield/'

const BattlefieldBackground = React.memo(function BattlefieldBackground({ env }: { env?: string }) {
  const key = (env && env in battlefieldConfig.environments)
    ? env as keyof typeof battlefieldConfig.environments
    : 'forest'
  const layers = [...battlefieldConfig.environments[key], ...SEASON_LAYERS]
  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}>
      {layers.map(layer => (
        <img
          key={layer}
          className="lane-layer"
          src={`${BATTLEFIELD_SPRITE_PATH}${layer}.svg`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  )
})

// Alias for callers that still use the old name
const LaneBackground = BattlefieldBackground

// ─── Terrain obstacle rendering ───────────────────────────────────────────────
// Shapes are loaded as <img> from sprites/battlefield/terrain-*.svg.
// Dimension ratios (wr/hr) mirror the original per-variant aspect ratios.

type TerrainVariant = { file: string; wr: number; hr: number }
const TERRAIN_CONFIG = battlefieldConfig.terrain as Record<string, TerrainVariant[]>

// ─── Season detection ─────────────────────────────────────────────────────────

type Season = 'spring' | 'summer' | 'autumn' | 'winter'

// IANA timezone prefixes/names that are in the southern hemisphere
const SOUTHERN_TZ_PREFIXES = ['Australia/', 'Antarctica/']
const SOUTHERN_TZ_NAMES = new Set([
  'Pacific/Auckland', 'Pacific/Chatham', 'Pacific/Norfolk',
  'America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba',
  'America/Argentina/Salta', 'America/Argentina/Jujuy',
  'America/Argentina/Tucuman', 'America/Argentina/Catamarca',
  'America/Argentina/La_Rioja', 'America/Argentina/San_Juan',
  'America/Argentina/Mendoza', 'America/Argentina/San_Luis',
  'America/Argentina/Rio_Gallegos', 'America/Argentina/Ushuaia',
  'America/Sao_Paulo', 'America/Santiago', 'America/Montevideo',
  'America/Asuncion', 'America/Punta_Arenas', 'America/Lima',
  'America/Bogota', 'America/Guayaquil',
  'Africa/Johannesburg', 'Africa/Harare', 'Africa/Lusaka',
  'Africa/Maputo', 'Africa/Windhoek', 'Africa/Maseru', 'Africa/Mbabane',
  'Africa/Nairobi', 'Africa/Dar_es_Salaam', 'Africa/Luanda',
  'Indian/Mauritius', 'Indian/Reunion', 'Indian/Maldives',
])

function isSouthernHemisphere(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (SOUTHERN_TZ_PREFIXES.some(p => tz.startsWith(p))) return true
    if (SOUTHERN_TZ_NAMES.has(tz)) return true
  } catch { /* ignore */ }
  return false
}

function getCurrentSeason(): Season {
  const m = new Date().getMonth() // 0-based
  const northern: Season =
    m >= 2 && m <= 4 ? 'spring' :
    m >= 5 && m <= 7 ? 'summer' :
    m >= 8 && m <= 10 ? 'autumn' : 'winter'
  if (!isSouthernHemisphere()) return northern
  // Flip season for southern hemisphere
  const flip: Record<Season, Season> = { spring: 'autumn', autumn: 'spring', summer: 'winter', winter: 'summer' }
  return flip[northern]
}

const CURRENT_SEASON = getCurrentSeason()
const SEASON_LAYERS = (battlefieldConfig.seasonLayers as Record<string, string[]>)[CURRENT_SEASON] ?? []
const SEASON_TERRAIN = (battlefieldConfig.seasonTerrain as Record<string, Record<string, string[]>>)[CURRENT_SEASON] ?? {}

// ─── Forest border ────────────────────────────────────────────────────────────
// Purely decorative tree line along the left edge, right edge, and top of the
// battlefield. Uses deterministic (sin-based) offsets so the layout is stable
// across re-renders without needing game state.

// ── Themed border blob SVGs ──────────────────────────────────────────────────

// act1 / default — green tree canopy
function BlobSvg({ size, shade }: { size: number; shade: number }) {
  const base = Math.round(30 + shade * 20)
  const fill = `rgb(${18 + Math.round(shade * 8)},${base + 60},${18 + Math.round(shade * 8)})`
  const hi   = `rgb(${30 + Math.round(shade * 10)},${base + 90},${30 + Math.round(shade * 10)})`
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="10" cy="11" rx="10" ry="9"  fill={fill}/>
      <ellipse cx="10" cy="8"  rx="8"  ry="7"  fill={hi}/>
      <ellipse cx="8"  cy="6"  rx="4"  ry="3"  fill={hi} opacity="0.5"/>
    </svg>
  )
}

// act2 — rocky cliff / fortress stone
function RockBorderBlob({ size, shade }: { size: number; shade: number }) {
  const g    = Math.round(80 + shade * 30)
  const fill = `rgb(${g - 10},${g},${g + 5})`
  const hi   = `rgb(${g + 20},${g + 22},${g + 28})`
  return (
    <svg width={size} height={Math.round(size * 0.85)} viewBox="0 0 22 19" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="11" cy="18" rx="10" ry="3" fill="#1a1a1a" opacity="0.35"/>
      <polygon points="1,17 5,7 11,2 17,7 21,17" fill={fill}/>
      <polygon points="5,17 9,6 12,1 15,7 18,17" fill={hi} opacity="0.65"/>
      <line x1="11" y1="2" x2="10" y2="8" stroke="white" strokeWidth="0.5" opacity="0.3"/>
    </svg>
  )
}

// act3 — dead trees / ashen mounds
function AshBorderBlob({ size, shade }: { size: number; shade: number }) {
  const g    = Math.round(28 + shade * 18)
  const dark = `rgb(${g + 8},${g},${g - 4})`
  return (
    <svg width={size} height={size} viewBox="0 0 20 22" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="4" height="10" fill="#2a2010" rx="1"/>
      <line x1="10" y1="14" x2="3"  y2="8"  stroke={dark} strokeWidth="1.6"/>
      <line x1="10" y1="13" x2="17" y2="7"  stroke={dark} strokeWidth="1.6"/>
      <line x1="3"  y1="8"  x2="1"  y2="4"  stroke={dark} strokeWidth="1"/>
      <line x1="3"  y1="8"  x2="6"  y2="4"  stroke={dark} strokeWidth="1"/>
      <line x1="17" y1="7"  x2="19" y2="3"  stroke={dark} strokeWidth="1"/>
      <ellipse cx="10" cy="21" rx="7" ry="2.5" fill="#4a3a28" opacity="0.7"/>
    </svg>
  )
}

// act4 — crystal / ice shards
function CrystalBorderBlob({ size, shade }: { size: number; shade: number }) {
  const b    = Math.round(150 + shade * 50)
  const fill = `rgb(15,${Math.round(b * 0.6)},${b})`
  const hi   = `rgb(60,${Math.round(b * 0.78)},${b})`
  return (
    <svg width={size} height={size} viewBox="0 0 20 24" xmlns="http://www.w3.org/2000/svg">
      <polygon points="5,22  3,12  6,3   8,12  7,22"  fill={fill} opacity="0.88"/>
      <polygon points="10,22 8,9  12,1  15,9  13,22"  fill={hi}   opacity="0.95"/>
      <polygon points="14,22 13,14 16,7  18,14 17,22"  fill={fill} opacity="0.82"/>
      <line x1="12" y1="2" x2="11" y2="8" stroke="white" strokeWidth="0.7" opacity="0.55"/>
    </svg>
  )
}

type BorderTheme = 'act1' | 'act2' | 'act3' | 'act4' | undefined

function BorderBlob({ size, shade, theme }: { size: number; shade: number; theme: BorderTheme }) {
  if (theme === 'act2') return <RockBorderBlob   size={size} shade={shade} />
  if (theme === 'act3') return <AshBorderBlob    size={size} shade={shade} />
  if (theme === 'act4') return <CrystalBorderBlob size={size} shade={shade} />
  return <BlobSvg size={size} shade={shade} />
}

const ForestBorder = React.memo(function ForestBorder({ theme }: { theme?: string }) {
  const blobs: { key: string; top: number; left: number; size: number; shade: number }[] = []

  // Left (y≈-95) and right (y≈+95) — tight wall just outside the playable field
  for (const side of [-95, 95] as const) {
    for (let ex = 5; ex <= 500; ex += 16) {
      const yOff  = Math.sin(ex * 0.19 + side) * 2      // ±2 units jitter
      const topPct  = (1 - ex / LANE_WIDTH) * 100
      const leftPct = 50 + ((side + yOff) / 80) * 36
      const size    = 20 + Math.round(Math.abs(Math.sin(ex * 0.37 + side)) * 8)
      const shade   = (Math.sin(ex * 0.53 + side * 0.1) + 1) / 2
      blobs.push({ key: `fe-${side}-${ex}`, top: topPct, left: leftPct, size, shade })
    }
  }

  // Top edge (opponent side)
  for (let ey = -95; ey <= 95; ey += 16) {
    const xOff  = Math.sin(ey * 0.23) * 3
    const topPct  = (1 - (495 + xOff) / LANE_WIDTH) * 100
    const leftPct = 50 + (ey / 80) * 36
    const size    = 20 + Math.round(Math.abs(Math.sin(ey * 0.41)) * 8)
    const shade   = (Math.sin(ey * 0.57) + 1) / 2
    blobs.push({ key: `fe-top-${ey}`, top: topPct, left: leftPct, size, shade })
  }

  return (
    <div className="forest-border" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      {blobs.map(b => (
        <div
          key={b.key}
          style={{
            position: 'absolute',
            top: `${b.top}%`,
            left: `${b.left}%`,
            transform: 'translateX(-50%) translateY(-50%)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <BorderBlob size={b.size} shade={b.shade} theme={theme as BorderTheme} />
        </div>
      ))}
    </div>
  )
})

// Bridge shown over large water obstacles — runs top-to-bottom (unit travel direction)
function BridgeSvg({ size }: { size: number }) {
  const bw = Math.round(size * 0.42)   // narrow bridge deck
  return (
    <svg
      width={bw} height={size}
      viewBox="0 0 12 30"
      style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Bridge deck */}
      <rect x="2" y="0" width="8" height="30" fill="#8a6a3a"/>
      {/* Horizontal planks (perpendicular to travel) */}
      {[3, 8, 13, 18, 23, 28].map(y => (
        <line key={y} x1="2" y1={y} x2="10" y2={y} stroke="#6a4a22" strokeWidth="1.2"/>
      ))}
      {/* Left and right railings */}
      <line x1="1"  y1="0" x2="1"  y2="30" stroke="#c8a060" strokeWidth="1.5"/>
      <line x1="11" y1="0" x2="11" y2="30" stroke="#c8a060" strokeWidth="1.5"/>
      {/* Cross-support posts */}
      {[0, 8, 16, 24].map(y => (
        <line key={y} x1="0" y1={y} x2="12" y2={y} stroke="#c8a060" strokeWidth="1"/>
      ))}
    </svg>
  )
}

function TerrainTile({ obs }: { obs: TerrainObstacle }) {
  const topPct  = (1 - obs.x / LANE_WIDTH) * 100
  const leftPct = 50 + (obs.y / 80) * 36
  // Visual size tracks the physical radius so the obstacle looks as large as it blocks
  const size    = Math.round(obs.radius * 2.8)   // radius 20–32 → 56–90 px
  const hasBridge = obs.type === 'water' && obs.radius > 26

  // Deterministic variant from obstacle id (0, 1, 2)
  const variant = parseInt(obs.id.replace('t', ''), 10) % 3

  const baseVariants = TERRAIN_CONFIG[obs.type] ?? []
  const variantCfg = baseVariants[variant % Math.max(1, baseVariants.length)]
  // Apply seasonal terrain file override if one exists for this type and variant index
  const seasonFiles = SEASON_TERRAIN[obs.type]
  const seasonFile = seasonFiles?.[variant % Math.max(1, baseVariants.length)]
  const terrainFile = seasonFile ?? variantCfg?.file
  const shape = variantCfg && terrainFile
    ? <img
        className="lane-layer"
        src={`${BATTLEFIELD_SPRITE_PATH}${terrainFile}`}
        width={Math.round(size * variantCfg.wr)}
        height={Math.round(size * variantCfg.hr)}
        alt=""
        draggable={false}
      />
    : null

  return (
    <div
      className={`terrain-obstacle u-absolute u-no-select u-flex u-items-c u-just-c terrain-obstacle--${obs.type}`}
      style={{
        top:       `${topPct}%`,
        left:      `${leftPct}%`,
        transform: 'translateX(-50%) translateY(-50%)',
        overflow:  'visible',
        position:  'absolute',
        zIndex:    2,
      }}
      title={obs.type}
    >
      {shape}
      {hasBridge && <BridgeSvg size={size} />}
    </div>
  )
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

export function Battlefield({ state, onPlayCard, onPlayAoeCard, onGiveUp, onPause, actTheme, activeRelic, showBossSplash, activeModifiers, isCampaign, stance = 'auto', onSetStance, speedMultiplier = 1, onCycleSpeed }: Props) {
  const { openDetail, cardDetailNode } = useCardDetail()
  const [heroLightning, setHeroLightning] = useState<{ owner: 'player' | 'opponent'; key: number } | null>(null)
  const [paused, setPaused] = useState(false)
  const [importantMsgQueue, setImportantMsgQueue] = useState<string[]>([])
  const lastLogLenRef = useRef(0)
  const [inspectedUnit, setInspectedUnit] = useState<Unit | null>(null)
  const [showDeckViewer, setShowDeckViewer] = useState(false)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  const [showBattleTutorial, setShowBattleTutorial] = useState(
    () => !isCampaign && !hasSeen(BATTLE_TUTORIAL_ID)
  )
  const [pendingAoeCard, setPendingAoeCard] = useState<Card | null>(null)
  const [aoeHoverPos, setAoeHoverPos] = useState<{ top: number; left: number } | null>(null)
  const laneRef = useRef<HTMLDivElement>(null)
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPendingAoeCard(null); setAoeHoverPos(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingAoeCard])

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

  return (
    <div
      className={`battlefield u-col u-grow${actTheme ? ` battlefield--${actTheme}` : ''}${paused ? ' battlefield--paused' : ''}`}
      onClick={paused && !inspectedUnit ? () => doPause(false) : undefined}
    >

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

      {/* The Lane — vertical, fills remaining space */}
      {(() => {
        return (
      <div
        className={`lane${pendingAoeCard ? ' lane--aoe-targeting' : ''}`}
        ref={laneRef}
        onClick={pendingAoeCard ? (e) => {
          const rect = laneRef.current!.getBoundingClientRect()
          const cx = (1 - (e.clientY - rect.top) / rect.height) * LANE_WIDTH
          const cy = ((e.clientX - rect.left) / rect.width - 0.5) * 80 / 0.36
          onPlayAoeCard!(pendingAoeCard.id, cx, cy)
          setPendingAoeCard(null)
          setAoeHoverPos(null)
        } : undefined}
        onMouseMove={pendingAoeCard ? (e) => {
          const rect = laneRef.current!.getBoundingClientRect()
          setAoeHoverPos({
            top: (e.clientY - rect.top) / rect.height * 100,
            left: (e.clientX - rect.left) / rect.width * 100,
          })
        } : undefined}
        onMouseLeave={pendingAoeCard ? () => setAoeHoverPos(null) : undefined}
        onContextMenu={pendingAoeCard ? (e) => { e.preventDefault(); setPendingAoeCard(null); setAoeHoverPos(null) } : undefined}
      >
        <div className="lane-ground" />
        <BattlefieldTerrainCanvas environment={state.environment} id={state.environment} />
        <ForestBorder theme={actTheme} />
        {(state.terrain ?? []).map(obs => <TerrainTile key={obs.id} obs={obs} />)}
        {isDebugMode() && (state.terrain ?? []).map(obs => {
          // Avoidance ellipse matching TERRAIN_AVOID_SHAPE used by the engine.
          // x-axis (forward/vertical on screen): 500 units → 100% field height → 0.2% per unit
          // y-axis (lateral/horizontal on screen): 160 units → 72% field width → 0.45% per unit
          const shape    = TERRAIN_AVOID_SHAPE[obs.type]
          const ax       = obs.radius * shape.fx + 4  // forward half-extent (game units)
          const ay       = obs.radius * shape.fy + 4  // lateral half-extent (game units)
          const topPct   = (1 - obs.x / LANE_WIDTH) * 100
          const leftPct  = 50 + (obs.y / 80) * 36
          const wPct     = ay * 2 * (36 / 80)    // diameter in % of field width
          const hPct     = ax * 2 * (100 / 500)  // diameter in % of field height
          return (
            <div
              key={`dbg-${obs.id}`}
              style={{
                position: 'absolute',
                top: `${topPct}%`,
                left: `${leftPct}%`,
                width: `${wPct}%`,
                height: `${hPct}%`,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: 'rgba(255, 0, 0, 0.25)',
                border: '1px solid rgba(255, 80, 80, 0.7)',
                pointerEvents: 'none',
                zIndex: 50,
                boxSizing: 'border-box',
              }}
              title={`Avoidance ellipse: ax=${ax.toFixed(1)} ay=${ay.toFixed(1)} (${obs.type} r=${obs.radius})`}
            />
          )
        })}
        {/* Persistent blood pools left by fallen units */}
        {(state.bloodPools ?? []).map(pool => {
          const topPct  = (1 - pool.x / LANE_WIDTH) * 100
          const leftPct = 50 + (pool.y / 80) * 36
          const fading  = pool.fadingAt !== undefined
          return (
            <div
              key={pool.id}
              className={fading ? 'blood-pool blood-pool--fading' : 'blood-pool'}
              style={{ top: `${topPct}%`, left: `${leftPct}%` }}
            />
          )
        })}
        {/* Ground hazards — poison gas clouds */}
        {(state.hazards ?? []).map(h => {
          const topPct  = (1 - h.x / LANE_WIDTH) * 100
          const leftPct = 50 + (h.y / 80) * 36
          return (
            <div
              key={h.id}
              className="battlefield-hazard"
              style={{ top: `${topPct}%`, left: `${leftPct}%` }}
            />
          )
        })}
        {(() => {
          // Group walls by owner+x so stacked wall types can share a composite graphic
          const wallGroups = new Map<string, Unit[]>()
          for (const u of state.field) {
            if (!u.isWall) continue
            const key = `${u.owner}:${Math.round(u.x)}`
            if (!wallGroups.has(key)) wallGroups.set(key, [])
            wallGroups.get(key)!.push(u)
          }
          const renderedWallIds = new Set<string>()

          const playerWon = (state.phase.type === 'gameOver' || state.phase.type === 'celebration') && state.phase.winner === 'player'
          return state.field.map((u, i) => {
            const commanderSprite = u.isCommander
              ? (u.owner === 'player' ? playerAvatar : opponentCommanderSlug)
              : undefined
            if (u.isWall) {
              const key = `${u.owner}:${Math.round(u.x)}`
              const group = wallGroups.get(key)!
              if (group[0].id !== u.id) return null  // only render the first in each group
              renderedWallIds.add(u.id)
              return <LaneUnit key={u.id} unit={u} wallStack={group} onInspect={paused ? u => { setInspectedUnit(u) } : undefined} showName={paused} celebrating={playerWon && u.owner === 'player'} spriteOverride={commanderSprite} />
            }
            const stackIndex = u.moveSpeed === 0
              ? state.field.slice(0, i).filter(o => o.moveSpeed === 0 && !o.isWall && !o.isMoat && o.owner === u.owner).length
              : 0
            return <LaneUnit key={u.id} unit={u} stackIndex={stackIndex} onInspect={paused ? u => { setInspectedUnit(u) } : undefined} showName={paused} celebrating={playerWon && u.owner === 'player'} spriteOverride={commanderSprite} />
          })
        })()}
        {/* Animation events: projectiles, hit sparks, AOE rings, gas clouds */}
        {(state.animEvents ?? []).map(ev => {
          // Convert game coords to CSS %
          // x (forward 0-500) → top% = (1 - x/500)*100
          // y (lateral -80..80) → left% = 50 + (y/80)*36
          const fromJitter = ev.fromUnitId ? unitJitter(ev.fromUnitId) : { dxPct: 0, dyPct: 0 }
          const fromTop  = (1 - ev.fromX / LANE_WIDTH) * 100 + fromJitter.dyPct
          const fromLeft = 50 + (ev.fromY / 80) * 36 + fromJitter.dxPct
          const toTop    = (1 - ev.toX / LANE_WIDTH) * 100
          const toLeft   = 50 + (ev.toY / 80) * 36
          const pType = ev.projectileType ?? 'magic'

          if (ev.kind === 'gascloud') {
            return (
              <div
                key={ev.id}
                className="battlefield-gascloud"
                style={{ position: 'absolute', top: `${toTop}%`, left: `${toLeft}%`, pointerEvents: 'none', zIndex: 12 }}
              />
            )
          }
          if (ev.kind === 'aoe') {
            return (
              <div
                key={ev.id}
                className="anim-aoe-ring"
                style={{ position: 'absolute', top: `${toTop}%`, left: `${toLeft}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 60 }}
              />
            )
          }
          if (ev.kind === 'projectile') {
            const dx = toLeft - fromLeft
            const dy = toTop  - fromTop
            const len = Math.hypot(dx, dy)
            const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
            return (
              <div
                key={ev.id}
                className={`anim-projectile anim-projectile--${pType}`}
                style={{
                  position: 'absolute',
                  top: `${fromTop}%`,
                  left: `${fromLeft}%`,
                  width: `${len}%`,
                  transform: `translate(-0%, -50%) rotate(${angleDeg}deg)`,
                  transformOrigin: '0 50%',
                  pointerEvents: 'none',
                  zIndex: 60,
                }}
              />
            )
          }
          // Hit spark
          return (
            <div
              key={ev.id}
              className={`anim-hit anim-hit--${pType}`}
              style={{
                position: 'absolute',
                top: `${fromTop}%`,
                left: `${fromLeft}%`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 60,
              }}
            />
          )
        })}

        {/* AoE targeting overlay */}
        {pendingAoeCard && (
          <>
            <div className="aoe-targeting-banner">
              <span>⚡ {pendingAoeCard.name} — tap to place</span>
              <button className="aoe-targeting-cancel" onClick={e => { e.stopPropagation(); setPendingAoeCard(null); setAoeHoverPos(null) }}>✕</button>
            </div>
            {aoeHoverPos && (
              <div
                className="aoe-targeting-reticle"
                style={{ top: `${aoeHoverPos.top}%`, left: `${aoeHoverPos.left}%` }}
                aria-hidden
              />
            )}
          </>
        )}
      </div>
        )
      })()}

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
  )
}
