import React, { useState } from 'react'
import { UselessItem, loadInventory } from '../../game/dailyLogin'
import { loadEarnedRelics, getRelicDef, RelicDef } from '../../game/relics'
import { OverlayScreen } from '../ui/OverlayScreen'

interface Props {
  onBack: () => void
}

type ShelfEntry =
  | { kind: 'item';  item: UselessItem }
  | { kind: 'relic'; relic: RelicDef }

const SLOTS_PER_ROW = 6

/** Pads a list of entries to a full number of rows, filling the remainder with empty slots. */
function buildRows(entries: ShelfEntry[], minRows = 0): Array<Array<ShelfEntry | null>> {
  const minSlots = Math.max(SLOTS_PER_ROW * minRows, Math.ceil(entries.length / SLOTS_PER_ROW) * SLOTS_PER_ROW)
  const slots: Array<ShelfEntry | null> = [
    ...entries,
    ...Array(minSlots - entries.length).fill(null),
  ]
  const rows: Array<Array<ShelfEntry | null>> = []
  for (let i = 0; i < slots.length; i += SLOTS_PER_ROW)
    rows.push(slots.slice(i, i + SLOTS_PER_ROW))
  return rows
}

export function HomeShelf({ onBack }: Props) {
  const items  = loadInventory()
  const relics = loadEarnedRelics()
    .map(name => getRelicDef(name))
    .filter((r): r is RelicDef => !!r)

  const relicEntries:    ShelfEntry[] = relics.map(r => ({ kind: 'relic' as const, relic: r }))
  const keepsakeEntries: ShelfEntry[] = items.filter(i => i.isKeepsake).map(i => ({ kind: 'item' as const, item: i }))
  const junkEntries:     ShelfEntry[] = items.filter(i => !i.isKeepsake).map(i => ({ kind: 'item' as const, item: i }))

  const isEmpty = relicEntries.length === 0 && keepsakeEntries.length === 0 && junkEntries.length === 0

  const sections: Array<{ label: string; rows: Array<Array<ShelfEntry | null>> }> = isEmpty
    ? [{ label: '', rows: buildRows([], 3) }]
    : [
        { label: 'RELICS',       rows: buildRows(relicEntries) },
        { label: 'KEEPSAKES',    rows: buildRows(keepsakeEntries) },
        { label: 'ODDS & ENDS',  rows: buildRows(junkEntries) },
      ].filter(s => s.rows.length > 0)

  const [detail, setDetail] = useState<ShelfEntry | null>(null)

  return (
    <OverlayScreen title="HOME" onBack={onBack}>
      <div className="shelf-room">
        {isEmpty && (
          <div className="shelf-empty-msg">Your shelves are bare. Collect items to fill them.</div>
        )}
        {sections.map((section, sectioni) => (
          <div key={sectioni}>
            {section.label && <div className="shelf-section-label">{section.label}</div>}
            {section.rows.map((row, ri) => (
              <div key={ri} className="shelf-row">
                <div className="shelf-items">
                  {row.map((entry, si) => (
                    <button
                      key={si}
                      className={`shelf-slot${entry ? ' shelf-slot--filled' : ' shelf-slot--empty'}`}
                      onClick={() => entry && setDetail(entry)}
                      disabled={!entry}
                      aria-label={entry ? (entry.kind === 'item' ? entry.item.name : entry.relic.name) : 'Empty slot'}
                    >
                      {entry ? (
                        <>
                          <span className="shelf-slot-icon">
                            {entry.kind === 'item' ? entry.item.icon : entry.relic.icon}
                          </span>
                          <span className="shelf-slot-name">
                            {entry.kind === 'item' ? entry.item.name : entry.relic.name}
                          </span>
                        </>
                      ) : (
                        <span className="shelf-slot-dust" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="shelf-plank" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {detail && (
        <div className="shelf-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="shelf-modal" onClick={e => e.stopPropagation()}>
            <div className="shelf-modal-icon">
              {detail.kind === 'item' ? detail.item.icon : detail.relic.icon}
            </div>
            <div className="shelf-modal-name">
              {detail.kind === 'item' ? detail.item.name : detail.relic.name}
            </div>
            {detail.kind === 'relic' && (
              <div className="shelf-modal-tag">RELIC</div>
            )}
            {detail.kind === 'item' && detail.item.id.startsWith('broken-relic-') && (
              <div className="shelf-modal-tag shelf-modal-tag--broken">BROKEN RELIC</div>
            )}
            <div className="shelf-modal-desc">
              {detail.kind === 'item' ? detail.item.desc : detail.relic.desc}
            </div>
            {detail.kind === 'item' && detail.item.lore && (
              <div className="shelf-modal-lore">"{detail.item.lore}"</div>
            )}
            {detail.kind === 'item' && detail.item.acquiredDate && (
              <div className="shelf-modal-date">Acquired: {detail.item.acquiredDate}</div>
            )}
            <button className="action-btn" onClick={() => setDetail(null)}>CLOSE</button>
          </div>
        </div>
      )}
    </OverlayScreen>
  )
}
