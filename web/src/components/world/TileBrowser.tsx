import React, { useState } from 'react'

export interface TilesetDef {
  name: string
  image: string
  tilecount: number
  columns: number
  tileWidth?: number
  tileHeight?: number
}

interface Props {
  tileset: TilesetDef
  scale?: number
}

export function TileBrowser({ tileset, scale = 2 }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const tw = tileset.tileWidth ?? 32
  const th = tileset.tileHeight ?? 32
  const displayW = tw * scale
  const displayH = th * scale

  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
        <strong>{tileset.name}</strong>
        <span style={{ color: '#888' }}>{tileset.tilecount} tiles · {tileset.columns} cols</span>
        {selected !== null && (
          <span style={{ background: '#222', color: '#0f0', padding: '2px 8px', borderRadius: 4 }}>
            tile #{selected}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {Array.from({ length: tileset.tilecount }, (_, i) => {
          const col = i % tileset.columns
          const row = Math.floor(i / tileset.columns)
          const isSelected = selected === i
          return (
            <div
              key={i}
              title={`Tile #${i} (col ${col}, row ${row})`}
              onClick={() => setSelected(i === selected ? null : i)}
              style={{
                position: 'relative',
                width: displayW,
                height: displayH,
                backgroundImage: `url(${tileset.image})`,
                backgroundPosition: `-${col * tw * scale}px -${row * th * scale}px`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${tileset.columns * tw * scale}px auto`,
                imageRendering: 'pixelated',
                cursor: 'pointer',
                outline: isSelected ? '2px solid #0f0' : '1px solid #333',
                boxSizing: 'border-box',
              }}
            >
              <span style={{
                position: 'absolute',
                bottom: 0,
                right: 1,
                fontSize: 7,
                lineHeight: 1,
                color: 'rgba(255,255,255,0.7)',
                textShadow: '0 0 2px #000',
                pointerEvents: 'none',
              }}>
                {i}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
