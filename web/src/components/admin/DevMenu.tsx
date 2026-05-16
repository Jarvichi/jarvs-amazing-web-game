import React, { useState, useEffect } from 'react'
import { Section } from '../BuildingBlocks/Section'
import { ALL_RARE_EVENTS, RareEventKind } from '../rare-events/types'
import { loadDevConfig, patchDevConfig, clearDevConfig } from '../../game/devStore'
import { getCardCatalog } from '../../game/cards'
import { addCardsToCollection, loadCollection, CollectionEntry } from '../../game/collection'
import { MAX_HANDICAP } from '../../game/engine'
import { ACTS } from '../../game/questline'
import { logError } from '../../logger'
import { getAllGifts, loadClaimedGiftIds, resetClaimedGifts, GiftDef } from '../../game/gifts'

const CRYSTALS_KEY = 'jarv_crystals'
const RUN_KEY      = 'jarv_run'

interface Props {
  onCrystalsChanged: (n: number) => void
  onHandicapChanged: (n: number) => void
}

const RARE_EVENT_LABELS: Record<RareEventKind, string> = {
  blackjack:       'Blackjack',
  fakeCrash:       'Fake Crash',
  wrongNumber:     'Wrong Number',
  narrator:        'Narrator',
  liarsDice:       "Liar's Dice",
  gambler:         'The Gambler',
  devBuild:        'Dev Build',
  glitchedCard:    'Glitched Card',
  confusedTourist: 'Confused Tourist',
}

export function DevMenu({ onCrystalsChanged, onHandicapChanged }: Props) {
  const [config,      setConfig]      = useState(loadDevConfig)
  const [crystalAmt,  setCrystalAmt]  = useState(100)
  const [handicapVal, setHandicapVal] = useState(0)
  const [msg,         setMsg]         = useState<string | null>(null)

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(null), 3000)
  }

  function handleForceRareEvent(kind: RareEventKind | '') {
    const next = patchDevConfig({ forcedRareEvent: kind === '' ? null : kind })
    setConfig(next)
    flash(kind === '' ? 'Rare event override cleared.' : `Next battle will trigger: ${RARE_EVENT_LABELS[kind]}`)
  }

  function handleAddCrystals() {
    try {
      const current = parseInt(localStorage.getItem(CRYSTALS_KEY) ?? '0', 10) || 0
      const next    = current + crystalAmt
      localStorage.setItem(CRYSTALS_KEY, String(next))
      onCrystalsChanged(next)
      flash(`+${crystalAmt} crystals added (total: ${next})`)
    } catch (e) {
      logError('DevMenu: addCrystals failed', { error: String(e) })
      flash('Failed to add crystals.')
    }
  }

  function handleSetHandicap() {
    const clamped = Math.max(0, Math.min(MAX_HANDICAP, handicapVal))
    onHandicapChanged(clamped)
    flash(`Handicap set to ${clamped}`)
  }

  function handleGrantAllCards() {
    try {
      const catalog    = getCardCatalog()
      const collection = loadCollection()
      const owned      = new Set(collection.map(e => e.cardName))
      const toAdd: CollectionEntry[] = catalog
        .filter(c => !owned.has(c.name))
        .map(c => ({ cardName: c.name, count: 1 }))
      if (toAdd.length === 0) {
        flash('Already own all cards.')
        return
      }
      addCardsToCollection(toAdd)
      flash(`Granted ${toAdd.length} missing cards.`)
    } catch (e) {
      logError('DevMenu: grantAllCards failed', { error: String(e) })
      flash('Failed to grant cards.')
    }
  }

  function handleSkipToAct(actId: string) {
    if (!actId) return
    try {
      const act       = ACTS[actId]
      const firstNode = Object.keys(act.nodes)[0]
      const run = {
        actId,
        nodeHistory:      [],
        completedNodeIds: [],
        pendingNodeId:    firstNode,
        livesRemaining:   3,
        maxLives:         3,
        activeRelic:      null,
        activeModifierCount: 0,
      }
      localStorage.setItem(RUN_KEY, JSON.stringify(run))
      flash(`Run set to start of ${act.title ?? actId}. Go to Campaign to begin.`)
    } catch (e) {
      logError('DevMenu: skipToAct failed', { error: String(e) })
      flash('Failed to set act.')
    }
  }

  function handleClearConfig() {
    clearDevConfig()
    setConfig(loadDevConfig())
    flash('Dev config cleared.')
  }

  return (
    <Section bordered title="DEV TOOLS">
      <div className="settings-row u-flex u-items-c u-just-sb u-gap-7" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <div className="settings-label" style={{ color: '#ff5555' }}>
          ⚠ Dev mode active — run in incognito to protect your save
        </div>
      </div>

      {/* Force rare event */}
      <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
        <div>
          <div className="settings-label">Force rare event</div>
          <div className="settings-sublabel">Triggers at 100% on the next battle</div>
        </div>
        <select
          className="settings-select"
          value={config.forcedRareEvent ?? ''}
          onChange={e => handleForceRareEvent(e.target.value as RareEventKind | '')}
        >
          <option value="">— none —</option>
          {ALL_RARE_EVENTS.map(kind => (
            <option key={kind} value={kind}>{RARE_EVENT_LABELS[kind]}</option>
          ))}
        </select>
      </div>

      {/* Add crystals */}
      <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
        <div>
          <div className="settings-label">Add crystals</div>
          <div className="settings-sublabel">Instantly added to current balance</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="number"
            className="settings-number-input"
            min={1}
            max={9999}
            value={crystalAmt}
            onChange={e => setCrystalAmt(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
          <button className="action-btn action-btn--gold" onClick={handleAddCrystals}>ADD</button>
        </div>
      </div>

      {/* Set handicap */}
      <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
        <div>
          <div className="settings-label">Set handicap</div>
          <div className="settings-sublabel">0 = full strength, {MAX_HANDICAP} = easiest</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="number"
            className="settings-number-input"
            min={0}
            max={MAX_HANDICAP}
            value={handicapVal}
            onChange={e => setHandicapVal(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
          <button className="action-btn" onClick={handleSetHandicap}>SET</button>
        </div>
      </div>

      {/* Grant all cards */}
      <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
        <div>
          <div className="settings-label">Grant all cards</div>
          <div className="settings-sublabel">Adds one copy of every missing card to collection</div>
        </div>
        <button className="action-btn action-btn--gold" onClick={handleGrantAllCards}>GRANT</button>
      </div>

      {/* Skip to act */}
      <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
        <div>
          <div className="settings-label">Skip to act</div>
          <div className="settings-sublabel">Overwrites active run — go to Campaign to begin</div>
        </div>
        <select
          className="settings-select"
          defaultValue=""
          onChange={e => handleSkipToAct(e.target.value)}
        >
          <option value="">— choose —</option>
          {Object.entries(ACTS).map(([id, act]) => (
            <option key={id} value={id}>{act.title ?? id}</option>
          ))}
        </select>
      </div>

      {/* Clear dev config */}
      <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
        <div>
          <div className="settings-label">Clear dev config</div>
          <div className="settings-sublabel">Removes all forced overrides from jarv_dev_config</div>
        </div>
        <button className="action-btn action-btn--danger" onClick={handleClearConfig}>CLEAR</button>
      </div>

      {/* Gift registry */}
      <GiftAdmin onFlash={flash} />

      {msg && (
        <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
          <div className="settings-sublabel" style={{ color: '#33ff33' }}>{msg}</div>
        </div>
      )}
    </Section>
  )
}

// ── Gift Admin sub-component ──────────────────────────────────────────────────

function GiftAdmin({ onFlash }: { onFlash: (msg: string) => void }) {
  const [gifts,   setGifts]   = useState<GiftDef[]>([])
  const [loading, setLoading] = useState(true)
  const claimed = new Set(loadClaimedGiftIds())

  useEffect(() => {
    getAllGifts()
      .then(g => { setGifts(g); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleResetClaims() {
    resetClaimedGifts()
    onFlash('Gift claims reset — gifts will reappear on next page load.')
  }

  return (
    <>
      <div className="settings-row u-flex u-items-c u-just-sb u-gap-7" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="settings-label">Gift registry</div>
        <div className="settings-sublabel">
          Add gifts via the Firestore console — collection: <code>gifts</code>, document ID = gift ID.
          Falls back to <code>gifts.json</code> if Firestore is unavailable.
        </div>
      </div>

      {loading ? (
        <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
          <div className="settings-sublabel">Loading…</div>
        </div>
      ) : gifts.length === 0 ? (
        <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
          <div className="settings-sublabel">No gifts defined.</div>
        </div>
      ) : (
        gifts.map(g => (
          <div key={g.id} className="settings-row u-flex u-items-c u-just-sb u-gap-7" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
            <div className="settings-label" style={{ fontSize: '11px' }}>
              {claimed.has(g.id) ? '✓' : '○'} <strong>{g.name}</strong> <span style={{ opacity: 0.5 }}>({g.id})</span>
            </div>
            <div className="settings-sublabel">{g.rewards.length} reward(s) · created {g.createdAt}{g.fromDate ? ` · from ${g.fromDate}` : ''}{g.expiresAt ? ` · expires ${g.expiresAt}` : ''}</div>
          </div>
        ))
      )}

      <div className="settings-row u-flex u-items-c u-just-sb u-gap-7">
        <div>
          <div className="settings-label">Reset gift claims</div>
          <div className="settings-sublabel">Clears jarv_claimed_gifts — gifts will reappear on next load</div>
        </div>
        <button className="action-btn action-btn--danger" onClick={handleResetClaims}>RESET</button>
      </div>
    </>
  )
}
