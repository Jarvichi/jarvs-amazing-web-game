import React, { useState, useMemo } from 'react'
import { WORLD_DECOR, WORLD_DECOR_FILE } from '../../data/tiles/worldTileIndex'
import { getAllBattlefieldBundles, type BattlefieldBundleDef } from '../../data/bundles/battlefieldBundleLoader'

const T = 32
const COLS = 8

export interface Props {
  activeTileId: number
  activeBundleId: string | null
  onSelectTile: (tileId: number) => void
  onSelectBundle: (bundleId: string) => void
}

function tileBg(tileId: number, size: number) {
  const col = tileId % COLS
  const row = Math.floor(tileId / COLS)
  return {
    width:              size,
    height:             size,
    backgroundImage:    `url("${WORLD_DECOR_FILE}")`,
    backgroundSize:      `${COLS * size}px auto`,
    backgroundPosition: `-${col * size}px -${row * size}px`,
    backgroundRepeat:   'no-repeat',
    imageRendering:     'pixelated' as const,
  }
}

function DecorCell({
  tileKey,
  tileId,
  isSelected,
  onClick,
}: {
  tileKey: string
  tileId: number
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <div
      title={tileKey}
      onClick={onClick}
      style={{
        ...tileBg(tileId, T),
        cursor:          'pointer',
        outline:         isSelected ? '2px solid #f0c040' : '1px solid transparent',
        outlineOffset:   '-1px',
        flexShrink:      0,
      }}
    />
  )
}

function BundleCard({
  bundle,
  isSelected,
  onClick,
}: {
  bundle: BattlefieldBundleDef
  isSelected: boolean
  onClick: () => void
}) {
  const minDtx = Math.min(...bundle.tiles.map(t => t.dtx))
  const minDty = Math.min(...bundle.tiles.map(t => t.dty))
  const cell = 16
  const cols = Math.max(...bundle.tiles.map(t => t.dtx)) - minDtx + 1
  const rows = Math.max(...bundle.tiles.map(t => t.dty)) - minDty + 1
  return (
    <div
      title={bundle.label}
      onClick={onClick}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            4,
        padding:        4,
        cursor:         'pointer',
        outline:        isSelected ? '2px solid #f0c040' : '1px solid transparent',
        outlineOffset:  -1,
        borderRadius:   3,
      }}
    >
      <div style={{ position: 'relative', width: cols * cell, height: rows * cell }}>
        {bundle.tiles.map((t, i) => (
          <div
            key={i}
            style={{
              ...tileBg(t.tileId, cell),
              position: 'absolute',
              left:     (t.dtx - minDtx) * cell,
              top:      (t.dty - minDty) * cell,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 9, textAlign: 'center', lineHeight: 1.2, opacity: 0.85 }}>{bundle.label}</span>
    </div>
  )
}

/**
 * Decor tile/bundle picker for the battlefield editor — a scoped-down sibling
 * of mapEditor/TilePalette.tsx sourcing from WORLD_DECOR (nodemap/32x32/decor.png)
 * instead of BASE_CHIP_TILES. The Bundles tab places several WORLD_DECOR tiles
 * at once, tile-adjacent to each other (see BattlefieldEditorCanvas) — mainly
 * for the composite objects (castles, bridges, mountain ranges) that are
 * authored as paired half-tiles and are easy to misalign placed one at a time.
 */
export function BattlefieldDecorPalette({ activeTileId, activeBundleId, onSelectTile, onSelectBundle }: Props) {
  const [tab, setTab] = useState<'tiles' | 'bundles'>('tiles')
  const [search, setSearch] = useState('')

  const entries = useMemo(() => Object.entries(WORLD_DECOR) as Array<[string, number]>, [])
  const bundles = useMemo(() => getAllBattlefieldBundles(), [])

  const filteredTiles = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter(([key]) => key.toLowerCase().includes(q))
  }, [entries, search])

  const filteredBundles = useMemo(() => {
    if (!search.trim()) return bundles
    const q = search.toLowerCase()
    return bundles.filter(b => b.label.toLowerCase().includes(q) || b.bundleId.toLowerCase().includes(q))
  }, [bundles, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1a2e', color: '#ccc', fontSize: 12 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
        {(['tiles', 'bundles'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '6px 0', background: 'none', border: 'none', color: '#ccc',
              fontWeight: tab === t ? 'bold' : 'normal', textDecoration: tab === t ? 'underline' : 'none', cursor: 'pointer',
            }}
          >
            {t === 'tiles' ? 'Tiles' : 'Bundles'}
          </button>
        ))}
      </div>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #333' }}>
        <input
          type="text"
          placeholder={tab === 'tiles' ? 'Search decor…' : 'Search bundles…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '4px 6px', background: '#111', border: '1px solid #444',
            color: '#ccc', borderRadius: 3, fontSize: 12, boxSizing: 'border-box',
          }}
        />
      </div>
      {tab === 'tiles' ? (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', padding: 4, gap: 2, alignContent: 'flex-start' }}>
          {filteredTiles.map(([key, tileId]) => (
            <DecorCell
              key={key}
              tileKey={key}
              tileId={tileId}
              isSelected={activeBundleId === null && activeTileId === tileId}
              onClick={() => onSelectTile(tileId)}
            />
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', padding: 4, gap: 2, alignContent: 'flex-start' }}>
          {filteredBundles.map(bundle => (
            <BundleCard
              key={bundle.bundleId}
              bundle={bundle}
              isSelected={activeBundleId === bundle.bundleId}
              onClick={() => onSelectBundle(bundle.bundleId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
