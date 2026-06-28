import React, { useMemo, useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Section } from '../ui/Section'
import { BattlefieldTerrainCanvas } from '../battle/battlefield/BattlefieldTerrainCanvas'
import { generateTerrain } from '../../game/engine/terrain'
import { TERRAIN_AVOID_SHAPE, LANE_WIDTH } from '../../game/types'
import { ENV_TILES, TILE_SIZE } from '../../data/tiles/tileIndex'
import { TILE_RADIUS_SCALE } from '../../utils/terrainLayer'

interface Props {
  onBack: () => void
}

const ENVIRONMENTS = Object.keys(ENV_TILES)

// Derived from real .lane CSS (--bf-top-buffer/--bf-bottom-buffer) across representative
// viewport heights — covers the device range where the size-scaling bug actually shows up.
const HEIGHT_PRESETS = [
  { label: 'Mobile (~370px)',        value: 370 },
  { label: 'Tablet / Laptop (~520px)', value: 520 },
  { label: 'Large Desktop (~840px)', value: 840 },
]

const LANE_PREVIEW_WIDTH = 360

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function SceneryAdminScreen({ onBack }: Props) {
  const [environment, setEnvironment] = useState(ENVIRONMENTS[0])
  const [seed, setSeed] = useState(randomSeed)
  const [heightPx, setHeightPx] = useState(HEIGHT_PRESETS[1].value)
  const [showAvoidance, setShowAvoidance] = useState(false)

  const terrain = useMemo(() => generateTerrain(seed, environment), [seed, environment])

  return (
    <OverlayScreen title="SCENERY SORTIE" subtitle="Dev-only battlefield terrain preview" onBack={onBack} className="settings-screen u-col u-grow">
      <Section bordered title="CONTROLS">
        <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
          <div className="settings-label">Environment</div>
          <select className="settings-select" value={environment} onChange={e => setEnvironment(e.target.value)}>
            {ENVIRONMENTS.map(env => (
              <option key={env} value={env}>{env}</option>
            ))}
          </select>
        </div>

        <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
          <div className="settings-label">Seed</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="text"
              className="settings-number-input"
              style={{ width: '120px' }}
              value={seed}
              onChange={e => setSeed(e.target.value)}
            />
            <button className="action-btn" onClick={() => setSeed(randomSeed())}>REROLL</button>
          </div>
        </div>

        <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
          <div className="settings-label">Lane height preset</div>
          <select
            className="settings-select"
            value={heightPx}
            onChange={e => setHeightPx(parseInt(e.target.value, 10))}
          >
            {HEIGHT_PRESETS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
          <div className="settings-label">Show avoidance ellipses</div>
          <button
            className={`action-btn${showAvoidance ? ' action-btn--gold' : ''}`}
            onClick={() => setShowAvoidance(v => !v)}
          >
            {showAvoidance ? 'ON' : 'OFF'}
          </button>
        </div>
      </Section>

      <Section bordered title="PREVIEW">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <div
            className="lane"
            style={{
              position: 'relative', top: 'auto', bottom: 'auto', left: 'auto', right: 'auto',
              width: LANE_PREVIEW_WIDTH, height: heightPx, flexShrink: 0,
            }}
          >
            <div className="lane-ground" />
            <BattlefieldTerrainCanvas environment={environment} id={seed} terrain={terrain} />
            {showAvoidance && terrain.map(obs => {
              // Avoidance ellipse matching TERRAIN_AVOID_SHAPE used by the engine (Battlefield.tsx).
              const shape   = TERRAIN_AVOID_SHAPE[obs.type]
              const ax      = obs.radius * shape.fx + 4
              const ay      = obs.radius * shape.fy + 4
              const topPct  = (1 - obs.x / LANE_WIDTH) * 100
              const leftPct = 50 + (obs.y / 80) * 36
              const wPct    = ay * 2 * (36 / 80)
              const hPct    = ax * 2 * (100 / 500)
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
          </div>
        </div>
      </Section>

      <Section bordered title={`OBSTACLES (${terrain.length})`}>
        {terrain.length === 0 ? (
          <div className="settings-sublabel">No obstacles generated for this seed.</div>
        ) : (
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', opacity: 0.6 }}>
                <th style={{ padding: '4px 6px' }}>id</th>
                <th style={{ padding: '4px 6px' }}>type</th>
                <th style={{ padding: '4px 6px' }}>x</th>
                <th style={{ padding: '4px 6px' }}>y</th>
                <th style={{ padding: '4px 6px' }}>radius</th>
                <th style={{ padding: '4px 6px' }}>tileRadius</th>
              </tr>
            </thead>
            <tbody>
              {terrain.map(obs => {
                const tileRadius = Math.max(1, Math.round(obs.radius * heightPx / (TILE_RADIUS_SCALE * TILE_SIZE)))
                return (
                  <tr key={obs.id} style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <td style={{ padding: '4px 6px' }}>{obs.id}</td>
                    <td style={{ padding: '4px 6px' }}>{obs.type}</td>
                    <td style={{ padding: '4px 6px' }}>{obs.x.toFixed(1)}</td>
                    <td style={{ padding: '4px 6px' }}>{obs.y.toFixed(1)}</td>
                    <td style={{ padding: '4px 6px' }}>{obs.radius.toFixed(1)}</td>
                    <td style={{ padding: '4px 6px' }}>{tileRadius}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>
    </OverlayScreen>
  )
}
