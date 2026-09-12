import React, { useState, useMemo, useEffect } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { TabNav, type TabNavItem } from '../ui/TabNav'
import { FilterChips } from '../ui/rows/FilterChips'
import { Button } from '../ui/Button'
import {
  getCodexCards, getCodexRelics, getCodexWorld, getCodexFragments, getCodexConversations, getCodexChronicle,
  CodexCardEntry, CodexWorldEntry,
} from '../../game/codex'
import { EmptyState } from '../ui/EmptyState'
import { CardLorePanel } from './codex/CardLorePanel'
import { RelicLorePanel } from './codex/RelicLorePanel'
import { WorldLorePanel } from './codex/WorldLorePanel'
import { FragmentLorePanel } from './codex/FragmentLorePanel'
import { ConversationLorePanel } from './codex/ConversationLorePanel'
import { ChronicleLorePanel } from './codex/ChronicleLorePanel'

type CodexTab = 'cards' | 'relics' | 'world' | 'fragments' | 'conversations' | 'chronicle'
type CardTypeFilter = 'all' | 'unit' | 'structure' | 'upgrade'

const RARITY_ORDER: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, epic: 4,
  legendary: 5, mythic: 6, shiny: 7, holofoil: 8, glass: 9,
}

const TYPE_FILTER_OPTIONS: { id: CardTypeFilter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'unit', label: 'UNIT' },
  { id: 'structure', label: 'STRUCTURE' },
  { id: 'upgrade', label: 'UPGRADE' },
]

interface Props {
  onDone: () => void
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

  const tabItems: TabNavItem<CodexTab>[] = [
    { id: 'cards', label: 'CARDS', icon: 'card', badge: unlockedCardCount },
    { id: 'relics', label: 'RELICS', icon: 'crystal', badge: unlockedRelicCount },
    { id: 'world', label: 'WORLD', icon: 'town', badge: unlockedWorldCount },
    { id: 'fragments', label: 'FRAGMENTS', icon: 'scroll', badge: discoveredFragCount },
    { id: 'conversations', label: 'NPCS', icon: 'player', badge: metNpcCount },
    { id: 'chronicle', label: 'CHRONICLE', icon: 'chronicle', badge: unlockedChapterCount },
  ]

  return (
    <OverlayScreen title="CODEX" subtitle={subtitle} onBack={onDone}>
      <div className="codex-screen">
        <TabNav
          items={tabItems}
          activeId={tab}
          onSelect={setTab}
          ariaLabel="Codex sections"
          panelId="codex-panel"
        />

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
              <FilterChips
                options={TYPE_FILTER_OPTIONS}
                activeId={typeFilter}
                onChange={id => setTypeFilter(id as CardTypeFilter)}
                label="Filter card type"
              />
              <Button size="sm" variant={!showLocked ? 'gold' : 'default'} onClick={() => setShowLocked(v => !v)}>
                {showLocked ? 'HIDE LOCKED' : 'SHOW LOCKED'}
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="codex-list" id="codex-panel">
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
            <EmptyState>No cards match the current filter.</EmptyState>
          )}
        </div>
      </div>
    </OverlayScreen>
  )
}
