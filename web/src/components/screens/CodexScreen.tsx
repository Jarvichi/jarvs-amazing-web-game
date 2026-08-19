import React, { useState, useMemo, useEffect } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import {
  getCodexCards, getCodexRelics, getCodexWorld, getCodexFragments, getCodexConversations, getCodexChronicle,
  CodexCardEntry, CodexRelicEntry, CodexWorldEntry, CodexFragmentEntry, CodexConversationEntry, CodexChronicleEntry,
} from '../../game/codex'

type CodexTab = 'cards' | 'relics' | 'world' | 'fragments' | 'conversations' | 'chronicle'
type CardTypeFilter = 'all' | 'unit' | 'structure' | 'upgrade'

const RARITY_ORDER: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, epic: 4,
  legendary: 5, mythic: 6, shiny: 7, holofoil: 8, glass: 9,
}

const RARITY_COLORS: Record<string, string> = {
  common:    '#999999',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  epic:      '#ff8800',
  legendary: '#ffcc00',
  mythic:    '#e040fb',
  shiny:     '#ffe066',
  holofoil:  '#40e0d0',
  glass:     '#a0d8ef',
}

function ConversationLorePanel({ entry }: { entry: CodexConversationEntry }) {
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name">{entry.icon} {entry.name}</span>
        <span className="codex-entry-tag">{entry.title.toUpperCase()}</span>
        <span className="codex-entry-tag">{entry.seenCount} / {entry.stages.length} ENCOUNTERS</span>
      </div>
      <div className="codex-conversation-stages">
        {entry.stages.map((stage) => (
          stage.seen ? (
            <div key={stage.index} className="codex-conversation-stage">
              <div className="codex-conversation-stage-label">ENCOUNTER {stage.index + 1}</div>
              {stage.greeting.split('\n\n').map((para, i) => (
                <div key={i} className="codex-entry-desc">{para}</div>
              ))}
              {stage.choices && (
                <div className="codex-conversation-choices">
                  {stage.choices.map((choice, j) => (
                    <div key={j} className="codex-conversation-choice">
                      <div className="codex-conversation-choice-label">› {choice.label}</div>
                      <div className="codex-conversation-choice-response">{choice.response}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={stage.index} className="codex-conversation-stage codex-conversation-stage--locked">
              <div className="codex-conversation-stage-label">ENCOUNTER {stage.index + 1}</div>
              <div className="codex-entry-locked-hint">Meet {entry.name} again to unlock this encounter.</div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

function ChronicleLorePanel({ entry }: { entry: CodexChronicleEntry }) {
  if (!entry.unlocked) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name">📜 Chapter {entry.number} — ???</div>
        <div className="codex-entry-locked-hint">Complete this Fracture Chronicle chapter to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name" style={{ color: '#ffd54f' }}>📜 {entry.title}</span>
        <span className="codex-entry-tag">CHAPTER {entry.number}</span>
      </div>
      {entry.lore.split('\n\n').map((para, i) => (
        <div key={i} className="codex-entry-desc">{para}</div>
      ))}
    </div>
  )
}

function FragmentLorePanel({ entry }: { entry: CodexFragmentEntry }) {
  if (!entry.discovered) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name">◆ ??? — {entry.actId.toUpperCase()}</div>
        <div className="codex-entry-locked-hint">Find this memory fragment on the campaign map to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name" style={{ color: '#aaddff' }}>◆ {entry.title}</span>
        <span className="codex-entry-tag">{entry.actId.toUpperCase()}</span>
      </div>
      {entry.body.split('\n\n').map((para, i) => (
        <div key={i} className="codex-entry-desc">{para}</div>
      ))}
    </div>
  )
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
        {relic.exotic && <span className="relic-exotic-tag" style={{ position: 'static', marginLeft: 8 }}>EXOTIC</span>}
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

  const cards         = useMemo(() => getCodexCards(),         [])
  const relics        = useMemo(() => getCodexRelics(),        [])
  const fragments     = useMemo(() => getCodexFragments(),     [])
  const conversations = useMemo(() => getCodexConversations(), [])
  const chronicle     = useMemo(() => getCodexChronicle(),     [])

  // World lore spans every act, so it's loaded on demand (this screen is
  // navigated to, not part of boot) rather than kept eagerly in memory.
  const [world, setWorld] = useState<CodexWorldEntry[]>([])
  useEffect(() => {
    let cancelled = false
    getCodexWorld().then(entries => { if (!cancelled) setWorld(entries) })
    return () => { cancelled = true }
  }, [])

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

  const unlockedCardCount     = cards.filter(c => c.unlocked).length
  const unlockedRelicCount    = relics.filter(r => r.unlocked).length
  const unlockedWorldCount    = world.filter(w => w.unlocked).length
  const discoveredFragCount   = fragments.filter(f => f.discovered).length
  const metNpcCount           = conversations.filter(c => c.seenCount > 0).length
  const unlockedChapterCount  = chronicle.filter(c => c.unlocked).length

  const subtitle = tab === 'cards'
    ? `${unlockedCardCount} / ${cards.length} discovered`
    : tab === 'relics'
    ? `${unlockedRelicCount} / ${relics.length} earned`
    : tab === 'world'
    ? `${unlockedWorldCount} / ${world.length} shards explored`
    : tab === 'fragments'
    ? `${discoveredFragCount} / ${fragments.length} fragments recovered`
    : tab === 'chronicle'
    ? `${unlockedChapterCount} / ${chronicle.length} chapters chronicled`
    : `${metNpcCount} / ${conversations.length} characters met`

  return (
    <OverlayScreen title="CODEX" subtitle={subtitle} onBack={onDone}>
      <div className="codex-screen">
        {/* Tab bar */}
        <div className="codex-tabs">
          {(['cards', 'relics', 'world', 'fragments', 'conversations', 'chronicle'] as CodexTab[]).map(t => (
            <button
              key={t}
              className={`filter-btn${tab === t ? ' filter-btn--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'cards'          ? `CARDS (${unlockedCardCount})` :
               t === 'relics'         ? `RELICS (${unlockedRelicCount})` :
               t === 'world'          ? `WORLD (${unlockedWorldCount})` :
               t === 'fragments'      ? `FRAGMENTS (${discoveredFragCount})` :
               t === 'chronicle'      ? `CHRONICLE (${unlockedChapterCount})` :
               `NPCS (${metNpcCount})`}
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

          {tab === 'fragments' && fragments.map(entry => (
            <FragmentLorePanel key={entry.id} entry={entry} />
          ))}

          {tab === 'conversations' && conversations.map(entry => (
            <ConversationLorePanel key={entry.id} entry={entry} />
          ))}

          {tab === 'chronicle' && chronicle.map(entry => (
            <ChronicleLorePanel key={entry.id} entry={entry} />
          ))}

          {tab === 'cards' && filteredCards.length === 0 && (
            <div className="codex-empty">No cards match the current filter.</div>
          )}
        </div>
      </div>
    </OverlayScreen>
  )
}
