import React, { useState, useMemo } from 'react'
import { NPC_SPRITE_SLUGS, npcSpriteUrl, animalSpriteUrl, resolveNpcSprite, ANIMAL_TYPES, EditorAnimalType } from './spriteList'

const selectStyle: React.CSSProperties = {
  background: '#252540', border: '1px solid #444', color: '#ccc',
  fontSize: 11, padding: '3px 6px', borderRadius: 3, width: '100%',
}

const imgStyle: React.CSSProperties = {
  width: 32, height: 32, objectFit: 'contain', background: '#1a1a2e',
  border: '1px solid #333', borderRadius: 3, flexShrink: 0,
}

/**
 * Searchable sprite picker over every NPC and card/unit sprite
 * (`NPC_SPRITE_SLUGS`). Shows the current sprite (with default fallback) and,
 * when focused, a filterable grid of thumbnails. Mirrors the TilePicker pattern.
 */
export function SpriteSearchPicker({ value, onChange }: { value: string; onChange: (slug: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? NPC_SPRITE_SLUGS.filter(s => s.toLowerCase().includes(q)) : NPC_SPRITE_SLUGS
    return list.slice(0, 300)
  }, [search])

  return (
    <div>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
        title="Click to change sprite"
      >
        <img src={npcSpriteUrl(resolveNpcSprite(value))} style={imgStyle} alt="" />
        <span style={{ flex: 1, fontSize: 11, color: value ? '#ccc' : '#888', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || `(default: ${resolveNpcSprite(value)})`}
        </span>
        <span style={{ fontSize: 10, color: '#666' }}>{open ? '▾' : '✎'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, background: '#0e0e1a', border: '1px solid #555', borderRadius: 4, padding: 6 }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sprites…"
            style={{ ...selectStyle, marginBottom: 4 }}
          />
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 36px)', gap: 4 }}>
            {filtered.map(slug => (
              <button
                key={slug}
                title={slug}
                onClick={() => { onChange(slug); setOpen(false); setSearch('') }}
                style={{
                  width: 36, height: 36, padding: 2, cursor: 'pointer', display: 'flex',
                  background: slug === value ? '#2a4a7a' : 'transparent',
                  border: slug === value ? '1px solid #5a8aee' : '1px solid #2a2a3a',
                  borderRadius: 3,
                }}
              >
                <img src={npcSpriteUrl(slug)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
              </button>
            ))}
            {filtered.length === 0 && <span style={{ color: '#666', fontSize: 10 }}>No matches</span>}
          </div>
          {search.trim() && !NPC_SPRITE_SLUGS.includes(search.trim()) && (
            <button
              onClick={() => { onChange(search.trim()); setOpen(false); setSearch('') }}
              style={{ marginTop: 4, fontSize: 10, color: '#8af', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
            >
              Use custom slug "{search.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Dropdown + preview for selecting an NPC sprite slug (legacy; prefer SpriteSearchPicker). */
export function NpcSpritePicker({ value, onChange }: { value: string; onChange: (slug: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <img src={npcSpriteUrl(resolveNpcSprite(value))} style={imgStyle} alt="" />
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {!NPC_SPRITE_SLUGS.includes(value) && (
          <option value={value}>{value} (custom)</option>
        )}
        {NPC_SPRITE_SLUGS.map(slug => (
          <option key={slug} value={slug}>{slug}</option>
        ))}
      </select>
    </div>
  )
}

/** Dropdown + preview for selecting an animal type. */
export function AnimalTypePicker({ value, onChange }: { value: string; onChange: (type: EditorAnimalType) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <img src={animalSpriteUrl(value)} style={imgStyle} alt="" />
      <select value={value} onChange={e => onChange(e.target.value as EditorAnimalType)} style={selectStyle}>
        {ANIMAL_TYPES.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  )
}
