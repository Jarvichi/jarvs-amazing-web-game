import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { RefOption } from './entityRefs'

const FIELD: React.CSSProperties = {
  width: '100%', padding: '3px 6px', background: '#111', border: '1px solid #444',
  color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
}

function labelFor(options: RefOption[], value: string): string | undefined {
  return options.find(o => o.value === value)?.label
}

/**
 * Searchable dropdown for picking an entity id (npc / building / quest / pickup
 * / interior …). Options carry an optional `group` (town) for cross-town refs.
 * Shows the resolved label for the current value; unknown values still round-trip
 * (rendered as "(custom)") and can be entered when `allowFreeText`.
 */
export function EntityRefPicker({
  value, onChange, options, placeholder = 'Search…', allowFreeText = true,
}: {
  value: string
  onChange: (value: string) => void
  options: RefOption[]
  placeholder?: string
  allowFreeText?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? options.filter(o => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q) || (o.group ?? '').toLowerCase().includes(q)) : options
    return list.slice(0, 200)
  }, [search, options])

  const resolved = labelFor(options, value)
  const pick = (v: string) => { onChange(v); setOpen(false); setSearch('') }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)} style={{ ...FIELD, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? '#eee' : '#666' }}>
          {value ? (resolved ?? `${value} (custom)`) : placeholder}
        </span>
        <span style={{ fontSize: 10, color: '#666' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', zIndex: 50, left: 0, right: 0, marginTop: 2, background: '#0e0e1a', border: '1px solid #555', borderRadius: 4, padding: 6 }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder} style={{ ...FIELD, marginBottom: 4 }} />
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <button onClick={() => pick('')} style={optStyle(value === '')}>— none —</button>
            {filtered.map(o => (
              <button key={(o.group ?? '') + o.value} title={o.value} onClick={() => pick(o.value)} style={optStyle(o.value === value)}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {o.group && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#7af', flexShrink: 0, paddingLeft: 6 }}>{o.group}</span>}
              </button>
            ))}
            {filtered.length === 0 && <span style={{ color: '#666', fontSize: 10, padding: 4 }}>No matches</span>}
          </div>
          {allowFreeText && search.trim() && !options.some(o => o.value === search.trim()) && (
            <button onClick={() => pick(search.trim())} style={{ marginTop: 4, fontSize: 10, color: '#8af', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              Use custom id "{search.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function optStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
    padding: '3px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3,
    background: active ? '#2a4a7a' : 'transparent',
    border: active ? '1px solid #5a8aee' : '1px solid transparent',
    color: '#ccc',
  }
}

function swapItems<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Multi-select variant — manages an ordered list of ids (used for pickupIds,
 *  and for an NPC's conversationTopics where display order is meaningful).
 *  `reorderable` adds ↑/↓ buttons that swap adjacent entries in place. */
export function EntityRefMultiPicker({
  values, onChange, options, placeholder = 'Add id…', reorderable = false,
}: {
  values: string[]
  onChange: (values: string[]) => void
  options: RefOption[]
  placeholder?: string
  reorderable?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {reorderable && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button disabled={i === 0} onClick={() => onChange(swapItems(values, i, i - 1))} title="Move up"
                style={{ ...reorderBtnStyle, opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'default' : 'pointer' }}>↑</button>
              <button disabled={i === values.length - 1} onClick={() => onChange(swapItems(values, i, i + 1))} title="Move down"
                style={{ ...reorderBtnStyle, opacity: i === values.length - 1 ? 0.3 : 1, cursor: i === values.length - 1 ? 'default' : 'pointer' }}>↓</button>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <EntityRefPicker value={v} options={options} onChange={nv => onChange(values.map((x, j) => j === i ? nv : x))} placeholder={placeholder} />
          </div>
          <button onClick={() => onChange(values.filter((_, j) => j !== i))}
            style={{ padding: '1px 6px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}>✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...values, ''])}
        style={{ padding: '2px 8px', background: '#1e2e1e', border: '1px solid #3a5a3a', color: '#6d6', borderRadius: 3, fontSize: 10, cursor: 'pointer', alignSelf: 'flex-start' }}>+ Add</button>
    </div>
  )
}

const reorderBtnStyle: React.CSSProperties = {
  padding: '0 4px', background: '#1a1a2a', border: '1px solid #444', color: '#aaa', borderRadius: 2, fontSize: 9, lineHeight: '14px',
}
