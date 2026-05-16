import React, { useState, useEffect } from 'react'
import { UselessItem, loadInventory, _inventorySyncCheck } from '../../game/dailyLogin'
import { saveCrystals, loadCrystals } from '../../game/collection'
import { loadEarnedRelics, getRelicDef, RelicDef } from '../../game/relics'
import { loadConsumableStash, loadRunConsumables, ALL_CONSUMABLES, ConsumableDef } from '../../game/questline'
import { loadItemStore } from '../../game/itemStore'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Section } from '../ui/Section'

interface Props {
  onBack: () => void
  onCrystalsChanged: (n: number) => void
}

type DetailEntry =
  | { kind: 'item'; item: UselessItem }
  | { kind: 'relic'; relic: RelicDef; isActive: boolean }

function buildMergedConsumables() {
  const storeEntries = loadItemStore().filter(e => e.type === 'consumable')
  const merged = [...loadRunConsumables()]
  for (const s of loadConsumableStash()) {
    const existing = merged.find(c => c.id === s.id)
    if (existing) existing.count += s.count
    else merged.push({ ...s })
  }
  return merged
    .filter(rc => rc.count > 0)
    .map(rc => {
      const def = ALL_CONSUMABLES.find(c => c.id === rc.id)
      if (def) return { def, count: rc.count }
      // Fall back to display fields stored inline in the item store (e.g. arcade tickets)
      const storeEntry = storeEntries.find(e => e.id === rc.id)
      if (storeEntry?.name && storeEntry?.icon) {
        const syntheticDef: ConsumableDef = {
          id: storeEntry.id,
          name: storeEntry.name,
          icon: storeEntry.icon,
          desc: storeEntry.desc ?? '',
          lore: '',
          price: 0,
        }
        return { def: syntheticDef, count: rc.count }
      }
      return null
    })
    .filter((x): x is { def: ConsumableDef; count: number } => x !== null)
}

export function InventoryScreen({ onBack, onCrystalsChanged }: Props) {
  const [items, setItems] = useState<UselessItem[]>(loadInventory)
  const [ownedConsumables, setOwnedConsumables] = useState<{ def: typeof ALL_CONSUMABLES[0]; count: number }[]>(buildMergedConsumables)
  const [secretMsg, setSecretMsg] = useState<string | null>(null)
  const [secretClaimed, setSecretClaimed] = useState(false)
  const [detail, setDetail] = useState<DetailEntry | null>(null)

  // Refresh consumables on every mount to pick up purchases made on other screens
  useEffect(() => {
    setOwnedConsumables(buildMergedConsumables())
  }, [])

  const earnedRelicNames = loadEarnedRelics()
  const earnedRelics = earnedRelicNames
    .map(name => getRelicDef(name))
    .filter((r): r is RelicDef => !!r)

  // ── inventory sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const payload = _inventorySyncCheck(items)
    if (payload && !secretClaimed) {
      setSecretMsg(payload.msg)
    }
  }, [items, secretClaimed])

  function claimSecret() {
    const payload = _inventorySyncCheck(items)
    if (!payload) return
    const next = loadCrystals() + payload.crystals
    saveCrystals(next)
    onCrystalsChanged(next)
    setSecretClaimed(true)
    setSecretMsg(null)
  }

  return (
    <OverlayScreen title="INVENTORY" onBack={onBack} right={<span className="inventory-count">{items.length} items</span>}>

      <div className="inventory-body u-grow u-col u-gap-4">
        <div className="inventory-intro">
          Items collected from daily logins. Completely useless.
          <br/>
          <span className="inventory-intro-small">
            But... who knows. Keep collecting.
          </span>
        </div>

        {/* Secret panel — appears at 42 items */}
        {secretMsg && (
          <div className="inventory-secret-panel">
            <div className="inventory-secret-icon">🌌</div>
            <div className="inventory-secret-title">DEEP THOUGHT SPEAKS</div>
            <div className="inventory-secret-msg">"{secretMsg}"</div>
            <button className="action-btn action-btn--gold" onClick={claimSecret}>
              CLAIM REWARD
            </button>
          </div>
        )}

        {ownedConsumables.length > 0 && (
          <Section title="CONSUMABLES">
            <div className="inventory-grid u-flex u-wrap u-gap-4 u-just-c u-grow">
              {ownedConsumables.map((entry: { def: ConsumableDef; count: number }) => {
                const { def, count } = entry
                return (
                  <div key={def.id} className="inventory-cell">
                    <div className="inventory-item-icon">{def.icon}</div>
                    <div className="inventory-item-name">{def.name}</div>
                    <div className="inventory-item-desc">{def.desc}</div>
                    <div className="inventory-item-count">×{count}</div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {earnedRelics.length > 0 && (
          <Section title="RELICS">
            <div className="inventory-grid u-flex u-wrap u-gap-4 u-just-c u-grow">
              {earnedRelics.map(relic => (
                <button
                  key={relic.name}
                  className="inventory-cell inventory-cell--relic"
                  onClick={() => setDetail({ kind: 'relic', relic, isActive: false })}
                >
                  <div className="inventory-item-icon">{relic.icon}</div>
                  <div className="inventory-item-name">{relic.name}</div>
                  <div className="inventory-item-desc">{relic.desc}</div>
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section title={earnedRelics.length > 0 ? 'ITEMS' : ''}>
          {items.length === 0 ? (
            <div className="inventory-empty u-grow u-flex u-items-c u-just-c">
              Nothing here yet. Come back tomorrow.
            </div>
          ) : (
            <div className="inventory-grid u-flex u-wrap u-gap-4 u-just-c u-grow">
              {items.map((item, idx) => (
                <button
                  key={idx}
                  className="inventory-cell"
                  onClick={() => setDetail({ kind: 'item', item })}
                >
                  <div className="inventory-item-icon">{item.icon}</div>
                  <div className="inventory-item-name">{item.name}</div>
                  <div className="inventory-item-desc">{item.desc}</div>
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ── Detail modal ── */}
      {detail && (
        <div className="inventory-detail-backdrop" onClick={() => setDetail(null)}>
          <div className="inventory-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="inventory-detail-icon">
              {detail.kind === 'item' ? detail.item.icon : detail.relic.icon}
            </div>
            <div className="inventory-detail-name">
              {detail.kind === 'item' ? detail.item.name : detail.relic.name}
            </div>
            {detail.kind === 'relic' && (
              <div className="inventory-detail-tag">RELIC</div>
            )}
            {detail.kind === 'item' && detail.item.id.startsWith('broken-relic-') && (
              <div className="inventory-detail-tag inventory-detail-tag--broken">BROKEN RELIC</div>
            )}
            <div className="inventory-detail-desc">
              {detail.kind === 'item' ? detail.item.desc : detail.relic.desc}
            </div>
            {detail.kind === 'item' && detail.item.lore && (
              <div className="inventory-detail-desc">
                {detail.item.lore}
              </div>
            )}
            {detail.kind === 'item' && (
              <div className="inventory-detail-date">
                Acquired: {detail.item.acquiredDate}
              </div>
            )}
            <button className="action-btn" onClick={() => setDetail(null)}>CLOSE</button>
          </div>
        </div>
      )}
    </OverlayScreen>
  )
}
