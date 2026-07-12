import React, { useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import type { Meta, StoryObj } from '@storybook/react-vite'
import rawBundles from './bundles.json'
import { saveBundles } from './bundleEditorApi'
import { usePixiApp } from '../../hooks/usePixiApp'
import { loadTileRef } from '../../utils/pixiHelpers'
import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'
import { resolveTileRef } from '../tiles/tileIndex'
import { isSelfSave } from '../../utils/hotReloadGuard'

// Same full-reload issue as bundleLoader.ts — this story also statically
// imports bundles.json, a separate import chain from the one accepted there.
if (import.meta.hot) {
  import.meta.hot.accept('./bundles.json', () => {
    if (!isSelfSave()) {
      console.warn('[bundle editor] bundles.json changed on disk outside this tab. Refresh to pick it up — unsaved changes here were left alone.')
    }
  })
}

const T   = 32
const PAD = 1

// ── Raw (on-disk) bundle shapes — what bundles.json actually stores ────────────

type TileType = 'decor' | 'window' | 'door'
type Zlayer   = 'solid' | 'below' | 'above'

interface RawBundleTile {
  type?:       TileType
  tileID?:     string
  x:           number
  y:           number
  zlayer?:     Zlayer
  glow?:       boolean
  glowRadius?: number
  pulse?:      boolean
  buildingId?: string
  hideSign?:   boolean
}

interface RawBundle {
  bundleID: string
  tiles:    RawBundleTile[]
}

function resolveTileId(key?: string): number {
  if (!key) return 0
  return (BASE_CHIP_TILES as Record<string, number>)[key] ?? 0
}

// ── Tile thumbnail + picker ────────────────────────────────────────────────────

const S = 22

function TileThumb({ tileId }: { tileId: string }) {
  const id = (BASE_CHIP_TILES as Record<string, number>)[tileId]
  if (id === undefined) return <div style={{ width: S, height: S, background: '#311' }} />
  if (id >= 10000) {
    let ref: ReturnType<typeof resolveTileRef> | undefined
    try { ref = resolveTileRef(id) } catch { /* unknown */ }
    if (!ref) return <div style={{ width: S, height: S, background: '#311' }} />
    const col = ref.id % ref.columns
    const row = Math.floor(ref.id / ref.columns)
    return (
      <div style={{
        width: S, height: S, flexShrink: 0, imageRendering: 'pixelated',
        backgroundImage: `url("${ref.file}")`, backgroundRepeat: 'no-repeat',
        backgroundSize: ref.columns === 1 ? `${S}px ${S}px` : `${ref.columns * S}px auto`,
        backgroundPosition: ref.columns === 1 ? '0 0' : `-${col * S}px -${row * S}px`,
      }} />
    )
  }
  const COLS = 8
  const col = id % COLS
  const row = Math.floor(id / COLS)
  return (
    <div style={{
      width: S, height: S, flexShrink: 0, imageRendering: 'pixelated',
      backgroundImage: 'url("/world/SampleMap/[Base]BaseChip_pipo.png")',
      backgroundRepeat: 'no-repeat', backgroundSize: `${COLS * S}px auto`,
      backgroundPosition: `-${col * S}px -${row * S}px`,
    }} />
  )
}

function TilePicker({ current, onChange, onClose }: {
  current?: string
  onChange: (tileId: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const allIds = Object.keys(BASE_CHIP_TILES as Record<string, number>)
  const filtered = search ? allIds.filter(id => id.toLowerCase().includes(search.toLowerCase())) : allIds
  return (
    <div style={{ marginTop: 4, background: '#0e0e1a', border: '1px solid #555', borderRadius: 4, padding: 6 }}>
      <input
        autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter tiles…"
        style={{ width: '100%', padding: '3px 6px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box', marginBottom: 4 }}
      />
      <div style={{ maxHeight: 180, overflowY: 'auto', display: 'grid', gridTemplateColumns: `repeat(8, ${S}px)`, gap: 2 }}>
        {filtered.slice(0, 400).map(id => (
          <button
            key={id} title={id} onClick={() => { onChange(id); onClose() }}
            style={{
              width: S, height: S, padding: 0, cursor: 'pointer', display: 'flex',
              background: id === current ? '#2a4a7a' : 'transparent',
              border: id === current ? '1px solid #5a8aee' : '1px solid transparent', borderRadius: 1,
            }}
          >
            <TileThumb tileId={id} />
          </button>
        ))}
      </div>
      <button onClick={onClose} style={{ marginTop: 4, fontSize: 10, color: '#666', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
        Cancel
      </button>
    </div>
  )
}

// ── Canvas preview ──────────────────────────────────────────────────────────────

function BundleCanvas({ bundle, scale }: { bundle: RawBundle; scale: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const maxX = bundle.tiles.length > 0 ? Math.max(0, ...bundle.tiles.map(t => t.x)) : 0
  const maxY = bundle.tiles.length > 0 ? Math.max(0, ...bundle.tiles.map(t => t.y)) : 0
  const cols = maxX + 1 + PAD * 2
  const rows = maxY + 1 + PAD * 2

  usePixiApp(containerRef, cols * T * scale, rows * T * scale, (app) => {
    app.stage.scale.set(scale)

    const bg = new PIXI.Graphics()
    for (let cx = 0; cx < cols; cx++)
      for (let cy = 0; cy < rows; cy++)
        bg.rect(cx * T, cy * T, T, T).fill({ color: (cx + cy) % 2 === 0 ? 0x1e1e2e : 0x16161f })
    app.stage.addChild(bg)

    const originG = new PIXI.Graphics()
    originG.rect(PAD * T, (PAD + maxY) * T, T, T).fill({ color: 0x004400 })
    app.stage.addChild(originG)

    bundle.tiles.forEach(tile => {
      const canvasX = (PAD + tile.x) * T
      const canvasY = (PAD + maxY - tile.y) * T

      if (tile.type === 'door') {
        const g = new PIXI.Graphics()
        g.rect(canvasX, canvasY, T, T).fill({ color: 0x663300 })
        const label = new PIXI.Text({ text: 'D', style: { fontSize: 10, fill: 0xffcc88, fontFamily: 'monospace' } })
        label.position.set(canvasX + 4, canvasY + 4)
        app.stage.addChild(g, label)
        return
      }

      const numId = resolveTileId(tile.tileID)
      if (!numId) return
      loadTileRef(numId).then(tex => {
        if (!app.renderer) return
        const s = new PIXI.Sprite(tex)
        s.position.set(canvasX, canvasY)
        s.width = T; s.height = T
        if (tile.zlayer === 'above') s.alpha = 0.65
        app.stage.addChild(s)
        if (tile.glow) {
          const halo = new PIXI.Graphics()
          halo.circle(canvasX + T / 2, canvasY + T / 2, T / 2).fill({ color: 0xffdd66, alpha: 0.35 })
          app.stage.addChild(halo)
        }
      }).catch(() => {})
    })

    const grid = new PIXI.Graphics()
    grid.setStrokeStyle({ width: 0.5, color: 0x333355, alpha: 0.6 })
    for (let cx = 0; cx <= cols; cx++) grid.moveTo(cx * T, 0).lineTo(cx * T, rows * T)
    for (let cy = 0; cy <= rows; cy++) grid.moveTo(0, cy * T).lineTo(cols * T, cy * T)
    grid.stroke()
    app.stage.addChild(grid)
  })

  return <div ref={containerRef} />
}

// ── Per-tile editor row ─────────────────────────────────────────────────────────

const num: React.CSSProperties = {
  width: 44, padding: '2px 4px', background: '#111', border: '1px solid #444',
  color: '#eee', borderRadius: 3, fontSize: 11,
}
const lbl: React.CSSProperties = { fontSize: 10, color: '#778' }

function TileRow({ tile, onChange, onDelete, onDuplicate }: {
  tile: RawBundleTile
  onChange: (patch: Partial<RawBundleTile>) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const [picking, setPicking] = useState(false)
  const type = tile.type ?? 'decor'
  const z = tile.zlayer ?? 'solid'

  return (
    <div style={{ border: '1px solid #2a2a44', borderRadius: 4, padding: 8, marginBottom: 6, background: '#13131f' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <select
          value={type}
          onChange={e => onChange({ type: e.target.value as TileType })}
          style={{ background: '#111', color: '#aaccdd', border: '1px solid #336', padding: '2px 4px', fontSize: 11, borderRadius: 3 }}
        >
          <option value="decor">decor</option>
          <option value="window">window</option>
          <option value="door">door</option>
        </select>
        <label style={lbl}>X<input type="number" value={tile.x} onChange={e => onChange({ x: Number(e.target.value) })} style={{ ...num, marginLeft: 3 }} /></label>
        <label style={lbl}>Y<input type="number" value={tile.y} onChange={e => onChange({ y: Number(e.target.value) })} style={{ ...num, marginLeft: 3 }} /></label>
        <div style={{ flex: 1 }} />
        <button onClick={onDuplicate} title="Duplicate" style={{ background: '#1a2a3a', border: '1px solid #2a4a6a', color: '#8ad', borderRadius: 3, fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}>⧉</button>
        <button onClick={onDelete} title="Delete" style={{ background: '#3a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}>✕</button>
      </div>

      {type !== 'door' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div
              onClick={() => setPicking(p => !p)}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 3, border: picking ? '1px solid #5a8aee' : '1px solid #333' }}
              title="Click to change tile"
            >
              {tile.tileID ? <TileThumb tileId={tile.tileID} /> : <div style={{ width: S, height: S, background: '#222' }} />}
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ab' }}>{tile.tileID ?? '(pick tile)'} ✎</span>
            </div>
          </div>
          {picking && <TilePicker current={tile.tileID} onChange={id => onChange({ tileID: id })} onClose={() => setPicking(false)} />}

          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {(['solid', 'below', 'above'] as Zlayer[]).map(zz => (
              <button
                key={zz}
                onClick={() => onChange({ zlayer: zz })}
                style={{
                  padding: '3px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: 'none',
                  background: z === zz ? '#f0c040' : '#333', color: z === zz ? '#1a1a2e' : '#aaa',
                }}
              >{zz}</button>
            ))}
          </div>

          {type === 'decor' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!tile.glow} onChange={e => onChange({ glow: e.target.checked || undefined })} />
                glow
              </label>
              {tile.glow && (
                <>
                  <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 4 }}>
                    radius
                    <input type="range" min={1} max={8} step={0.5} value={tile.glowRadius ?? 2} onChange={e => onChange({ glowRadius: Number(e.target.value) })} style={{ width: 70 }} />
                    <span style={{ color: '#aaa', width: 26 }}>{tile.glowRadius ?? 2}t</span>
                  </label>
                  <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!tile.pulse} onChange={e => onChange({ pulse: e.target.checked || undefined })} />
                    pulse
                  </label>
                </>
              )}
            </div>
          )}
        </>
      )}

      {type === 'door' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={lbl}>
            buildingId
            <input
              value={tile.buildingId ?? ''}
              onChange={e => onChange({ buildingId: e.target.value || undefined })}
              style={{ ...num, width: 110, marginLeft: 4 }}
            />
          </label>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!tile.hideSign} onChange={e => onChange({ hideSign: e.target.checked || undefined })} />
            hideSign
          </label>
        </div>
      )}
    </div>
  )
}

// ── Editor component ────────────────────────────────────────────────────────────

function cleanTile(t: RawBundleTile): RawBundleTile {
  const out: RawBundleTile = { x: t.x, y: t.y }
  const type = t.type ?? 'decor'
  if (type !== 'decor') out.type = type
  if (type === 'door') {
    if (t.buildingId) out.buildingId = t.buildingId
    if (t.hideSign) out.hideSign = true
  } else {
    if (t.tileID) out.tileID = t.tileID
    if (t.zlayer) out.zlayer = t.zlayer
    if (type === 'decor') {
      if (t.glow) out.glow = true
      if (t.glow && t.glowRadius !== undefined) out.glowRadius = t.glowRadius
      if (t.glow && t.pulse) out.pulse = true
    }
  }
  return out
}

function serialize(bundles: RawBundle[]): RawBundle[] {
  return bundles.map(b => ({ bundleID: b.bundleID, tiles: b.tiles.map(cleanTile) }))
}

function BundleEditor() {
  const [bundles, setBundles] = useState<RawBundle[]>(
    () => structuredClone(rawBundles) as RawBundle[],
  )
  const [selectedId, setSelectedId] = useState(bundles[0]?.bundleID ?? '')
  const [scale, setScale] = useState(4)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')

  const idx = bundles.findIndex(b => b.bundleID === selectedId)
  const bundle = idx >= 0 ? bundles[idx] : undefined

  const patchBundle = (next: RawBundle) => {
    setBundles(bs => bs.map((b, i) => i === idx ? next : b))
  }

  const updateTile = (tIdx: number, patch: Partial<RawBundleTile>) => {
    if (!bundle) return
    patchBundle({ ...bundle, tiles: bundle.tiles.map((t, i) => i === tIdx ? { ...t, ...patch } : t) })
  }
  const deleteTile = (tIdx: number) => {
    if (!bundle) return
    patchBundle({ ...bundle, tiles: bundle.tiles.filter((_, i) => i !== tIdx) })
  }
  const duplicateTile = (tIdx: number) => {
    if (!bundle) return
    const copy = { ...bundle.tiles[tIdx], x: bundle.tiles[tIdx].x + 1 }
    const tiles = [...bundle.tiles]
    tiles.splice(tIdx + 1, 0, copy)
    patchBundle({ ...bundle, tiles })
  }
  const addTile = () => {
    if (!bundle) return
    patchBundle({ ...bundle, tiles: [...bundle.tiles, { type: 'decor', x: 0, y: 0, zlayer: 'solid' }] })
  }

  const renameBundle = (name: string) => {
    if (!bundle) return
    setBundles(bs => bs.map((b, i) => i === idx ? { ...b, bundleID: name } : b))
    setSelectedId(name)
  }

  const newBundle = () => {
    let n = 1
    while (bundles.some(b => b.bundleID === `new-bundle-${n}`)) n++
    const id = `new-bundle-${n}`
    setBundles(bs => [...bs, { bundleID: id, tiles: [{ type: 'decor', x: 0, y: 0, zlayer: 'solid' }] }])
    setSelectedId(id)
  }

  const deleteBundle = () => {
    if (!bundle) return
    if (!window.confirm(`Delete bundle "${bundle.bundleID}"?`)) return
    const remaining = bundles.filter((_, i) => i !== idx)
    setBundles(remaining)
    setSelectedId(remaining[0]?.bundleID ?? '')
  }

  const handleSave = async () => {
    setSaveState('saving'); setSaveMsg('')
    try {
      await saveBundles(serialize(bundles))
      setSaveState('ok')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (e) {
      setSaveState('error')
      setSaveMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setSaveState('idle'), 4000)
    }
  }

  const exportJson = () => {
    navigator.clipboard?.writeText(JSON.stringify(serialize(bundles), null, 2))
    setSaveMsg('Copied JSON to clipboard'); setTimeout(() => setSaveMsg(''), 2000)
  }

  const dupBundleId = bundles.filter(b => b.bundleID === selectedId).length > 1

  const btn: React.CSSProperties = {
    padding: '4px 10px', background: '#1e2a4e', border: '1px solid #3a4a8e',
    color: '#8af', borderRadius: 3, fontSize: 12, cursor: 'pointer',
  }

  return (
    <div style={{ background: '#0a0a18', minHeight: '100vh', color: '#aabbcc', fontFamily: 'monospace', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13, color: '#88ccff' }}>Bundle Editor</strong>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{ background: '#111', color: '#88ccff', border: '1px solid #336', padding: '4px 10px', fontFamily: 'monospace', fontSize: 12 }}
        >
          {bundles.map(b => <option key={b.bundleID} value={b.bundleID}>{b.bundleID}</option>)}
        </select>
        <button style={{ ...btn, background: '#1e2e1e', borderColor: '#3a5a3a', color: '#6d6' }} onClick={newBundle}>+ New bundle</button>
        <button style={{ ...btn, background: '#3a1a1a', borderColor: '#922', color: '#f88' }} onClick={deleteBundle} disabled={!bundle}>Delete bundle</button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          Scale
          <input type="range" min={2} max={6} step={1} value={scale} onChange={e => setScale(Number(e.target.value))} style={{ width: 80 }} />
          {scale}×
        </label>

        <div style={{ flex: 1 }} />
        {saveMsg && <span style={{ color: saveState === 'error' ? '#f66' : '#8d8', fontSize: 11 }}>{saveMsg}</span>}
        <button style={btn} onClick={exportJson}>Copy JSON</button>
        <button
          style={{ ...btn, background: saveState === 'ok' ? '#1e4e1e' : '#2a4e2a', color: '#8d8', fontWeight: 'bold' }}
          onClick={handleSave}
          disabled={saveState === 'saving'}
        >
          {saveState === 'saving' ? '…' : saveState === 'ok' ? '✓ Saved' : 'Save bundles.json'}
        </button>
      </div>

      {bundle ? (
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ background: '#111122', border: '1px solid #334', display: 'inline-block', marginBottom: 8 }}>
              <BundleCanvas key={`${selectedId}-${scale}-${bundle.tiles.length}-${JSON.stringify(bundle.tiles)}`} bundle={bundle} scale={scale} />
            </div>
            <div style={{ fontSize: 11, color: '#668' }}>
              Origin (0,0) = <span style={{ color: '#44ff88' }}>■</span> green · above-layer at 65% · glow shown as halo
            </div>
          </div>

          <div style={{ minWidth: 360, maxWidth: 440, maxHeight: 'calc(100vh - 60px)', overflowY: 'auto', paddingRight: 8 }}>
            <label style={{ ...lbl, display: 'block', marginBottom: 10 }}>
              Bundle ID
              <input
                value={bundle.bundleID}
                onChange={e => renameBundle(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 3, padding: '4px 6px', background: '#111', border: `1px solid ${dupBundleId ? '#922' : '#444'}`, color: '#eee', borderRadius: 3, fontSize: 12, boxSizing: 'border-box' }}
              />
              {dupBundleId && <span style={{ color: '#f88' }}>duplicate id — last one wins on load</span>}
            </label>

            <div style={{ fontSize: 12, color: '#668', marginBottom: 6 }}>{bundle.tiles.length} tiles</div>
            {bundle.tiles.map((t, i) => (
              <TileRow
                key={i}
                tile={t}
                onChange={patch => updateTile(i, patch)}
                onDelete={() => deleteTile(i)}
                onDuplicate={() => duplicateTile(i)}
              />
            ))}
            <button style={{ ...btn, width: '100%', background: '#1e2e1e', borderColor: '#3a5a3a', color: '#6d6' }} onClick={addTile}>
              + Add tile
            </button>
          </div>
        </div>
      ) : (
        <div style={{ color: '#664444', padding: 20 }}>No bundle selected.</div>
      )}
    </div>
  )
}

// ── Storybook meta ──────────────────────────────────────────────────────────────

const meta = {
  component: BundleEditor,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BundleEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Editor: Story = {}
