import React, { useState, useEffect } from 'react'
import { UselessItem, loadInventory, _inventorySyncCheck } from '../game/dailyLogin'
import { saveCrystals, loadCrystals } from '../game/collection'
import { loadEarnedRelics, getRelicDef, RelicDef } from '../game/relics'
import { OverlayScreen } from './OverlayScreen'
import { Section } from './Section'

interface Props {
  onBack: () => void
  onCrystalsChanged: (n: number) => void
}

type DetailEntry =
  | { kind: 'item'; item: UselessItem }
  | { kind: 'relic'; relic: RelicDef; isActive: boolean }

export function InventoryScreen({ onBack, onCrystalsChanged }: Props) {
  const [items, setItems] = useState<UselessItem[]>(loadInventory)
  const [secretMsg, setSecretMsg] = useState<string | null>(null)
  const [secretClaimed, setSecretClaimed] = useState(false)
  const [detail, setDetail] = useState<DetailEntry | null>(null)

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

      <div className="inventory-body">
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

        {earnedRelics.length > 0 && (
          <Section title="RELICS">
            <div className="inventory-grid">
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
            <div className="inventory-empty">
              Nothing here yet. Come back tomorrow.
            </div>
          ) : (
            <div className="inventory-grid">
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
            <div className="inventory-detail-desc">
              {detail.kind === 'item' ? detail.item.desc : detail.relic.desc}
            </div>
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
