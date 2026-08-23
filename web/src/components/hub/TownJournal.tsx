import React, { useState } from 'react'
import type { HubLocationBundle } from '../../data/hub/loader'
import { ANIMAL_TYPES, TINT_PALETTES, type AnimalType } from '../../game/hub/animals'
import { getFriendshipLevel } from '../../game/hub/friendship'
import { FilterChips } from './satchel/FilterChips'
import { getRelationship } from '../../game/hub/relationships'
import {
  hasMetNpc, getMetNpcIds,
  hasSeenAnimal, getSeenAnimalVariants, getSeenAnimalTypes,
  hasSeenArea,
  hasCaughtFish,
} from '../../game/hub/journal'
import { FISH_TIERS, CAVE_FISH_TIERS, LAKE_FISH_TIERS, OCEAN_FISH_TIERS, type FishTier } from '../minigames/Fishing'

const TRACK_ICON: Record<string, string> = { ally: '🤝', rival: '⚔️', romance: '💗' }

const ANIMAL_FLAVOUR: Record<AnimalType, string> = {
  cat:       'Aloof and sun-loving. Naps in doorways, hunts birds for sport.',
  dog:       'Loyal and loud. Follows its owner everywhere it can.',
  bird:      'Flits between rooftops. Gone the moment you look up.',
  fish:      'Quiet pond residents. Easy to miss, easy to startle.',
  butterfly: 'Drifts between flowerbeds. Scatters if a cat gets close.',
  rabbit:    'Bolts at the first sign of trouble. Sticks to open grass.',
  chicken:   'Pecks around its pen, unbothered by most of the town.',
  frog:      'Hops along the water\'s edge, plopping in when startled.',
  firefly:   'A night-time glow over the grass. Vanishes by sunrise.',
  bat:       'Fast, erratic, nocturnal. Rarely sits still long enough to see.',
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface FishLocale {
  id: string
  label: string
  tiers: FishTier[]
}

const FISH_LOCALES: FishLocale[] = [
  { id: 'river', label: 'River', tiers: FISH_TIERS },
  { id: 'lake',  label: 'Lake',  tiers: LAKE_FISH_TIERS },
  { id: 'ocean', label: 'Ocean', tiers: OCEAN_FISH_TIERS },
  { id: 'cave',  label: 'Cave Lake', tiers: CAVE_FISH_TIERS },
]

interface FishSpecies {
  locale: string
  tierName: string
  tierIcon: string
  name: string
}

const ALL_FISH_SPECIES: FishSpecies[] = FISH_LOCALES.flatMap(({ id, tiers }) =>
  tiers.flatMap(tier => tier.names.map(name => ({
    locale: id, tierName: tier.tier, tierIcon: tier.icon, name,
  }))),
)

export type JournalTab = 'animals' | 'fish' | 'people' | 'places'

interface Props {
  locationData: HubLocationBundle
  /** Controlled by the Codex section, whose chip row also carries Trade. */
  tab: JournalTab
}

/** Per-category discovery counts, for the Codex chip row. */
export function journalCounts(locationData: HubLocationBundle): Record<JournalTab, { seen: number; total: number }> {
  const seenIds = new Set<string>()
  const namedNpcs = locationData.HUB_NPCS.filter(n => {
    if (!n.name?.trim() || seenIds.has(n.id)) return false
    seenIds.add(n.id)
    return true
  })
  const metNpcIds = getMetNpcIds()
  const areas = locationData.HUB_AREAS
  return {
    animals: { seen: getSeenAnimalTypes().size, total: ANIMAL_TYPES.length },
    fish:    { seen: ALL_FISH_SPECIES.filter(s => hasCaughtFish(s.locale, s.name)).length, total: ALL_FISH_SPECIES.length },
    people:  { seen: namedNpcs.filter(n => metNpcIds.has(n.id)).length, total: namedNpcs.length },
    places:  { seen: areas.filter(a => hasSeenArea(locationData.HUB_TOWN_NAME, a.id)).length, total: areas.length },
  }
}

/** Overall completion percentage, for the sheet header's meta slot. */
export function journalPct(locationData: HubLocationBundle): number {
  const counts = Object.values(journalCounts(locationData))
  const seen  = counts.reduce((n, c) => n + c.seen, 0)
  const total = counts.reduce((n, c) => n + c.total, 0)
  return total > 0 ? Math.round((seen / total) * 100) : 0
}

export function TownJournalContent({ locationData, tab }: Props) {
  const [fishLocale, setFishLocale] = useState<string>(FISH_LOCALES[0].id)

  const seen = new Set<string>()
  const namedNpcs = locationData.HUB_NPCS.filter(n => {
    if (!n.name?.trim() || seen.has(n.id)) return false
    seen.add(n.id)
    return true
  })
  const areas = locationData.HUB_AREAS

  return (
      <>
        {tab === 'animals' && (
          <div className="town-directory__list town-journal__list">
            {ANIMAL_TYPES.map(type => {
              const known = hasSeenAnimal(type)
              const variants = getSeenAnimalVariants(type)
              const totalVariants = Object.keys(TINT_PALETTES[type]).length
              return (
                <div key={type} className="town-directory__row">
                  <div className="town-directory__info">
                    <span className="town-directory__name">
                      {known ? capitalize(type) : '???'}
                    </span>
                    <span className="town-directory__place">
                      {known
                        ? `${ANIMAL_FLAVOUR[type]} (${variants.size}/${totalVariants} variants seen)`
                        : 'Not yet encountered.'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'fish' && (
          <>
            <FilterChips
              label="Fishing locale"
              activeId={fishLocale}
              onChange={setFishLocale}
              options={FISH_LOCALES.map(loc => ({
                id: loc.id,
                label: loc.label,
                count: ALL_FISH_SPECIES.filter(s => s.locale === loc.id && hasCaughtFish(s.locale, s.name)).length,
              }))}
            />
            <div className="town-directory__list town-journal__list">
              {(FISH_LOCALES.find(l => l.id === fishLocale)?.tiers ?? []).map(tier => {
                const tierSeen = tier.names.filter(name => hasCaughtFish(fishLocale, name)).length
                return (
                  <div key={tier.tier} className="town-journal__tier-group">
                    <div className="town-journal__tier-header">
                      {tier.icon} {tier.tier} ({tierSeen}/{tier.names.length})
                    </div>
                    {tier.names.map(name => {
                      const known = hasCaughtFish(fishLocale, name)
                      return (
                        <div key={name} className="town-directory__row">
                          <div className="town-directory__info">
                            <span className="town-directory__name">
                              {known ? name : '???'}
                            </span>
                            <span className="town-directory__place">
                              {known ? 'Caught' : 'Not yet caught.'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === 'people' && (
          <div className="town-directory__list town-journal__list">
            {namedNpcs.length === 0 ? (
              <div className="town-directory__empty">No one notable lives here yet.</div>
            ) : (
              namedNpcs.map(npc => {
                const met = hasMetNpc(npc.id)
                const track = getRelationship(npc.id).track
                const level = getFriendshipLevel(npc.id)
                return (
                  <div key={npc.id} className="town-directory__row">
                    <div className="town-directory__info">
                      <span className="town-directory__name">
                        {met ? npc.name : '???'}{met && track ? ` ${TRACK_ICON[track]}` : ''}
                      </span>
                      <span className="town-directory__place">
                        {met
                          ? `${npc.dialogue[0] ?? ''}${level > 0 ? ` · Friendship Lv ${level}` : ''}`
                          : 'You haven\'t met them yet.'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {tab === 'places' && (
          <div className="town-directory__list town-journal__list">
            {areas.length === 0 ? (
              <div className="town-directory__empty">No named places here yet.</div>
            ) : (
              areas.map(area => {
                const found = hasSeenArea(locationData.HUB_TOWN_NAME, area.id)
                return (
                  <div key={area.id} className="town-directory__row">
                    <div className="town-directory__info">
                      <span className="town-directory__name">{found ? area.name : '???'}</span>
                      <span className="town-directory__place">
                        {found ? 'Discovered' : 'Not yet visited.'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </>
  )
}
