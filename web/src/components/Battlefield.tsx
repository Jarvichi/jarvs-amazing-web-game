import React, { useRef, useEffect, useState } from 'react'
import { GameState, Unit, LANE_WIDTH, Card, TerrainObstacle, TerrainType, BuffTag, TERRAIN_AVOID_SHAPE } from '../game/types'
import { CardTile } from './CardTile'
import { CardDetailModal } from './CardDetailModal'
import { SpriteImg, AnimatedSpriteImg } from './SpriteImg'
import { BattleEventOverlay } from './BattleEventOverlay'
import { isNoDamageMode, isDebugMode } from '../game/debug'
import { MAX_UPGRADE_LEVEL } from '../game/engine'
import { getRelicDef } from '../game/relics'

interface Props {
  state: GameState
  onPlayCard: (cardId: string) => void
  onGiveUp?: () => void
  onPause?: (paused: boolean) => void
  actTheme?: string       // e.g. 'act1' — applied as CSS modifier class
  activeRelic?: string | null  // relic name currently equipped, if any
  showBossSplash?: boolean
  activeModifiers?: { label: string }[]  // replay modifiers active this run
}

const SPAWN_GROW_MS = 1500

// ─── Wall graphic ─────────────────────────────────────────────────────────────
// Rendered in-place of the sprite for wall units.  Full-width SVG showing
// staggered stone blocks, battlements, and progressive damage cracks.

function WallSvg({ hp, maxHp, owner, wallNames = [] }: { hp: number; maxHp: number; owner: 'player' | 'opponent'; wallNames?: string[] }) {
  const dmgPct = 1 - hp / maxHp
  // Player = cool grey-blue stone; opponent = warm tan stone
  const [stone, hiStone, merlon] = owner === 'player'
    ? ['#606878', '#70788a', '#707888'] as const
    : ['#7a5838', '#8a6848', '#906a40'] as const
  const op = 1 - dmgPct * 0.4   // fade slightly with damage

  const hasThorn = wallNames.includes('Thornwall')
  const hasBone  = wallNames.includes('Bone Wall')

  return (
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
  )
}

function LaneUnit({ unit, stackIndex = 0, wallStack, onInspect, showName }: { unit: Unit; stackIndex?: number; wallStack?: Unit[]; onInspect?: (u: Unit) => void; showName?: boolean }) {
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
    style = {
      top: `${topPct}%`,
      left: `${hPct}%`,
      transform: `translateX(-50%) translateY(-50%) scale(${growScale})`,
    }
  }

  return (
    <div
      className={[
        'lane-unit',
        `lane-unit--${unit.owner}`,
        isStructure ? 'lane-unit--structure' : '',
        unit.isWall ? 'lane-unit--wall' : '',
        unit.flying ? 'lane-unit--flying' : '',
        isAttacking ? 'lane-unit--attacking' : '',
        isStructure && unit.upgradeLevel && unit.upgradeLevel >= 2 ? `lane-unit--upgraded-${Math.min(unit.upgradeLevel, MAX_UPGRADE_LEVEL)}` : '',
        unit.isHero ? 'lane-unit--hero' : '',
      ].filter(Boolean).join(' ')}
      style={style}
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
      {unit.isWall
        ? <WallSvg hp={unit.hp} maxHp={unit.maxHp} owner={unit.owner} wallNames={(wallStack ?? [unit]).map(w => w.name)} />
        : isStructure
          ? <SpriteImg name={unit.spriteName ?? unit.name} className="lane-unit-sprite" />
          : <AnimatedSpriteImg name={unit.spriteName ?? unit.name} frameCount={3} fps={6} className={`lane-unit-sprite${unit.isHero ? ' lane-unit-sprite--hero' : ''}`} />
      }
      {!unit.isWall && showName && (
        <div className="lane-unit-name">
          {unit.name}
        </div>
      )}
      {(unit.buffs && unit.buffs.length > 0 || unit.affinityActive) && (
        <div className="lane-unit-buffs">
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
      <div className="lane-unit-hp-row">
        <div className="lane-unit-hp-bar">
          <div className="lane-unit-hp-fill" style={{ width: `${hpPct}%` }} />
        </div>
        {unit.upgradeLevel != null && unit.upgradeLevel >= 1 && (
          <span className={`lane-unit-level lane-unit-level--${Math.min(unit.upgradeLevel, MAX_UPGRADE_LEVEL)}`}>
            {'★'.repeat(unit.upgradeLevel)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Lane background ──────────────────────────────────────────────────────────
// Full-size SVG rendered as the ground layer: grass, dirt path, crop rows,
// sandy patches. Uses preserveAspectRatio="none" so it always fills the lane.

function LaneBgForest() {
  const cropRows = Array.from({ length: 30 }, (_, i) => i)
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      viewBox="0 0 100 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="220" fill="#2a5418"/>
      <rect x="0" y="0" width="24" height="220" fill="#1e4810"/>
      {cropRows.map(i => (
        <rect key={i} x="0" y={i * 7.5} width="24" height="3.5" fill="#2a5a14" opacity="0.75"/>
      ))}
      <line x1="24" y1="0" x2="24" y2="220" stroke="#3a6820" strokeWidth="0.6" opacity="0.5"/>
      <rect x="74" y="30" width="26" height="120" fill="#7a6030" opacity="0.32"/>
      <rect x="78" y="45" width="18" height="90"  fill="#8a6c38" opacity="0.22"/>
      <path d="M36,0 C34,45 38,90 35,132 C32,170 37,195 35,220 L64,220 C62,195 67,170 64,132 C61,90 65,45 63,0 Z" fill="#6a4820" opacity="0.72"/>
      <path d="M38,0 C36,44 40,88 37,130 C34,168 39,194 37,220 L62,220 C60,194 65,168 62,130 C59,88 63,44 61,0 Z" fill="#8a6030"/>
      <path d="M44,0 C43,38 45,80 43,122 C41,158 44,188 43,220 L49,220 C48,188 51,158 49,122 C47,80 49,38 48,0 Z" fill="#a07848" opacity="0.45"/>
      <path d="M52,0 C51,38 53,80 51,122 C49,158 52,188 51,220 L57,220 C56,188 59,158 57,122 C55,80 57,38 56,0 Z" fill="#a07848" opacity="0.45"/>
      <ellipse cx="29" cy="52"  rx="7" ry="4.5" fill="#3a6820" opacity="0.5"/>
      <ellipse cx="68" cy="78"  rx="6" ry="4"   fill="#3a6820" opacity="0.45"/>
      <ellipse cx="27" cy="128" rx="8" ry="5"   fill="#3a6820" opacity="0.5"/>
      <ellipse cx="70" cy="155" rx="7" ry="4.5" fill="#3a6820" opacity="0.45"/>
      <circle cx="36" cy="42"  r="1.5" fill="#887860" opacity="0.55"/>
      <circle cx="63" cy="86"  r="1.5" fill="#887860" opacity="0.55"/>
      <circle cx="35" cy="134" r="1.5" fill="#887860" opacity="0.55"/>
      <ellipse cx="82" cy="52"  rx="6" ry="4"   fill="#6a4820" opacity="0.38"/>
      <ellipse cx="80" cy="112" rx="5" ry="3.5" fill="#6a4820" opacity="0.32"/>
    </svg>
  )
}

function LaneBgRuins() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      viewBox="0 0 100 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      {/* Muted mossy ground */}
      <rect width="100" height="220" fill="#3a4030"/>
      {/* Stone rubble fields — left */}
      <rect x="0" y="0" width="22" height="220" fill="#2e3428"/>
      <rect x="2" y="18"  width="18" height="6"  fill="#50503a" opacity="0.7"/>
      <rect x="0" y="52"  width="14" height="5"  fill="#44443a" opacity="0.6"/>
      <rect x="4" y="88"  width="16" height="7"  fill="#50503a" opacity="0.65"/>
      <rect x="1" y="130" width="20" height="5"  fill="#44443a" opacity="0.6"/>
      <rect x="3" y="168" width="15" height="6"  fill="#50503a" opacity="0.7"/>
      <rect x="0" y="200" width="18" height="5"  fill="#44443a" opacity="0.6"/>
      {/* Stone rubble — right */}
      <rect x="76" y="0" width="24" height="220" fill="#2e3428"/>
      <rect x="80" y="30"  width="16" height="6" fill="#50503a" opacity="0.7"/>
      <rect x="78" y="74"  width="18" height="5" fill="#44443a" opacity="0.6"/>
      <rect x="82" y="112" width="14" height="7" fill="#50503a" opacity="0.65"/>
      <rect x="79" y="155" width="17" height="5" fill="#44443a" opacity="0.6"/>
      <rect x="81" y="190" width="15" height="6" fill="#50503a" opacity="0.7"/>
      {/* Worn stone centre path */}
      <path d="M34,0 C33,50 36,100 34,140 C32,178 35,200 34,220 L66,220 C65,200 68,178 66,140 C64,100 67,50 66,0 Z" fill="#4a4438" opacity="0.8"/>
      <path d="M36,0 C35,48 38,98 36,138 C34,176 37,199 36,220 L64,220 C63,199 66,176 64,138 C62,98 65,48 64,0 Z" fill="#5a5248"/>
      {/* Flagstone cracks */}
      <line x1="42" y1="30"  x2="58" y2="38"  stroke="#3a3830" strokeWidth="0.8" opacity="0.5"/>
      <line x1="44" y1="75"  x2="56" y2="80"  stroke="#3a3830" strokeWidth="0.8" opacity="0.5"/>
      <line x1="40" y1="120" x2="60" y2="128" stroke="#3a3830" strokeWidth="0.8" opacity="0.5"/>
      <line x1="43" y1="165" x2="57" y2="170" stroke="#3a3830" strokeWidth="0.8" opacity="0.5"/>
      {/* Scattered loose stones */}
      <circle cx="28" cy="44"  r="2" fill="#606058" opacity="0.6"/>
      <circle cx="72" cy="90"  r="2" fill="#606058" opacity="0.6"/>
      <circle cx="26" cy="140" r="2" fill="#606058" opacity="0.6"/>
      <circle cx="74" cy="185" r="2" fill="#606058" opacity="0.6"/>
      {/* Moss patches on stones */}
      <ellipse cx="10" cy="70"  rx="5" ry="3" fill="#3a5028" opacity="0.5"/>
      <ellipse cx="88" cy="130" rx="4" ry="2.5" fill="#3a5028" opacity="0.45"/>
      <ellipse cx="12" cy="180" rx="6" ry="3" fill="#3a5028" opacity="0.5"/>
    </svg>
  )
}

function LaneBgCamp() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      viewBox="0 0 100 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      {/* Churned dirt base */}
      <rect width="100" height="220" fill="#5a3c1e"/>
      {/* Darker mud strips — footfall lanes */}
      <rect x="0"  y="0" width="20" height="220" fill="#3e2810" opacity="0.7"/>
      <rect x="80" y="0" width="20" height="220" fill="#3e2810" opacity="0.7"/>
      {/* Trodden central track */}
      <path d="M32,0 C30,55 34,110 31,155 C29,188 33,205 32,220 L68,220 C67,205 71,188 69,155 C66,110 70,55 68,0 Z" fill="#4a3018" opacity="0.75"/>
      <path d="M36,0 C34,54 38,108 35,153 C33,186 37,204 36,220 L64,220 C63,204 67,186 65,153 C62,108 66,54 64,0 Z" fill="#6a4828"/>
      {/* Wagon ruts */}
      <path d="M41,0 C40,42 42,85 40,128 C38,164 41,192 40,220 L45,220 C44,192 47,164 45,128 C43,85 45,42 44,0 Z" fill="#7a5838" opacity="0.5"/>
      <path d="M56,0 C55,42 57,85 55,128 C53,164 56,192 55,220 L60,220 C59,192 62,164 60,128 C58,85 60,42 59,0 Z" fill="#7a5838" opacity="0.5"/>
      {/* Scattered gravel */}
      <circle cx="24" cy="35"  r="1.5" fill="#8a7060" opacity="0.6"/>
      <circle cx="76" cy="68"  r="1.5" fill="#8a7060" opacity="0.55"/>
      <circle cx="22" cy="105" r="1.5" fill="#8a7060" opacity="0.6"/>
      <circle cx="78" cy="145" r="1.5" fill="#8a7060" opacity="0.55"/>
      <circle cx="25" cy="185" r="1.5" fill="#8a7060" opacity="0.6"/>
      {/* Dry hay/straw patches */}
      <ellipse cx="10" cy="50"  rx="7" ry="3.5" fill="#7a6830" opacity="0.45"/>
      <ellipse cx="88" cy="100" rx="6" ry="3"   fill="#7a6830" opacity="0.4"/>
      <ellipse cx="12" cy="160" rx="8" ry="3.5" fill="#7a6830" opacity="0.45"/>
      <ellipse cx="86" cy="200" rx="5" ry="2.5" fill="#7a6830" opacity="0.4"/>
      {/* Muddy puddles */}
      <ellipse cx="29" cy="82"  rx="4" ry="2" fill="#2e2010" opacity="0.55"/>
      <ellipse cx="71" cy="128" rx="3.5" ry="1.8" fill="#2e2010" opacity="0.5"/>
    </svg>
  )
}

function LaneBgCitadel() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      viewBox="0 0 100 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stone base */}
      <rect width="100" height="220" fill="#5a5a60"/>
      {/* Cobblestone grid — left margin */}
      <rect x="0" y="0" width="22" height="220" fill="#4a4a50"/>
      {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(r => [0,1].map(c => (
        <rect key={`cl-${r}-${c}`} x={c*11 + 1} y={r*16 + 2} width="9" height="12" fill="#545460" opacity="0.7" rx="0.5"/>
      )))}
      {/* Cobblestone grid — right margin */}
      <rect x="78" y="0" width="22" height="220" fill="#4a4a50"/>
      {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(r => [0,1].map(c => (
        <rect key={`cr-${r}-${c}`} x={78 + c*11 + 1} y={r*16 + 2} width="9" height="12" fill="#545460" opacity="0.7" rx="0.5"/>
      )))}
      {/* Worn flagstone centre lane */}
      <path d="M33,0 C32,55 35,110 33,155 C31,185 34,205 33,220 L67,220 C66,205 69,185 67,155 C65,110 68,55 67,0 Z" fill="#686870" opacity="0.8"/>
      <path d="M35,0 C34,53 37,108 35,153 C33,183 36,204 35,220 L65,220 C64,204 67,183 65,153 C63,108 66,53 65,0 Z" fill="#787880"/>
      {/* Flagstone joints */}
      <line x1="35" y1="44"  x2="65" y2="44"  stroke="#5a5a62" strokeWidth="0.7" opacity="0.6"/>
      <line x1="35" y1="88"  x2="65" y2="88"  stroke="#5a5a62" strokeWidth="0.7" opacity="0.6"/>
      <line x1="35" y1="132" x2="65" y2="132" stroke="#5a5a62" strokeWidth="0.7" opacity="0.6"/>
      <line x1="35" y1="176" x2="65" y2="176" stroke="#5a5a62" strokeWidth="0.7" opacity="0.6"/>
      <line x1="50" y1="0"   x2="50" y2="220" stroke="#5a5a62" strokeWidth="0.5" opacity="0.4"/>
      {/* Iron grate drains */}
      <rect x="46" cy="66"  width="8" height="5" fill="#3a3a40" opacity="0.5" rx="0.5"/>
      <rect x="46" cy="154" width="8" height="5" fill="#3a3a40" opacity="0.5" rx="0.5"/>
      {/* Battle-worn scratches */}
      <line x1="38" y1="60"  x2="46" y2="70"  stroke="#888898" strokeWidth="0.5" opacity="0.4"/>
      <line x1="55" y1="110" x2="62" y2="120" stroke="#888898" strokeWidth="0.5" opacity="0.4"/>
      <line x1="40" y1="155" x2="50" y2="162" stroke="#888898" strokeWidth="0.5" opacity="0.4"/>
      {/* Bloodstains / dark patches */}
      <ellipse cx="42" cy="95"  rx="3" ry="2" fill="#3a2820" opacity="0.4"/>
      <ellipse cx="60" cy="140" rx="2.5" ry="1.5" fill="#3a2820" opacity="0.35"/>
    </svg>
  )
}

function LaneBgAshen() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      viewBox="0 0 100 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      {/* Scorched earth base */}
      <rect width="100" height="220" fill="#1e1c18"/>
      {/* Ash fields — left */}
      <rect x="0" y="0" width="24" height="220" fill="#161410"/>
      <ellipse cx="10" cy="40"  rx="8" ry="5"   fill="#2e2c28" opacity="0.7"/>
      <ellipse cx="12" cy="100" rx="10" ry="6"  fill="#2e2c28" opacity="0.65"/>
      <ellipse cx="8"  cy="165" rx="7" ry="4.5" fill="#2e2c28" opacity="0.7"/>
      {/* Ash fields — right */}
      <rect x="76" y="0" width="24" height="220" fill="#161410"/>
      <ellipse cx="88" cy="60"  rx="8" ry="5"   fill="#2e2c28" opacity="0.65"/>
      <ellipse cx="90" cy="130" rx="9" ry="5.5" fill="#2e2c28" opacity="0.7"/>
      <ellipse cx="86" cy="190" rx="7" ry="4"   fill="#2e2c28" opacity="0.65"/>
      {/* Scorched centre path */}
      <path d="M34,0 C33,50 36,105 34,148 C32,182 35,202 34,220 L66,220 C65,202 68,182 66,148 C64,105 67,50 66,0 Z" fill="#141210" opacity="0.9"/>
      <path d="M36,0 C35,48 38,103 36,146 C34,180 37,201 36,220 L64,220 C63,201 66,180 64,146 C62,103 65,48 64,0 Z" fill="#222018"/>
      {/* Cracked earth fissures */}
      <line x1="38" y1="35"  x2="50" y2="48"  stroke="#080808" strokeWidth="1" opacity="0.7"/>
      <line x1="50" y1="48"  x2="62" y2="58"  stroke="#080808" strokeWidth="0.8" opacity="0.6"/>
      <line x1="42" y1="95"  x2="58" y2="108" stroke="#080808" strokeWidth="1" opacity="0.7"/>
      <line x1="40" y1="148" x2="55" y2="160" stroke="#080808" strokeWidth="0.9" opacity="0.65"/>
      <line x1="55" y1="160" x2="60" y2="172" stroke="#080808" strokeWidth="0.7" opacity="0.6"/>
      {/* Glowing embers */}
      <circle cx="28" cy="55"  r="1.2" fill="#c04010" opacity="0.6"/>
      <circle cx="72" cy="95"  r="1"   fill="#c04010" opacity="0.55"/>
      <circle cx="26" cy="140" r="1.2" fill="#c04010" opacity="0.6"/>
      <circle cx="74" cy="180" r="1"   fill="#c04010" opacity="0.5"/>
      <circle cx="30" cy="200" r="0.8" fill="#d05020" opacity="0.55"/>
      {/* Pale ash dust streaks */}
      <ellipse cx="18" cy="78"  rx="6" ry="2.5" fill="#504e48" opacity="0.4"/>
      <ellipse cx="82" cy="148" rx="5" ry="2"   fill="#504e48" opacity="0.35"/>
      <ellipse cx="20" cy="205" rx="7" ry="2.5" fill="#504e48" opacity="0.4"/>
    </svg>
  )
}

function LaneBackground({ env }: { env?: string }) {
  if (env === 'ruins')   return <LaneBgRuins />
  if (env === 'camp')    return <LaneBgCamp />
  if (env === 'citadel') return <LaneBgCitadel />
  if (env === 'ashen')   return <LaneBgAshen />
  return <LaneBgForest />
}

// ─── Terrain SVG shapes ───────────────────────────────────────────────────────

function RockSvg({ size }: { size: number }) {
  // Dramatic mountain peaks — back range + front double-peak silhouette
  return (
    <svg width={size} height={Math.round(size * 1.25)} viewBox="0 0 38 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M2,46 C5,44 9,36 16,8 C23,36 27,44 30,46 Z" fill="#525258" opacity="0.65"/>
      <path d="M4,46 C7,42 11,32 17,6 L21,22 L26,4 C30,28 34,42 37,46 Z" fill="#78787e"/>
      <path d="M17,6 C16,10 15,18 14,28" fill="none" stroke="#aaaab0" strokeWidth="1" opacity="0.6"/>
      <path d="M17,6 L19,14 L21,22 L23,14 L26,4 L24,8 L21,16 L18,8 Z" fill="#d0d0d8" opacity="0.3"/>
    </svg>
  )
}

// Deciduous (organic blob cluster)
function TreeSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M4,22 C0,18 1,11 6,9 C5,5 10,2 15,5 C18,2 24,4 24,9 C28,10 30,16 27,20 C28,24 23,27 18,25 C15,28 8,27 4,22 Z"
        fill="#1e4812" opacity="0.5"/>
      <path d="M5,20 C1,16 2,9 7,8 C6,4 11,1 16,4 C19,1 25,3 25,8 C29,9 30,15 27,19 C28,23 23,26 18,24 C15,27 7,26 5,20 Z"
        fill="#2e6018"/>
      <path d="M8,18 C5,14 6,9 10,8 C10,5 14,3 17,6 C20,4 24,7 23,11 C26,13 25,18 22,20 C21,23 17,24 14,21 C12,23 7,22 8,18 Z"
        fill="#3d7a22"/>
      <ellipse cx="15" cy="13" rx="5" ry="4" fill="#52a030" opacity="0.4"/>
    </svg>
  )
}

// Pine / conifer — tall narrow layered triangle
function PineTreeSvg({ size }: { size: number }) {
  return (
    <svg width={Math.round(size * 0.65)} height={size} viewBox="0 0 18 32" xmlns="http://www.w3.org/2000/svg">
      <polygon points="9,2 17,13 1,13"  fill="#1a4a1a"/>
      <polygon points="9,7 18,19 0,19"  fill="#1e5820"/>
      <polygon points="9,12 18,25 0,25" fill="#245c24"/>
      <polygon points="9,17 17,28 1,28" fill="#2a6628"/>
      <rect x="7" y="28" width="4" height="4" fill="#5a3010"/>
    </svg>
  )
}

// Fruit tree — round canopy with red apple dots
function FruitTreeSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="15" cy="17" rx="13" ry="10" fill="#1e4810" opacity="0.45"/>
      <ellipse cx="15" cy="15" rx="13" ry="11" fill="#2e5c18"/>
      <ellipse cx="15" cy="11" rx="10" ry="8"  fill="#3a7020"/>
      <circle cx="9"  cy="15" r="2.2" fill="#cc2020"/>
      <circle cx="18" cy="12" r="2"   fill="#dd3030"/>
      <circle cx="21" cy="17" r="2.2" fill="#cc2020"/>
      <circle cx="12" cy="19" r="2"   fill="#cc2828"/>
      <circle cx="9"  cy="15" r="0.8" fill="#ff7070" opacity="0.5"/>
      <circle cx="21" cy="17" r="0.8" fill="#ff7070" opacity="0.5"/>
      <line x1="15" y1="23" x2="14" y2="29" stroke="#5a3010" strokeWidth="2.5"/>
    </svg>
  )
}

function WaterSvg({ size }: { size: number }) {
  const w = Math.round(size * 1.7)
  return (
    <svg width={w} height={size} viewBox="0 0 52 22" xmlns="http://www.w3.org/2000/svg">
      <path d="M2,13 C0,8 3,3 9,4 C10,1 16,0 19,4 C23,2 27,6 25,11 C28,13 27,19 23,20 C20,22 14,22 11,18 C7,21 1,19 2,13 Z"
        fill="#1a3a7a"/>
      <path d="M24,12 C22,7 25,3 30,4 C32,1 38,1 40,5 C44,4 48,8 47,13 C48,17 44,21 40,20 C37,22 30,22 27,18 C24,20 23,16 24,12 Z"
        fill="#1e4490"/>
      <ellipse cx="14" cy="10" rx="5" ry="2"   fill="#5090e0" opacity="0.45"/>
      <ellipse cx="37" cy="11" rx="4" ry="1.8" fill="#5090e0" opacity="0.4"/>
    </svg>
  )
}

// Crumbled stone ruin
function RuinSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 26" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="14" cy="25" rx="12" ry="1.8" fill="#1a1a0a" opacity="0.3"/>
      <rect x="2"  y="12" width="6"  height="12" fill="#5a4a3a" stroke="#c8a060" strokeWidth="1.2"/>
      <rect x="10" y="6"  width="8"  height="18" fill="#4a3a2a" stroke="#c8a060" strokeWidth="1.2"/>
      <rect x="20" y="14" width="6"  height="10" fill="#6a5a4a" stroke="#c8a060" strokeWidth="1.2"/>
      <line x1="2"  y1="12" x2="7"  y2="4"  stroke="#c8a060" strokeWidth="1.4"/>
      <line x1="20" y1="14" x2="25" y2="8"  stroke="#c8a060" strokeWidth="1.4"/>
      <line x1="8"  y1="18" x2="10" y2="18" stroke="#c8a060" strokeWidth="1"/>
    </svg>
  )
}

// Farmhouse with barn-red roof
function FarmhouseSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="29" rx="14" ry="2" fill="#1a1a0a" opacity="0.3"/>
      <rect x="3" y="15" width="26" height="13" fill="#a08060" stroke="#c8a060" strokeWidth="1"/>
      <polygon points="1,15 16,4 31,15" fill="#8a3020" stroke="#aa4030" strokeWidth="1"/>
      <rect x="13" y="21" width="6" height="7" fill="#5a3a18" stroke="#7a5a30" strokeWidth="0.8"/>
      <circle cx="18.5" cy="24.5" r="0.8" fill="#c8a060"/>
      <rect x="4"  y="17" width="6" height="5" fill="#5888a0" stroke="#789898" strokeWidth="0.5"/>
      <rect x="22" y="17" width="6" height="5" fill="#5888a0" stroke="#789898" strokeWidth="0.5"/>
      <line x1="7"  y1="17" x2="7"  y2="22" stroke="#789898" strokeWidth="0.5"/>
      <line x1="4"  y1="19.5" x2="10" y2="19.5" stroke="#789898" strokeWidth="0.5"/>
      <line x1="25" y1="17" x2="25" y2="22" stroke="#789898" strokeWidth="0.5"/>
      <line x1="22" y1="19.5" x2="28" y2="19.5" stroke="#789898" strokeWidth="0.5"/>
    </svg>
  )
}

// Stone watchtower with battlements
function WatchtowerSvg({ size }: { size: number }) {
  return (
    <svg width={Math.round(size * 0.55)} height={size} viewBox="0 0 16 30" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="8" cy="29" rx="7" ry="1.5" fill="#1a1a0a" opacity="0.35"/>
      <rect x="2" y="10" width="12" height="18" fill="#6a5a4a" stroke="#9a8a70" strokeWidth="0.8"/>
      <line x1="2" y1="15" x2="14" y2="15" stroke="#5a4a3a" strokeWidth="0.5"/>
      <line x1="2" y1="20" x2="14" y2="20" stroke="#5a4a3a" strokeWidth="0.5"/>
      <line x1="2" y1="25" x2="14" y2="25" stroke="#5a4a3a" strokeWidth="0.5"/>
      <rect x="0"  y="6"  width="4" height="5" fill="#7a6a5a" stroke="#9a8a70" strokeWidth="0.8"/>
      <rect x="6"  y="6"  width="4" height="5" fill="#7a6a5a" stroke="#9a8a70" strokeWidth="0.8"/>
      <rect x="12" y="6"  width="4" height="5" fill="#7a6a5a" stroke="#9a8a70" strokeWidth="0.8"/>
      <rect x="7"  y="15" width="2" height="6" fill="#1a1a1a"/>
      <path d="M1,28 C1,26 3,25 8,25 C13,25 15,26 15,28 L14,29 L2,29 Z" fill="#5a4a3a"/>
    </svg>
  )
}

const TERRAIN_SHAPES: Record<TerrainType, (size: number) => React.ReactNode> = {
  rock:  s => <RockSvg  size={s} />,
  tree:  s => <TreeSvg  size={s} />,
  water: s => <WaterSvg size={s} />,
  ruin:  s => <RuinSvg  size={s} />,
}

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

function ForestBorder({ theme }: { theme?: string }) {
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
    <>
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
            zIndex: 1,
          }}
        >
          <BorderBlob size={b.size} shade={b.shade} theme={theme as BorderTheme} />
        </div>
      ))}
    </>
  )
}

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

  let shape: React.ReactNode
  if (obs.type === 'tree') {
    shape = variant === 0 ? <PineTreeSvg  size={size} />
          : variant === 1 ? <FruitTreeSvg size={size} />
          :                 <TreeSvg      size={size} />
  } else if (obs.type === 'ruin') {
    shape = variant === 0 ? <RuinSvg       size={size} />
          : variant === 1 ? <FarmhouseSvg  size={size} />
          :                 <WatchtowerSvg size={size} />
  } else {
    shape = TERRAIN_SHAPES[obs.type](size)
  }

  return (
    <div
      className={`terrain-obstacle terrain-obstacle--${obs.type}`}
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
    <div className="mana-bar">
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

const BASE_SPRITE_PATH = '/jarvs-amazing-web-game/sprites/'

function opponentPortraitSlug(bossAI: string | undefined, actTheme: string | undefined): string {
  if (bossAI && OPPONENT_PORTRAIT[bossAI]) return OPPONENT_PORTRAIT[bossAI]
  if (actTheme && OPPONENT_PORTRAIT[actTheme]) return OPPONENT_PORTRAIT[actTheme]
  return 'bandit'
}

export function Battlefield({ state, onPlayCard, onGiveUp, onPause, actTheme, activeRelic, showBossSplash, activeModifiers }: Props) {
  const [detailCard, setDetailCard] = useState<Card | null>(null)
  const [heroLightning, setHeroLightning] = useState<{ owner: 'player' | 'opponent'; key: number } | null>(null)
  const [paused, setPaused] = useState(false)
  const [inspectedUnit, setInspectedUnit] = useState<Unit | null>(null)

  const doPause = (p: boolean) => { setPaused(p); onPause?.(p); if (!p) setInspectedUnit(null) }
  const prevHeroIdsRef = useRef<Set<string>>(new Set())

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

  const gameTimeSec = Math.floor(state.gameTime / 1000)
  const minutes = Math.floor(gameTimeSec / 60)
  const seconds = gameTimeSec % 60
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`
  const sdSec = Math.ceil(state.suddenDeathTimer / 1000)
  const event = state.activeBattleEvent

  return (
    <div
      className={`battlefield${actTheme ? ` battlefield--${actTheme}` : ''}${paused ? ' battlefield--paused' : ''}`}
      onClick={paused && !inspectedUnit ? () => doPause(false) : undefined}
    >

      {/* Dramatic battle event overlay (center-screen flash) */}
      <BattleEventOverlay event={event} />

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
        <button className="bf-pause-btn" onClick={() => doPause(true)} title="Pause">⏸</button>
        <span className="game-clock">{timeStr}</span>
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

      {/* Replay modifier strip */}
      {activeModifiers && activeModifiers.length > 0 && (
        <div className="replay-modifier-strip">
          {activeModifiers.map((m, i) => (
            <span key={i} className="replay-modifier-tag">⚠ {m.label}</span>
          ))}
        </div>
      )}

      {/* Opponent base */}
      <div className="base-bar base-bar--opponent">
        <img
          className="base-bar-portrait base-bar-portrait--opponent"
          src={`${BASE_SPRITE_PATH}${opponentPortraitSlug(state.bossAI, actTheme)}.svg`}
          alt="opponent"
        />
        <HpBar current={state.opponentBase.hp} max={state.opponentBase.maxHp} color="#ff4444" />
        <span className="base-bar-info">
          {STRATEGY_LABELS[state.opponentStrategy] && (
            <span className="strategy-label">{STRATEGY_LABELS[state.opponentStrategy]}</span>
          )}
          Hand: {state.opponentHand.length}
        </span>
      </div>

      {/* The Lane — vertical, fills remaining space */}
      <div className="lane">
        <div className="lane-ground" />
        <LaneBackground env={state.environment} />
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

          return state.field.map((u, i) => {
            if (u.isWall) {
              const key = `${u.owner}:${Math.round(u.x)}`
              const group = wallGroups.get(key)!
              if (group[0].id !== u.id) return null  // only render the first in each group
              renderedWallIds.add(u.id)
              return <LaneUnit key={u.id} unit={u} wallStack={group} onInspect={paused ? u => { setInspectedUnit(u) } : undefined} showName={paused} />
            }
            const stackIndex = u.moveSpeed === 0
              ? state.field.slice(0, i).filter(o => o.moveSpeed === 0 && !o.isWall && o.owner === u.owner).length
              : 0
            return <LaneUnit key={u.id} unit={u} stackIndex={stackIndex} onInspect={paused ? u => { setInspectedUnit(u) } : undefined} showName={paused} />
          })
        })()}
      </div>

      {/* Player base */}
      <div className="base-bar base-bar--player">
        <img
          className="base-bar-portrait base-bar-portrait--player"
          src={`${BASE_SPRITE_PATH}jarv.svg`}
          alt="Jarv"
        />
        <HpBar current={state.playerBase.hp} max={state.playerBase.maxHp} color="#33ff33" />
        <span className="base-bar-info">
          MANA {state.mana}/{state.maxMana}
          <ManaBar mana={state.mana} maxMana={state.maxMana} manaAccum={state.manaAccum} />
        </span>
      </div>

      {/* Hand */}
      <div className="hand-panel">
        <div className="hand-header">
          <span className="hand-label">
            HAND ({state.playerHand.length}) | Deck: {state.playerDeck.length}
          </span>
        </div>
        <div className="hand-cards">
          {state.playerHand.length === 0
            ? <span className="field-empty">No cards</span>
            : state.playerHand.map(card => {
              const heroLockedSecs = card.isHero
                ? Math.ceil(Math.max(0, 30000 - state.gameTime) / 1000)
                : 0
              const isMaxUpgrade = card.cardType === 'structure' && card.unit != null &&
                state.field.some(u => u.owner === 'player' && u.name === card.unit!.name && (u.upgradeLevel ?? 1) >= MAX_UPGRADE_LEVEL)
              return (
              <div key={card.id} className="hand-card-wrap" title={isMaxUpgrade ? 'Already at max level' : undefined}>
                <CardTile
                  card={card}
                  canAfford={!isMaxUpgrade && state.mana >= card.cost}
                  onClick={() => onPlayCard(card.id)}
                  lockedSecs={heroLockedSecs}
                />
                <button
                  className="hand-card-info-btn"
                  onClick={e => { e.stopPropagation(); setDetailCard(card) }}
                >ⓘ</button>
              </div>
            )})}
        </div>
      </div>

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          collection={[]}
          onClose={() => setDetailCard(null)}
        />
      )}

      {showBossSplash && (
        <div className="boss-splash-overlay">
          <div className="boss-splash-content">
            <div className="boss-splash-warning">⚡ WARNING ⚡</div>
            <div className="boss-splash-title">BOSS FIGHT</div>
            <div className="boss-splash-unit">{state.bossName ?? state.bossCard}</div>
            <div className="boss-splash-sub">has entered the battlefield</div>
          </div>
        </div>
      )}

      {/* Pause panel — anchored, no backdrop so the field remains tappable */}
      {paused && (
        <div className="bf-pause-panel" onClick={e => e.stopPropagation()}>
            <div className="bf-pause-title">⏸ PAUSED</div>
            {inspectedUnit ? (
              <div className="bf-inspect-panel">
                <div className="bf-inspect-name">
                  {inspectedUnit.name}
                  {inspectedUnit.upgradeLevel != null && inspectedUnit.upgradeLevel >= 2 && (
                    <span className={`lane-unit-level lane-unit-level--${Math.min(inspectedUnit.upgradeLevel, MAX_UPGRADE_LEVEL)}`}>
                      {' '}{'★'.repeat(inspectedUnit.upgradeLevel)}
                    </span>
                  )}
                </div>
                <div className="bf-inspect-stats">
                  <div className="bf-inspect-row"><span>HP</span><span>{inspectedUnit.hp}/{inspectedUnit.maxHp}</span></div>
                  {inspectedUnit.attack > 0 && (
                    <div className="bf-inspect-row"><span>ATK</span><span>{inspectedUnit.attack}</span></div>
                  )}
                  {inspectedUnit.upgradeLevel != null && inspectedUnit.upgradeLevel >= 2 && (
                    <div className="bf-inspect-row"><span>Lvl</span><span>{inspectedUnit.upgradeLevel}</span></div>
                  )}
                </div>

                {/* Traits */}
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
                    <div className="cdm-traits" style={{ marginTop: 4 }}>
                      {traits.map(t => <span key={t} className="cdm-trait">{t}</span>)}
                    </div>
                  ) : null
                })()}

                {/* Strengths, Weaknesses & Affinity */}
                {(inspectedUnit.strengths?.length || inspectedUnit.weaknesses?.length || inspectedUnit.affinity) ? (
                  <div className="cdm-sw-block">
                    {inspectedUnit.strengths && inspectedUnit.strengths.length > 0 && (
                      <div className="cdm-sw-row">
                        <span className="cdm-sw-label cdm-sw-label--strong">⚔ Strong vs</span>
                        <span className="cdm-sw-tags">{inspectedUnit.strengths.join(', ')}</span>
                      </div>
                    )}
                    {inspectedUnit.weaknesses && inspectedUnit.weaknesses.length > 0 && (
                      <div className="cdm-sw-row">
                        <span className="cdm-sw-label cdm-sw-label--weak">⚠ Weak to</span>
                        <span className="cdm-sw-tags">{inspectedUnit.weaknesses.join(', ')}</span>
                      </div>
                    )}
                    {inspectedUnit.affinity && (
                      <div className="cdm-sw-row">
                        <span className="cdm-sw-label cdm-sw-label--affinity">✦ Affinity</span>
                        <span className="cdm-sw-tags">{inspectedUnit.affinity.label}{inspectedUnit.affinityActive ? ' (active)' : ''}</span>
                      </div>
                    )}
                  </div>
                ) : null}

                <button className="action-btn" style={{ marginTop: 4 }} onClick={() => setInspectedUnit(null)}>← Back</button>
              </div>
            ) : (
              <>
                <div className="bf-pause-hint">Tap a unit or building on the field to inspect it</div>
                <div className="bf-pause-actions">
                  <button className="action-btn action-btn--large" onClick={() => doPause(false)}>▶ Resume</button>
                  {onGiveUp && (
                    <button className="action-btn action-btn--danger" onClick={onGiveUp}>✕ Give Up</button>
                  )}
                </div>
              </>
            )}
          </div>
      )}
    </div>
  )
}
