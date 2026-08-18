import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { Panel } from '../ui/Panel'
import type { HubLocationBundle } from '../../data/hub/loader'
import { ANIMAL_TYPES, TINT_PALETTES, type AnimalType } from '../../game/hub/animals'
import { getFriendshipLevel } from '../../game/hub/friendship'
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

type Tab = 'animals' | 'fish' | 'people' | 'places'

interface Props {
  onClose: () => void
  locationData: HubLocationBundle
}

export function TownJournalContent({ onClose, locationData }: Props) {
  const [tab, setTab] = useState<Tab>('animals')
  const [fishLocale, setFishLocale] = useState<string>(FISH_LOCALES[0].id)

  const seenAnimalTypes = getSeenAnimalTypes()
  const animalsTotal = ANIMAL_TYPES.length
  const animalsSeen = seenAnimalTypes.size

  const fishTotal = ALL_FISH_SPECIES.length
  const fishSeen = ALL_FISH_SPECIES.filter(s => hasCaughtFish(s.locale, s.name)).length

  const seen = new Set<string>()
  const namedNpcs = locationData.HUB_NPCS.filter(n => {
    if (!n.name?.trim() || seen.has(n.id)) return false
    seen.add(n.id)
    return true
  })
  const metNpcIds = getMetNpcIds()
  const peopleTotal = namedNpcs.length
  const peopleMet = namedNpcs.filter(n => metNpcIds.has(n.id)).length

  const areas = locationData.HUB_AREAS
  const placesTotal = areas.length
  const placesSeen = areas.filter(a => hasSeenArea(locationData.HUB_TOWN_NAME, a.id)).length

  const TABS: { id: Tab; label: string; discovered: number; total: number }[] = [
    { id: 'animals', label: 'Animals', discovered: animalsSeen, total: animalsTotal },
    { id: 'fish',    label: 'Fish',    discovered: fishSeen,    total: fishTotal },
    { id: 'people',  label: 'People',  discovered: peopleMet,   total: peopleTotal },
    { id: 'places',  label: 'Places',  discovered: placesSeen,  total: placesTotal },
  ]

  const overallDiscovered = animalsSeen + fishSeen + peopleMet + placesSeen
  const overallTotal = animalsTotal + fishTotal + peopleTotal + placesTotal
  const overallPct = overallTotal > 0 ? Math.round((overallDiscovered / overallTotal) * 100) : 0

  return (
      <Panel elevation="floating" className="town-directory town-journal">
        <div className="town-directory__header">
          <span>📖 Town Journal</span>
          <span className="town-directory__meta">
            {overallPct}% complete
            <button className="town-directory__close" onClick={onClose}>✕</button>
          </span>
        </div>

        <div className="hoa-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`hoa-tab${t.id === tab ? ' hoa-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label} ({t.discovered}/{t.total})
            </button>
          ))}
        </div>

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
            <div className="hoa-tabs">
              {FISH_LOCALES.map(loc => {
                const localeSpecies = ALL_FISH_SPECIES.filter(s => s.locale === loc.id)
                const localeSeen = localeSpecies.filter(s => hasCaughtFish(s.locale, s.name)).length
                return (
                  <button
                    key={loc.id}
                    className={`hoa-tab${loc.id === fishLocale ? ' hoa-tab--active' : ''}`}
                    onClick={() => setFishLocale(loc.id)}
                  >
                    {loc.label} ({localeSeen}/{localeSpecies.length})
                  </button>
                )
              })}
            </div>
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
      </Panel>
  )
}

export function TownJournal(props: Props) {
  return (
    <ModalBackdrop onClose={props.onClose}>
      <TownJournalContent {...props} />
    </ModalBackdrop>
  )
}
