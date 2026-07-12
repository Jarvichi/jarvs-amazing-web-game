import React from 'react'
import type { RawAnimal } from '../mapEditorTypes'
import { AnimalTypePicker } from '../SpritePicker'
import { ANIMAL_SPECS } from '../../../game/hub/animals'
import type { AnimalType } from '../../../game/hub/animals'

const INPUT: React.CSSProperties = {
  width: '100%', padding: '3px 6px', background: '#111', border: '1px solid #444',
  color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
}
const NUM: React.CSSProperties = {
  width: 52, padding: '3px 5px', background: '#111', border: '1px solid #444',
  color: '#eee', borderRadius: 3, fontSize: 11,
}
const BTN_DANGER: React.CSSProperties = {
  padding: '2px 7px', background: '#5a1a1a', border: '1px solid #922',
  color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer',
}
const BTN_PICK: React.CSSProperties = {
  padding: '3px 8px', background: '#1e2a4e', border: '1px solid #3a4a8e',
  color: '#8af', borderRadius: 3, fontSize: 10, cursor: 'pointer', marginLeft: 'auto',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: '#888', fontSize: 10, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      {children}
    </div>
  )
}

/** Inline editor for an animal entity in the NPC/animal drawer (mirrors AnimalInspector). */
export function AnimalEditor({ animal, onUpdate, onDelete, onPickLocation }: {
  animal: RawAnimal
  onUpdate: (partial: Partial<RawAnimal>) => void
  onDelete: () => void
  onPickLocation?: () => void
}) {
  const paletteKeys = ANIMAL_SPECS[animal.type as AnimalType]?.palette
    ? Object.keys(ANIMAL_SPECS[animal.type as AnimalType].palette)
    : []

  return (
    <div style={{ padding: '8px 10px 12px', borderLeft: '3px solid #3a6a3a', marginLeft: 4, marginBottom: 6 }}>
      <Field label="ID">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{animal.id}</span>
      </Field>
      <Field label="Type">
        <AnimalTypePicker value={animal.type} onChange={type => onUpdate({ type, variant: undefined })} />
      </Field>
      <Field label="Variant">
        <select value={animal.variant ?? ''} onChange={e => onUpdate({ variant: e.target.value || undefined })} style={INPUT}>
          <option value="">(none)</option>
          {paletteKeys.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </Field>
      <Field label="Name">
        <input style={INPUT} value={animal.name ?? ''} onChange={e => onUpdate({ name: e.target.value || undefined })} />
      </Field>
      <Field label="Dialogue">
        <textarea
          value={(animal.dialogue ?? []).join('\n')}
          onChange={e => onUpdate({ dialogue: e.target.value ? e.target.value.split('\n') : [] })}
          rows={2}
          style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>One line = one dialogue entry</div>
      </Field>
      <Field label="Quest Give">
        <input style={INPUT} value={animal.questGive ?? ''} onChange={e => onUpdate({ questGive: e.target.value || undefined })} />
      </Field>
      <Field label="Quest Receive">
        <input
          style={INPUT}
          value={Array.isArray(animal.questReceive) ? animal.questReceive.join(', ') : (animal.questReceive ?? '')}
          onChange={e => {
            const val = e.target.value.trim()
            const parsed: string | string[] | undefined = val.includes(',')
              ? val.split(',').map(s => s.trim()).filter(Boolean)
              : val || undefined
            onUpdate({ questReceive: parsed })
          }}
        />
      </Field>
      <Field label="Building (interior)">
        <input style={INPUT} value={animal.building ?? ''} placeholder="building ID (optional)"
          onChange={e => onUpdate({ building: e.target.value || undefined })} />
      </Field>
      <Field label="Dialogue Tree (optional)">
        <input style={INPUT} value={animal.dialogueTree ?? ''} placeholder="dialogue tree id (optional)"
          onChange={e => onUpdate({ dialogueTree: e.target.value || undefined })} />
      </Field>
      <Field label="Roam">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
          <input type="checkbox" checked={animal.roam ?? false} onChange={e => onUpdate({ roam: e.target.checked || undefined })} />
          Wanders an area
        </label>
      </Field>
      {animal.roam && (
        <Field label="Wander Area (dx, dy, w, h — offset from this animal)">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['dx', 'dy', 'w', 'h'] as const).map((k, ki) => (
              <input
                key={k}
                type="number"
                value={animal.areaRect?.[ki] ?? 0}
                onChange={e => {
                  const r: [number, number, number, number] = [...(animal.areaRect ?? [0, 0, 0, 0])] as [number, number, number, number]
                  r[ki] = Number(e.target.value)
                  onUpdate({ areaRect: r })
                }}
                style={{ ...NUM, width: 44 }}
                placeholder={k}
              />
            ))}
          </div>
        </Field>
      )}
      <Field label="Location">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ color: '#888', fontSize: 10 }}>X</label>
          <input type="number" style={NUM} value={animal.tx} onChange={e => onUpdate({ tx: Number(e.target.value) })} />
          <label style={{ color: '#888', fontSize: 10 }}>Y</label>
          <input type="number" style={NUM} value={animal.ty} onChange={e => onUpdate({ ty: Number(e.target.value) })} />
          {onPickLocation && <button style={BTN_PICK} onClick={onPickLocation}>📍 Pick on map</button>}
        </div>
      </Field>
      <button style={{ ...BTN_DANGER, width: '100%', padding: '5px 0' }} onClick={onDelete}>Delete Animal</button>
    </div>
  )
}
