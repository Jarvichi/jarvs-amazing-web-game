import React, { useState, useMemo } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import {
  getCodexCards, getCodexRelics, getCodexWorld,
  CodexCardEntry, CodexRelicEntry, CodexWorldEntry,
} from '../../game/codex'

type CodexTab = 'cards' | 'relics' | 'world'
type CardTypeFilter = 'all' | 'unit' | 'structure' | 'upgrade'

const RARITY_ORDER: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, epic: 4,
  legendary: 5, mythic: 6, shiny: 7, holofoil: 8, glass: 9,
}

const RARITY_COLORS: Record<string, string> = {
  common:    '#55cc55',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  epic:      '#ff8844',
  legendary: '#ffcc00',
  mythic:    '#e040fb',
  shiny:     '#ffe066',
  holofoil:  '#40e0d0',
  glass:     '#a0d8ef',
}

interface Props {
  onDone: () => void
}

function CardLorePanel({ card }: { card: CodexCardEntry }) {
  if (!card.unlocked) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name">??? — {card.cardType}</div>
        <div className="codex-entry-locked-hint">Discover this card to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name" style={{ color: RARITY_COLORS[card.rarity] ?? '#aaffaa' }}>
          {card.name}
        </span>
        <span className="codex-entry-tag">{card.rarity.toUpperCase()}</span>
        <span className="codex-entry-tag">{card.cardType.toUpperCase()}</span>
      </div>
      <div className="codex-entry-desc">{card.description}</div>
      {card.lore && <div className="codex-entry-lore">"{card.lore}"</div>}
    </div>
  )
}

function RelicLorePanel({ relic }: { relic: CodexRelicEntry }) {
  if (!relic.unlocked) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name">{relic.icon} ???</div>
        <div className="codex-entry-locked-hint">Earn this relic to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name">{relic.icon} {relic.name}</span>
      </div>
      <div className="codex-entry-desc">{relic.desc}</div>
      {relic.lore && <div className="codex-entry-lore">"{relic.lore}"</div>}
    </div>
  )
}

function WorldLorePanel({ entry }: { entry: CodexWorldEntry }) {
  if (!entry.unlocked) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name">??? — {entry.title}</div>
        <div className="codex-entry-locked-hint">Complete this act to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name" style={{ color: '#aaffaa' }}>{entry.subtitle}</span>
        <span className="codex-entry-tag">{entry.title}</span>
      </div>
      {entry.shardLore && <div className="codex-entry-lore">"{entry.shardLore}"</div>}
      {entry.bossName !== '???' && (
        <div className="codex-entry-boss">
          <span className="codex-entry-boss-label">GUARDIAN</span>
          <span className="codex-entry-boss-name">{entry.bossName}</span>
          {entry.bossDescription && (
            <span className="codex-entry-desc"> — {entry.bossDescription}</span>
          )}
        </div>
      )}
    </div>
  )
}

export function CodexScreen({ onDone }: Props) {
  const [tab, setTab] = useState<CodexTab>('cards')
  const [typeFilter, setTypeFilter] = useState<CardTypeFilter>('all')
  const [search, setSearch] = useState('')
  const [showLocked, setShowLocked] = useState(true)

  const cards  = useMemo(() => getCodexCards(),  [])
  const relics = useMemo(() => getCodexRelics(), [])
  const world  = useMemo(() => getCodexWorld(),  [])

  const filteredCards = useMemo<CodexCardEntry[]>(() => {
    let list = cards
    if (typeFilter !== 'all') list = list.filter(c => c.cardType === typeFilter)
    if (!showLocked)          list = list.filter(c => c.unlocked)
    if (search.trim())        list = list.filter(c =>
      c.unlocked && c.name.toLowerCase().includes(search.toLowerCase()),
    )
    return [...list].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
      return (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0)
    })
  }, [cards, typeFilter, showLocked, search])

  const unlockedCardCount  = cards.filter(c => c.unlocked).length
  const unlockedRelicCount = relics.filter(r => r.unlocked).length
  const unlockedWorldCount = world.filter(w => w.unlocked).length

  const subtitle = tab === 'cards'
    ? `${unlockedCardCount} / ${cards.length} discovered`
    : tab === 'relics'
    ? `${unlockedRelicCount} / ${relics.length} earned`
    : `${unlockedWorldCount} / ${world.length} shards explored`

  return (
    <OverlayScreen title="CODEX" subtitle={subtitle} onBack={onDone}>
      <div className="codex-screen">
        {/* Tab bar */}
        <div className="codex-tabs">
          {(['cards', 'relics', 'world'] as CodexTab[]).map(t => (
            <button
              key={t}
              className={`filter-btn${tab === t ? ' filter-btn--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'cards' ? `CARDS (${unlockedCardCount})` :
               t === 'relics' ? `RELICS (${unlockedRelicCount})` :
               `WORLD (${unlockedWorldCount})`}
            </button>
          ))}
        </div>

        {/* Cards tab controls */}
        {tab === 'cards' && (
          <div className="codex-controls">
            <input
              className="codex-search"
              type="text"
              placeholder="Search cards..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="codex-filters">
              {(['all', 'unit', 'structure', 'upgrade'] as CardTypeFilter[]).map(t => (
                <button
                  key={t}
                  className={`filter-btn filter-btn--sm${typeFilter === t ? ' filter-btn--active' : ''}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
              <button
                className={`filter-btn filter-btn--sm${!showLocked ? ' filter-btn--active' : ''}`}
                onClick={() => setShowLocked(v => !v)}
              >
                {showLocked ? 'HIDE LOCKED' : 'SHOW LOCKED'}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="codex-list">
          {tab === 'cards' && filteredCards.map(card => (
            <CardLorePanel key={card.name} card={card} />
          ))}

          {tab === 'relics' && relics.map(relic => (
            <RelicLorePanel key={relic.name} relic={relic} />
          ))}

          {tab === 'world' && world.map(entry => (
            <WorldLorePanel key={entry.actId} entry={entry} />
          ))}

          {tab === 'cards' && filteredCards.length === 0 && (
            <div className="codex-empty">No cards match the current filter.</div>
          )}
        </div>
      </div>
    </OverlayScreen>
  )
}
