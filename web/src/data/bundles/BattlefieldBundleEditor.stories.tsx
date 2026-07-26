import React, { useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import type { Meta, StoryObj } from '@storybook/react-vite'
import rawBundles from './battlefieldBundles.json'
import { saveBattlefieldBundles } from './battlefieldBundleEditorApi'
import { usePixiApp } from '../../hooks/usePixiApp'
import { loadTileTexture } from '../../utils/pixiHelpers'
import { WORLD_DECOR, WORLD_DECOR_FILE } from '../tiles/worldTileIndex'
import { isSelfSave } from '../../utils/hotReloadGuard'

// Same full-reload issue as battlefieldBundleLoader.ts — this story also
// statically imports battlefieldBundles.json, a separate import chain.
if (import.meta.hot) {
  import.meta.hot.accept('./battlefieldBundles.json', () => {
    if (!isSelfSave()) {
      console.warn('[battlefield bundle editor] battlefieldBundles.json changed on disk outside this tab. Refresh to pick it up — unsaved changes here were left alone.')
    }
  })
}

const T   = 32
const PAD = 1
const COLS = 8

// ── Raw (on-disk) bundle shape — what battlefieldBundles.json actually stores ──

interface RawBundleTile {
  tileKey: string
  dtx: number
  dty: number
}

interface RawBundle {
  bundleId: string
  label:    string
  tiles:    RawBundleTile[]
}

function resolveTileId(key: string): number {
  return (WORLD_DECOR as Record<string, number>)[key] ?? 0
}

// ── Tile thumbnail + picker ────────────────────────────────────────────────────

const S = 24

function TileThumb({ tileKey }: { tileKey: string }) {
  const id = resolveTileId(tileKey)
  const col = id % COLS
  const row = Math.floor(id / COLS)
  return (
    <div style={{
      width: S, height: S, flexShrink: 0, imageRendering: 'pixelated',
      backgroundImage: `url("${WORLD_DECOR_FILE}")`, backgroundRepeat: 'no-repeat',
      backgroundSize: `${COLS * S}px auto`,
      backgroundPosition: `-${col * S}px -${row * S}px`,
    }} />
  )
}

function TilePicker({ current, onChange, onClose }: {
  current?: string
  onChange: (tileKey: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const allKeys = Object.keys(WORLD_DECOR)
  const filtered = search ? allKeys.filter(k => k.toLowerCase().includes(search.toLowerCase())) : allKeys
  return (
    <div style={{ marginTop: 4, background: '#0e0e1a', border: '1px solid #555', borderRadius: 4, padding: 6 }}>
      <input
        autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter tiles…"
        style={{ width: '100%', padding: '3px 6px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box', marginBottom: 4 }}
      />
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gridTemplateColumns: `repeat(6, ${S}px)`, gap: 2 }}>
        {filtered.map(key => (
          <button
            key={key} title={key} onClick={() => { onChange(key); onClose() }}
            style={{
              width: S, height: S, padding: 0, cursor: 'pointer', display: 'flex',
              background: key === current ? '#2a4a7a' : 'transparent',
              border: key === current ? '1px solid #5a8aee' : '1px solid transparent', borderRadius: 1,
            }}
          >
            <TileThumb tileKey={key} />
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
  const minX = bundle.tiles.length > 0 ? Math.min(0, ...bundle.tiles.map(t => t.dtx)) : 0
  const maxX = bundle.tiles.length > 0 ? Math.max(0, ...bundle.tiles.map(t => t.dtx)) : 0
  const minY = bundle.tiles.length > 0 ? Math.min(0, ...bundle.tiles.map(t => t.dty)) : 0
  const maxY = bundle.tiles.length > 0 ? Math.max(0, ...bundle.tiles.map(t => t.dty)) : 0
  const cols = maxX - minX + 1 + PAD * 2
  const rows = maxY - minY + 1 + PAD * 2

  usePixiApp(containerRef, cols * T * scale, rows * T * scale, (app) => {
    app.stage.scale.set(scale)

    const bg = new PIXI.Graphics()
    for (let cx = 0; cx < cols; cx++)
      for (let cy = 0; cy < rows; cy++)
        bg.rect(cx * T, cy * T, T, T).fill({ color: (cx + cy) % 2 === 0 ? 0x1e1e2e : 0x16161f })
    app.stage.addChild(bg)

    // Origin (0,0) marker
    const originG = new PIXI.Graphics()
    originG.rect((PAD - minX) * T, (PAD - minY) * T, T, T).fill({ color: 0x004400 })
    app.stage.addChild(originG)

    bundle.tiles.forEach(tile => {
      const canvasX = (PAD + tile.dtx - minX) * T
      const canvasY = (PAD + tile.dty - minY) * T
      const id = resolveTileId(tile.tileKey)
      loadTileTexture(WORLD_DECOR_FILE, id, COLS).then(tex => {
        if (!app.renderer) return
        const s = new PIXI.Sprite(tex)
        s.position.set(canvasX, canvasY)
        s.width = T; s.height = T
        app.stage.addChild(s)
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

  return (
    <div style={{ border: '1px solid #2a2a44', borderRadius: 4, padding: 8, marginBottom: 6, background: '#13131f' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div
          onClick={() => setPicking(p => !p)}
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 3, border: picking ? '1px solid #5a8aee' : '1px solid #333' }}
          title="Click to change tile"
        >
          <TileThumb tileKey={tile.tileKey} />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ab' }}>{tile.tileKey} ✎</span>
        </div>
        <div style={{ flex: 1 }} />
        <label style={lbl}>dtx<input type="number" value={tile.dtx} onChange={e => onChange({ dtx: Number(e.target.value) })} style={{ ...num, marginLeft: 3 }} /></label>
        <label style={lbl}>dty<input type="number" value={tile.dty} onChange={e => onChange({ dty: Number(e.target.value) })} style={{ ...num, marginLeft: 3 }} /></label>
        <button onClick={onDuplicate} title="Duplicate" style={{ background: '#1a2a3a', border: '1px solid #2a4a6a', color: '#8ad', borderRadius: 3, fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}>⧉</button>
        <button onClick={onDelete} title="Delete" style={{ background: '#3a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}>✕</button>
      </div>
      {picking && <TilePicker current={tile.tileKey} onChange={key => onChange({ tileKey: key })} onClose={() => setPicking(false)} />}
    </div>
  )
}

// ── Editor component ────────────────────────────────────────────────────────────

function BattlefieldBundleEditor() {
  const [bundles, setBundles] = useState<RawBundle[]>(
    () => structuredClone(rawBundles) as RawBundle[],
  )
  const [selectedId, setSelectedId] = useState(bundles[0]?.bundleId ?? '')
  const [scale, setScale] = useState(4)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [saveMsg, setSaveMsg] = useState('')

  const idx = bundles.findIndex(b => b.bundleId === selectedId)
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
    const copy = { ...bundle.tiles[tIdx], dtx: bundle.tiles[tIdx].dtx + 1 }
    const tiles = [...bundle.tiles]
    tiles.splice(tIdx + 1, 0, copy)
    patchBundle({ ...bundle, tiles })
  }
  const addTile = () => {
    if (!bundle) return
    patchBundle({ ...bundle, tiles: [...bundle.tiles, { tileKey: Object.keys(WORLD_DECOR)[0], dtx: 0, dty: 0 }] })
  }

  const renameBundle = (id: string) => {
    if (!bundle) return
    setBundles(bs => bs.map((b, i) => i === idx ? { ...b, bundleId: id } : b))
    setSelectedId(id)
  }
  const relabelBundle = (label: string) => {
    if (!bundle) return
    patchBundle({ ...bundle, label })
  }

  const newBundle = () => {
    let n = 1
    while (bundles.some(b => b.bundleId === `new-bundle-${n}`)) n++
    const id = `new-bundle-${n}`
    setBundles(bs => [...bs, { bundleId: id, label: 'New Bundle', tiles: [{ tileKey: Object.keys(WORLD_DECOR)[0], dtx: 0, dty: 0 }] }])
    setSelectedId(id)
  }

  const deleteBundle = () => {
    if (!bundle) return
    if (!window.confirm(`Delete bundle "${bundle.bundleId}"?`)) return
    const remaining = bundles.filter((_, i) => i !== idx)
    setBundles(remaining)
    setSelectedId(remaining[0]?.bundleId ?? '')
  }

  const handleSave = async () => {
    setSaveState('saving'); setSaveMsg('')
    try {
      await saveBattlefieldBundles(bundles)
      setSaveState('ok')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (e) {
      setSaveState('error')
      setSaveMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setSaveState('idle'), 4000)
    }
  }

  const exportJson = () => {
    navigator.clipboard?.writeText(JSON.stringify(bundles, null, 2))
    setSaveMsg('Copied JSON to clipboard'); setTimeout(() => setSaveMsg(''), 2000)
  }

  const dupBundleId = bundles.filter(b => b.bundleId === selectedId).length > 1

  const btn: React.CSSProperties = {
    padding: '4px 10px', background: '#1e2a4e', border: '1px solid #3a4a8e',
    color: '#8af', borderRadius: 3, fontSize: 12, cursor: 'pointer',
  }

  return (
    <div style={{ background: '#0a0a18', minHeight: '100vh', color: '#aabbcc', fontFamily: 'monospace', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13, color: '#88ccff' }}>Battlefield Bundle Editor</strong>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{ background: '#111', color: '#88ccff', border: '1px solid #336', padding: '4px 10px', fontFamily: 'monospace', fontSize: 12 }}
        >
          {bundles.map(b => <option key={b.bundleId} value={b.bundleId}>{b.label} ({b.bundleId})</option>)}
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
          {saveState === 'saving' ? '…' : saveState === 'ok' ? '✓ Saved' : 'Save battlefieldBundles.json'}
        </button>
      </div>

      {bundle ? (
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ background: '#111122', border: '1px solid #334', display: 'inline-block', marginBottom: 8 }}>
              <BundleCanvas key={`${selectedId}-${scale}-${bundle.tiles.length}-${JSON.stringify(bundle.tiles)}`} bundle={bundle} scale={scale} />
            </div>
            <div style={{ fontSize: 11, color: '#668' }}>
              Origin (dtx=0, dty=0) = <span style={{ color: '#44ff88' }}>■</span> green — this is where a click in the battlefield editor lands.
            </div>
          </div>

          <div style={{ minWidth: 360, maxWidth: 440, maxHeight: 'calc(100vh - 60px)', overflowY: 'auto', paddingRight: 8 }}>
            <label style={{ ...lbl, display: 'block', marginBottom: 10 }}>
              Bundle ID
              <input
                value={bundle.bundleId}
                onChange={e => renameBundle(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 3, padding: '4px 6px', background: '#111', border: `1px solid ${dupBundleId ? '#922' : '#444'}`, color: '#eee', borderRadius: 3, fontSize: 12, boxSizing: 'border-box' }}
              />
              {dupBundleId && <span style={{ color: '#f88' }}>duplicate id — last one wins on load</span>}
            </label>
            <label style={{ ...lbl, display: 'block', marginBottom: 10 }}>
              Label (shown in the battlefield editor's Bundles tab)
              <input
                value={bundle.label}
                onChange={e => relabelBundle(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 3, padding: '4px 6px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 12, boxSizing: 'border-box' }}
              />
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
  title:     'Battlefield Editor/Bundle Editor',
  component: BattlefieldBundleEditor,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BattlefieldBundleEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Editor: Story = {}
