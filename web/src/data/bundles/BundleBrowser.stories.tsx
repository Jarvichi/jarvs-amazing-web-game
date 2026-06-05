import React, { useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { getAllBundles, getBundleById, type BundleDef } from './bundleLoader'
import { usePixiApp } from '../../hooks/usePixiApp'
import { loadTileTexture } from '../../utils/pixiHelpers'
import { TILESET_IMAGE, TILESET_COLUMNS } from '../tiles/tileIndex'

const T     = 32
const PAD   = 1  // padding tiles around the bundle grid

// ── Canvas that renders one bundle ────────────────────────────────────────────

function BundleCanvas({ bundle, scale }: { bundle: BundleDef; scale: number }) {
  const containerRef = useRef<HTMLDivElement>(null)

  const tilesWithPos = bundle.tiles.filter(t => t.type !== 'door' || true)
  const maxX  = tilesWithPos.length > 0 ? Math.max(...tilesWithPos.map(t => t.x)) : 0
  const maxY  = tilesWithPos.length > 0 ? Math.max(...tilesWithPos.map(t => t.y)) : 0
  const cols  = maxX + 1 + PAD * 2
  const rows  = maxY + 1 + PAD * 2

  usePixiApp(containerRef, cols * T * scale, rows * T * scale, (app) => {
    app.stage.scale.set(scale)

    // Checkerboard background
    const bg = new PIXI.Graphics()
    for (let cx = 0; cx < cols; cx++)
      for (let cy = 0; cy < rows; cy++)
        bg.rect(cx * T, cy * T, T, T).fill({ color: (cx + cy) % 2 === 0 ? 0x1e1e2e : 0x16161f })
    app.stage.addChild(bg)

    // Origin marker — the (0,0) bundle tile maps to (PAD, PAD + maxY) in canvas space
    const originG = new PIXI.Graphics()
    originG.rect(PAD * T, (PAD + maxY) * T, T, T).fill({ color: 0x004400 })
    app.stage.addChild(originG)

    const base        = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
    const baseChipUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`

    for (const tile of bundle.tiles) {
      // canvas y: flip bundle-y so y=0 appears at the bottom of the grid
      const canvasX = (PAD + tile.x) * T
      const canvasY = (PAD + maxY - tile.y) * T

      if (tile.type === 'door') {
        const g = new PIXI.Graphics()
        g.rect(canvasX, canvasY, T, T).fill({ color: 0x663300 })
        const label = new PIXI.Text({ text: 'D', style: { fontSize: 10, fill: 0xffcc88, fontFamily: 'monospace' } })
        label.position.set(canvasX + 4, canvasY + 4)
        app.stage.addChild(g, label)
        continue
      }

      if (!tile.tileId) continue

      loadTileTexture(baseChipUrl, tile.tileId, TILESET_COLUMNS.baseChip).then(tex => {
        if (!app.renderer) return
        const s = new PIXI.Sprite(tex)
        s.position.set(canvasX, canvasY)
        s.width = T; s.height = T
        if (tile.zlayer === 'above') s.alpha = 0.65
        app.stage.addChild(s)
      }).catch(() => {})
    }

    // Grid lines
    const grid = new PIXI.Graphics()
    grid.setStrokeStyle({ width: 0.5, color: 0x333355, alpha: 0.6 })
    for (let cx = 0; cx <= cols; cx++) grid.moveTo(cx * T, 0).lineTo(cx * T, rows * T)
    for (let cy = 0; cy <= rows; cy++) grid.moveTo(0, cy * T).lineTo(cols * T, cy * T)
    grid.stroke()
    app.stage.addChild(grid)
  })

  return <div ref={containerRef} />
}

// ── Placeholder component (required by Storybook meta) ────────────────────────

function BundleBrowserPlaceholder() { return null }

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  component: BundleBrowserPlaceholder,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BundleBrowserPlaceholder>

export default meta
type Story = StoryObj<typeof meta>

// ── Browser story ─────────────────────────────────────────────────────────────

export const Browser: Story = {
  render: () => {
    const allBundles = getAllBundles()
    const [selectedId, setSelectedId] = useState(allBundles[0]?.bundleID ?? '')
    const [scale, setScale]           = useState(4)
    const bundle = getBundleById(selectedId)

    const tileStyle: React.CSSProperties = {
      fontFamily: 'monospace', fontSize: 11,
      background: '#111122', border: '1px solid #334',
      padding: '2px 6px', borderRadius: 2,
    }

    return (
      <div style={{ background: '#0a0a18', minHeight: '100vh', color: '#aabbcc', fontFamily: 'monospace', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13, color: '#88ccff' }}>Bundle Browser</strong>

          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{ background: '#111', color: '#88ccff', border: '1px solid #336', padding: '4px 10px', fontFamily: 'monospace', fontSize: 12 }}
          >
            {allBundles.map(b => (
              <option key={b.bundleID} value={b.bundleID}>{b.bundleID}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            Scale
            <input
              type="range" min={2} max={6} step={1} value={scale}
              onChange={e => setScale(Number(e.target.value))}
              style={{ width: 80 }}
            />
            {scale}×
          </label>

          {bundle && (
            <span style={{ color: '#446688', fontSize: 11 }}>
              {bundle.tiles.length} tiles
            </span>
          )}
        </div>

        {bundle ? (
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Canvas — key forces remount so PixiJS reinitialises */}
            <div style={{ background: '#111122', border: '1px solid #334', display: 'inline-block' }}>
              <BundleCanvas key={`${selectedId}-${scale}`} bundle={bundle} scale={scale} />
            </div>

            {/* Tile table */}
            <div>
              <div style={{ marginBottom: 8, fontSize: 12, color: '#668888' }}>
                Origin (0,0) = <span style={{ color: '#44ff88' }}>■</span> green = bottom-left tile
                &nbsp;·&nbsp;
                <span style={{ opacity: 0.6 }}>above-layer tiles at 65% opacity</span>
              </div>
              <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ color: '#6688aa', borderBottom: '1px solid #334' }}>
                    {['type', 'x', 'y', 'tileId', 'zlayer'].map(h => (
                      <th key={h} style={{ padding: '2px 12px 4px 0', textAlign: 'left', fontWeight: 'normal' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bundle.tiles.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1a1a2e', lineHeight: '1.8' }}>
                      <td style={{ ...tileStyle, color: t.type === 'door' ? '#ffcc88' : t.type === 'window' ? '#88aaff' : '#aaccaa' }}>{t.type}</td>
                      <td style={{ padding: '0 12px 0 8px' }}>{t.x}</td>
                      <td style={{ padding: '0 12px 0 0' }}>{t.y}</td>
                      <td style={{ padding: '0 12px 0 0', color: '#556677' }}>{t.tileId || '—'}</td>
                      <td style={{ padding: '0 0 0 0', color: t.zlayer === 'above' ? '#ffaaff' : t.zlayer === 'below' ? '#aaffaa' : '#556677' }}>
                        {t.zlayer ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 16, fontSize: 11, color: '#446', lineHeight: 1.7 }}>
                <div>Usage in JSON:</div>
                <pre style={{ background: '#0d0d1a', border: '1px solid #334', padding: '8px 12px', margin: '6px 0 0', color: '#88ccaa', borderRadius: 3 }}>
{`{ "tx": X, "ty": Y, "bundleID": "${selectedId}" }`}
                </pre>
                <div style={{ color: '#446688', marginTop: 4 }}>where (X, Y) is the bottom-left tile position</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#664444', padding: 20 }}>No bundles registered.</div>
        )}
      </div>
    )
  },
}
