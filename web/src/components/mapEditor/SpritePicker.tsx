import React from 'react'
import { NPC_SPRITE_SLUGS, npcSpriteUrl, animalSpriteUrl, ANIMAL_TYPES, EditorAnimalType } from './spriteList'

const selectStyle: React.CSSProperties = {
  background: '#252540', border: '1px solid #444', color: '#ccc',
  fontSize: 11, padding: '3px 6px', borderRadius: 3, width: '100%',
}

const imgStyle: React.CSSProperties = {
  width: 32, height: 32, objectFit: 'contain', background: '#1a1a2e',
  border: '1px solid #333', borderRadius: 3, flexShrink: 0,
}

/** Dropdown + preview for selecting an NPC sprite slug. */
export function NpcSpritePicker({ value, onChange }: { value: string; onChange: (slug: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <img src={npcSpriteUrl(value)} style={imgStyle} alt="" />
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
