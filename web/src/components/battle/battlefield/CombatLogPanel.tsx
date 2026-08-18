import React from 'react'
import { Button } from '../../ui/Button'

type LogTone = 'important' | 'kill' | 'damage' | 'buff' | 'routine'

const MAX_ENTRIES = 40

/** Entries are free-form text from the engine (no structured event type),
 *  so this is a best-effort keyword classifier for colour-coding — not a
 *  source of truth about what actually happened in a tick. */
function classify(entry: string): { tone: LogTone; text: string } {
  if (entry.startsWith('!!')) return { tone: 'important', text: entry.slice(2) }
  const lower = entry.toLowerCase()
  if (lower.includes('destroyed') || lower.includes('crumbles') || lower.includes('collapses')) {
    return { tone: 'kill', text: entry }
  }
  if (lower.includes('damage') || lower.includes('hit for') || lower.includes('blast') || lower.includes('explodes') || lower.includes('erupts')) {
    return { tone: 'damage', text: entry }
  }
  if (lower.includes('heal') || lower.includes('gain') || lower.includes('surge') || lower.includes('upgraded')) {
    return { tone: 'buff', text: entry }
  }
  return { tone: 'routine', text: entry }
}

interface Props {
  entries: string[]
  open: boolean
  onClose: () => void
}

/** Scrollable battle log — colour-codes kills/damage/buffs so the feed is
 *  scannable at a glance, and de-emphasises routine deploy/idle ticks.
 *  Only ever shows the most recent MAX_ENTRIES; state.log itself is
 *  unbounded (used elsewhere for full battle history) but rendering all of
 *  it here would be needless DOM growth over a long match. */
export function CombatLogPanel({ entries, open, onClose }: Props) {
  if (!open) return null
  const recent = entries.slice(-MAX_ENTRIES).reverse()
  return (
    <div className="bf-log-panel">
      <div className="bf-log-panel-header">
        <span>BATTLE LOG</span>
        <Button size="xs" onClick={onClose} aria-label="Close battle log">✕</Button>
      </div>
      <div className="bf-log-panel-list">
        {recent.length === 0
          ? <div className="bf-log-entry bf-log-entry--routine">Nothing has happened yet.</div>
          : recent.map((raw, i) => {
            const { tone, text } = classify(raw)
            return (
              <div key={i} className={`bf-log-entry bf-log-entry--${tone}`}>{text}</div>
            )
          })}
      </div>
    </div>
  )
}
