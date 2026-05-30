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
  labels?: Record<number, string>
}

const PAGE_SIZE = 256

export function TileBrowser({ tileset, scale = 2, labels }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [page, setPage] = useState(0)
  const tw = tileset.tileWidth ?? 32
  const th = tileset.tileHeight ?? 32
  const displayW = tw * scale
  const displayH = th * scale

  const totalPages = Math.ceil(tileset.tilecount / PAGE_SIZE)
  const pageStart = page * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, tileset.tilecount)
  const selectedLabel = selected !== null ? labels?.[selected] : undefined

  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <strong>{tileset.name}</strong>
        <span style={{ color: '#888' }}>{tileset.tilecount} tiles · {tileset.columns} cols</span>
        {totalPages > 1 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ background: '#333', color: '#ccc', border: 'none', padding: '2px 8px', cursor: 'pointer' }}>◀</button>
            <span style={{ color: '#888' }}>{pageStart}–{pageEnd - 1} / {tileset.tilecount - 1}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ background: '#333', color: '#ccc', border: 'none', padding: '2px 8px', cursor: 'pointer' }}>▶</button>
          </span>
        )}
        {selected !== null && (
          <span style={{ background: '#222', color: copied ? '#ff0' : '#0f0', padding: '2px 8px', borderRadius: 4 }}>
            #{selected}{selectedLabel ? ` — ${selectedLabel}` : ''}{copied ? ' ✓ copied' : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {Array.from({ length: pageEnd - pageStart }, (_, idx) => {
          const i = pageStart + idx
          const col = i % tileset.columns
          const row = Math.floor(i / tileset.columns)
          const isSelected = selected === i
          const label = labels?.[i]
          const hasLabel = label !== undefined
          return (
            <div
              key={i}
              title={label ? `#${i} — ${label}` : `#${i} (col ${col}, row ${row})`}
              onClick={() => {
                if (i === selected) {
                  const text = labels?.[i] ?? String(i)
                  navigator.clipboard.writeText(text).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  })
                } else {
                  setSelected(i)
                  setCopied(false)
                }
              }}
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
                outline: isSelected ? '2px solid #0f0' : hasLabel ? '1px solid #446' : '1px solid #333',
                boxSizing: 'border-box',
              }}
            >
              <span style={{
                position: 'absolute',
                bottom: 0,
                right: 1,
                fontSize: 7,
                lineHeight: 1,
                color: hasLabel ? 'rgba(100,200,255,0.9)' : 'rgba(255,255,255,0.7)',
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
