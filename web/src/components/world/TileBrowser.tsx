import React, { useState, useEffect, useRef, useMemo } from 'react'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'
import { resolveTileRef } from '../../data/tiles/tileIndex'

function getOfficialIdsForTileset(tilesetImage: string): Set<number> {
  const ids = new Set<number>()
  for (const globalId of Object.values(BASE_CHIP_TILES)) {
    try {
      const ref = resolveTileRef(globalId)
      if (ref.file === tilesetImage) ids.add(ref.id)
    } catch { /* skip unresolvable IDs */ }
  }
  return ids
}

function stripOfficialTiles(labels: Record<number, string>, officialIds: Set<number>): Record<number, string> {
  const cleaned: Record<number, string> = {}
  for (const [k, v] of Object.entries(labels)) {
    if (!officialIds.has(Number(k))) cleaned[Number(k)] = v
  }
  return cleaned
}

export interface TilesetDef {
  name: string
  image: string
  tilecount: number
  columns: number
  tileWidth?: number
  tileHeight?: number
  /** If set, export adds this offset to each local tile ID — paste output directly into baseChipIndex.ts */
  globalIdStart?: number
}

interface Props {
  tileset: TilesetDef
  scale?: number
  labels?: Record<number, string>
}

const PAGE_SIZE = 256

function storageKey(tilesetName: string) {
  return `tilebrowser-labels:${tilesetName}`
}

function loadCustomLabels(tilesetName: string, tilesetImage: string): Record<number, string> {
  try {
    const raw = localStorage.getItem(storageKey(tilesetName))
    if (!raw) return {}
    const loaded: Record<number, string> = JSON.parse(raw)
    const officialIds = getOfficialIdsForTileset(tilesetImage)
    const cleaned = stripOfficialTiles(loaded, officialIds)
    if (Object.keys(cleaned).length !== Object.keys(loaded).length) {
      saveCustomLabels(tilesetName, cleaned)
    }
    return cleaned
  } catch { return {} }
}

function saveCustomLabels(tilesetName: string, labels: Record<number, string>) {
  try { localStorage.setItem(storageKey(tilesetName), JSON.stringify(labels)) } catch { /* ignore */ }
}

export function TileBrowser({ tileset, scale = 2, labels }: Props) {
  const [selected, setSelected]       = useState<number | null>(null)
  const [copied, setCopied]           = useState(false)
  const [page, setPage]               = useState(0)
  const [naming, setNaming]           = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const [customLabels, setCustomLabels] = useState<Record<number, string>>(() => loadCustomLabels(tileset.name, tileset.image))
  const [exported, setExported]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const officialIds = useMemo(() => getOfficialIdsForTileset(tileset.image), [tileset.name])

  // Reload custom labels when tileset changes, stripping any that became official
  useEffect(() => {
    setCustomLabels(loadCustomLabels(tileset.name, tileset.image))
    setSelected(null)
    setNaming(false)
    setPage(0)
  }, [tileset.name])

  useEffect(() => {
    if (naming) inputRef.current?.focus()
  }, [naming])

  const tw = tileset.tileWidth ?? 32
  const th = tileset.tileHeight ?? 32
  const displayW = tw * scale
  const displayH = th * scale

  const totalPages = Math.ceil(tileset.tilecount / PAGE_SIZE)
  const pageStart = page * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, tileset.tilecount)

  function getLabel(i: number) {
    return labels?.[i] ?? customLabels[i]
  }

  function handleTileClick(i: number) {
    if (naming) return
    if (i === selected) {
      const label = getLabel(i)
      if (label) {
        navigator.clipboard.writeText(label).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      } else {
        setNaming(true)
        setNameInput('')
      }
    } else {
      setSelected(i)
      setCopied(false)
      setNaming(false)
    }
  }

  function commitName() {
    const trimmed = nameInput.trim()
    if (trimmed && selected !== null && !officialIds.has(selected)) {
      const next = { ...customLabels, [selected]: trimmed }
      setCustomLabels(next)
      saveCustomLabels(tileset.name, next)
    }
    setNaming(false)
    setNameInput('')
  }

  function cancelName() {
    setNaming(false)
    setNameInput('')
  }

  function handleExport() {
    const sorted = Object.entries(customLabels).sort(([a], [b]) => Number(a) - Number(b))
    if (!sorted.length) return
    const offset = tileset.globalIdStart ?? 0
    const text = sorted.map(([localId, name]) => `    ${name}: ${Number(localId) + offset},`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setExported(true)
      setTimeout(() => setExported(false), 2000)
    })
  }

  const selectedLabel = selected !== null ? getLabel(selected) : undefined
  const customCount = Object.keys(customLabels).length

  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      {/* ── Toolbar ── */}
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
        {customCount > 0 && (
          <button
            onClick={handleExport}
            style={{ background: exported ? '#184' : '#333', color: exported ? '#0f0' : '#aaa', border: '1px solid #555', padding: '2px 10px', cursor: 'pointer', fontSize: 11 }}
          >
            {exported ? `✓ copied ${customCount} names` : `export ${customCount} custom name${customCount !== 1 ? 's' : ''}`}
          </button>
        )}
        {/* ── Selection / naming info ── */}
        {selected !== null && !naming && (
          <span style={{ background: '#222', color: copied ? '#ff0' : selectedLabel ? '#0f0' : '#aaa', padding: '2px 8px', borderRadius: 4 }}>
            #{selected}{selectedLabel ? ` — ${selectedLabel}` : ' — unnamed'}
            {!selectedLabel && <span style={{ color: '#555', marginLeft: 6 }}>click again to name</span>}
            {selectedLabel && !copied && <span style={{ color: '#555', marginLeft: 6 }}>click again to copy</span>}
            {copied && ' ✓ copied'}
          </span>
        )}
        {naming && selected !== null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#aaa' }}>#{selected} name:</span>
            <input
              ref={inputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') cancelName() }}
              placeholder="camelCaseName"
              style={{ background: '#1a1a1a', color: '#0f0', border: '1px solid #0f0', padding: '2px 8px', fontFamily: 'monospace', fontSize: 13, width: 180 }}
            />
            <button onClick={commitName} style={{ background: '#184', color: '#0f0', border: '1px solid #0a4', padding: '2px 8px', cursor: 'pointer' }}>Save</button>
            <button onClick={cancelName} style={{ background: '#333', color: '#888', border: '1px solid #555', padding: '2px 8px', cursor: 'pointer' }}>✕</button>
          </span>
        )}
      </div>

      {/* ── Tile grid ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {Array.from({ length: pageEnd - pageStart }, (_, idx) => {
          const i = pageStart + idx
          const col = i % tileset.columns
          const row = Math.floor(i / tileset.columns)
          const isSelected = selected === i
          const label = getLabel(i)
          const hasLabel = label !== undefined
          const isCustom = customLabels[i] !== undefined
          return (
            <div
              key={i}
              title={label ? `#${i} — ${label}${isCustom ? ' (custom)' : ''}` : `#${i} (col ${col}, row ${row}) — click to name`}
              onClick={() => handleTileClick(i)}
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
                outline: isSelected ? '2px solid #0f0' : isCustom ? '1px solid #a84' : hasLabel ? '1px solid #446' : '1px solid #333',
                boxSizing: 'border-box',
              }}
            >
              <span style={{
                position: 'absolute',
                bottom: 0,
                right: 1,
                fontSize: 7,
                lineHeight: 1,
                color: isCustom ? 'rgba(255,180,80,0.9)' : hasLabel ? 'rgba(100,200,255,0.9)' : 'rgba(255,255,255,0.7)',
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
