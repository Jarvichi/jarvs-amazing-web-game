import React, { useState, useMemo } from 'react'
import { WORLD_DECOR, WORLD_DECOR_FILE } from '../../data/tiles/worldTileIndex'

const T = 32
const COLS = 8

export interface Props {
  activeTileId: number
  onSelectTile: (tileId: number) => void
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
  const col = tileId % COLS
  const row = Math.floor(tileId / COLS)
  return (
    <div
      title={tileKey}
      onClick={onClick}
      style={{
        width:              T,
        height:             T,
        backgroundImage:    `url("${WORLD_DECOR_FILE}")`,
        backgroundPosition: `-${col * T}px -${row * T}px`,
        backgroundRepeat:   'no-repeat',
        imageRendering:     'pixelated',
        cursor:             'pointer',
        outline:            isSelected ? '2px solid #f0c040' : '1px solid transparent',
        outlineOffset:      '-1px',
        flexShrink:         0,
      }}
    />
  )
}

/**
 * Decor tile picker for the battlefield editor — a scoped-down sibling of
 * mapEditor/TilePalette.tsx sourcing from WORLD_DECOR (nodemap/32x32/decor.png)
 * instead of BASE_CHIP_TILES. No tabs/bundles/z-layer (out of scope for
 * battlefield decor); every WORLD_DECOR entry is shown flat, including
 * composite-object halves (castles, mountains, bridges) — pairing them
 * correctly is left to the artist.
 */
export function BattlefieldDecorPalette({ activeTileId, onSelectTile }: Props) {
  const [search, setSearch] = useState('')

  const entries = useMemo(() => Object.entries(WORLD_DECOR) as Array<[string, number]>, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter(([key]) => key.toLowerCase().includes(q))
  }, [entries, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1a2e', color: '#ccc', fontSize: 12 }}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #333' }}>
        <input
          type="text"
          placeholder="Search decor…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '4px 6px', background: '#111', border: '1px solid #444',
            color: '#ccc', borderRadius: 3, fontSize: 12, boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', padding: 4, gap: 2, alignContent: 'flex-start' }}>
        {filtered.map(([key, tileId]) => (
          <DecorCell
            key={key}
            tileKey={key}
            tileId={tileId}
            isSelected={activeTileId === tileId}
            onClick={() => onSelectTile(tileId)}
          />
        ))}
      </div>
    </div>
  )
}
