import React, { useState, useEffect } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Section } from '../ui/Section'
import {
  GiftDef, GiftReward, GiftRewardType,
  getAllGifts, saveGiftToFirestore, deleteGiftFromFirestore,
} from '../../game/gifts'
import { getCardCatalog } from '../../game/cards'
import consumablesData from '../../data/consumables.json'

interface Props {
  onBack: () => void
}

interface ConsumableDef { id: string; name: string }
const CONSUMABLES = consumablesData as ConsumableDef[]

function blankReward(): GiftReward {
  return { type: 'crystals', amount: 100 }
}

function RewardRow({
  reward,
  onChange,
  onRemove,
}: {
  reward: GiftReward
  onChange: (r: GiftReward) => void
  onRemove: () => void
}) {
  const catalog = getCardCatalog()

  function setType(type: GiftRewardType) {
    const base: GiftReward = { type }
    if (type === 'crystals') base.amount = 100
    if (type === 'pack')     base.count  = 5
    if (type === 'card')     base.cardName = catalog[0]?.name ?? ''
    if (type === 'consumable') { base.consumableId = CONSUMABLES[0]?.id ?? ''; base.consumableCount = 1 }
    if (type === 'item')     base.itemId = ''
    onChange(base)
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <select
        className="settings-select"
        value={reward.type}
        onChange={e => setType(e.target.value as GiftRewardType)}
      >
        <option value="crystals">Crystals</option>
        <option value="card">Card</option>
        <option value="pack">Pack</option>
        <option value="consumable">Consumable</option>
        <option value="item">Item</option>
      </select>

      {reward.type === 'crystals' && (
        <input
          type="number" min={1} max={99999}
          className="settings-number-input"
          style={{ width: '80px' }}
          value={reward.amount ?? 100}
          onChange={e => onChange({ ...reward, amount: Math.max(1, parseInt(e.target.value) || 1) })}
        />
      )}

      {reward.type === 'card' && (
        <select
          className="settings-select"
          value={reward.cardName ?? ''}
          onChange={e => onChange({ ...reward, cardName: e.target.value })}
        >
          {catalog.map(c => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      )}

      {reward.type === 'pack' && (
        <input
          type="number" min={1} max={20}
          className="settings-number-input"
          style={{ width: '60px' }}
          value={reward.count ?? 5}
          onChange={e => onChange({ ...reward, count: Math.max(1, parseInt(e.target.value) || 1) })}
        />
      )}

      {reward.type === 'consumable' && (
        <>
          <select
            className="settings-select"
            value={reward.consumableId ?? ''}
            onChange={e => onChange({ ...reward, consumableId: e.target.value })}
          >
            {CONSUMABLES.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="number" min={1} max={99}
            className="settings-number-input"
            style={{ width: '50px' }}
            value={reward.consumableCount ?? 1}
            onChange={e => onChange({ ...reward, consumableCount: Math.max(1, parseInt(e.target.value) || 1) })}
          />
        </>
      )}

      {reward.type === 'item' && (
        <input
          type="text"
          className="settings-number-input"
          style={{ width: '120px' }}
          placeholder="item id"
          value={reward.itemId ?? ''}
          onChange={e => onChange({ ...reward, itemId: e.target.value })}
        />
      )}

      <button className="action-btn action-btn--danger" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={onRemove}>✕</button>
    </div>
  )
}

export function GiftAdminScreen({ onBack }: Props) {
  const [gifts,   setGifts]   = useState<GiftDef[]>([])
  const [loading, setLoading] = useState(true)
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null)

  // New gift form state
  const [id,          setId]          = useState('')
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [fromDate,    setFromDate]    = useState('')
  const [expiresAt,   setExpiresAt]   = useState('')
  const [rewards,     setRewards]     = useState<GiftReward[]>([blankReward()])
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    getAllGifts().then(g => { setGifts(g); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleCreate() {
    if (!id.trim() || !name.trim() || rewards.length === 0) {
      flash('ID, name and at least one reward are required.', false)
      return
    }
    setSaving(true)
    try {
      const gift: GiftDef = {
        id:          id.trim(),
        name:        name.trim(),
        description: description.trim(),
        createdAt:   new Date().toISOString().slice(0, 10),
        rewards,
        ...(fromDate  ? { fromDate }  : {}),
        ...(expiresAt ? { expiresAt } : {}),
      }
      await saveGiftToFirestore(gift)
      setGifts(prev => {
        const without = prev.filter(g => g.id !== gift.id)
        return [gift, ...without]
      })
      setId(''); setName(''); setDescription(''); setFromDate(''); setExpiresAt(''); setRewards([blankReward()])
      flash(`Gift "${gift.name}" saved.`)
    } catch (e) {
      flash(`Save failed: ${String(e)}`, false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(gift: GiftDef) {
    try {
      await deleteGiftFromFirestore(gift.id)
      setGifts(prev => prev.filter(g => g.id !== gift.id))
      flash(`Deleted "${gift.name}".`)
    } catch (e) {
      flash(`Delete failed: ${String(e)}`, false)
    }
  }

  function updateReward(i: number, r: GiftReward) {
    setRewards(prev => prev.map((x, idx) => idx === i ? r : x))
  }

  function removeReward(i: number) {
    setRewards(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <OverlayScreen title="GIFT ADMIN" onBack={onBack} className="settings-screen u-col u-grow">
      <div className="settings-body u-col u-gap-3 u-grow">

        {/* Existing gifts */}
        <Section bordered title="ACTIVE GIFTS">
          {loading ? (
            <div className="settings-row u-flex u-items-c u-just-sb u-gap-7"><div className="settings-sublabel">Loading…</div></div>
          ) : gifts.length === 0 ? (
            <div className="settings-row u-flex u-items-c u-just-sb u-gap-7"><div className="settings-sublabel">No gifts yet.</div></div>
          ) : gifts.map(g => (
            <div key={g.id} className="settings-row u-flex u-items-c u-just-sb u-gap-7" style={{ alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div className="settings-label">🎁 {g.name} <span style={{ opacity: 0.5, fontSize: '10px' }}>({g.id})</span></div>
                <div className="settings-sublabel">{g.description}</div>
                <div className="settings-sublabel">
                  {g.rewards.length} reward(s) · created {g.createdAt}
                  {g.fromDate  ? ` · from ${g.fromDate}`     : ''}
                  {g.expiresAt ? ` · expires ${g.expiresAt}` : ''}
                </div>
                <div className="settings-sublabel" style={{ color: '#ffcc00' }}>
                  {g.rewards.map((r, i) => {
                    if (r.type === 'crystals')   return `💎 ${r.amount} crystals`
                    if (r.type === 'card')        return `🃏 ${r.cardName}`
                    if (r.type === 'pack')        return `📦 Pack (${r.count ?? 5} cards)`
                    if (r.type === 'consumable') return `🧪 ${r.consumableId} ×${r.consumableCount ?? 1}`
                    if (r.type === 'item')        return `🎒 ${r.itemId}`
                    return ''
                  }).join('  ·  ')}
                </div>
              </div>
              <button
                className="action-btn action-btn--danger"
                style={{ fontSize: '11px', padding: '4px 10px', flexShrink: 0 }}
                onClick={() => handleDelete(g)}
              >
                DELETE
              </button>
            </div>
          ))}
        </Section>

        {/* Create new gift */}
        <Section bordered title="CREATE GIFT">
          <div className="settings-row u-flex u-items-c u-just-sb u-gap-7" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', width: '100%' }}>

            <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <div className="settings-sublabel" style={{ marginBottom: '4px' }}>Gift ID (unique, no spaces)</div>
                <input
                  type="text"
                  className="settings-number-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. gift_easter_2026"
                  value={id}
                  onChange={e => setId(e.target.value.replace(/\s/g, '_'))}
                />
              </div>
              <div style={{ flex: 2, minWidth: '160px' }}>
                <div className="settings-sublabel" style={{ marginBottom: '4px' }}>Name</div>
                <input
                  type="text"
                  className="settings-number-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. Easter Surprise"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <div className="settings-sublabel" style={{ marginBottom: '4px' }}>Description (shown to players)</div>
              <input
                type="text"
                className="settings-number-input"
                style={{ width: '100%' }}
                placeholder="A gift to celebrate…"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ width: '160px' }}>
                <div className="settings-sublabel" style={{ marginBottom: '4px' }}>From date (optional)</div>
                <input
                  type="date"
                  className="settings-number-input"
                  style={{ width: '100%' }}
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div style={{ width: '160px' }}>
                <div className="settings-sublabel" style={{ marginBottom: '4px' }}>Expires (optional)</div>
                <input
                  type="date"
                  className="settings-number-input"
                  style={{ width: '100%' }}
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <div className="settings-sublabel" style={{ marginBottom: '4px' }}>Rewards</div>
              {rewards.map((r, i) => (
                <RewardRow
                  key={i}
                  reward={r}
                  onChange={updated => updateReward(i, updated)}
                  onRemove={() => removeReward(i)}
                />
              ))}
              <button
                className="action-btn"
                style={{ marginTop: '8px', fontSize: '11px', padding: '4px 12px' }}
                onClick={() => setRewards(prev => [...prev, blankReward()])}
              >
                + ADD REWARD
              </button>
            </div>

            <button
              className="action-btn action-btn--gold"
              style={{ marginTop: '4px' }}
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? 'SAVING…' : 'CREATE GIFT'}
            </button>
          </div>
        </Section>

        {msg && (
          <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
            <div className="settings-sublabel" style={{ color: msg.ok ? '#33ff33' : '#ff5555' }}>
              {msg.text}
            </div>
          </div>
        )}

      </div>
    </OverlayScreen>
  )
}
