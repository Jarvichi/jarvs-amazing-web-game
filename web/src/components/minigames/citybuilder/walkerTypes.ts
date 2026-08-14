import {
  CityCell, CityState, CITY_ROWS, CITY_COLS,
  cityDefense, getNeighbourIndices, spawnerUnitCount, getCityFoodScore,
} from '../../../game/cityBuilder'
import { RESIDENT_FIRST_NAMES } from '../../../game/names'

export type TaskType = 'idle' | 'resting' | 'eating' | 'patrolling' | 'gathering' | 'visiting' | 'playing' | 'chatting' | 'farming'

export type PersonalityTrait = 'brave' | 'glutton' | 'industrious' | 'sociable' | 'reclusive'

export interface PersonalityInfo {
  icon:  string
  label: string
  desc:  string
}

export const PERSONALITY_INFO: Record<PersonalityTrait, PersonalityInfo> = {
  brave:       { icon: '⚔',  label: 'Brave',        desc: 'Patrols the walls often, never backs down from a threat' },
  glutton:     { icon: '🍖', label: 'Glutton',       desc: 'Visits farms frequently, always hungry' },
  industrious: { icon: '⚙',  label: 'Industrious',   desc: 'Dedicated worker — constantly gathering resources' },
  sociable:    { icon: '💬', label: 'Sociable',       desc: 'Loves to chat and visit neighbours' },
  reclusive:   { icon: '🏠', label: 'Reclusive',      desc: 'Prefers home, keeps to themselves' },
}

const ALL_TRAITS: PersonalityTrait[] = ['brave', 'glutton', 'industrious', 'sociable', 'reclusive']

export interface WalkerTask {
  type:             TaskType
  label:            string
  targetX?:         number
  targetY?:         number
  targetWalkerKey?: string
  resource?:        string
}

export interface Walker {
  cellIndex:    number
  unitIndex:    number
  unitName:     string
  affinityWith?: string
  x:            number
  y:            number
  vx:           number
  vy:           number
  turnTimer:    number
  task:         WalkerTask
  taskTimer:    number
  bubbleTimer:  number
  hidden:       boolean
  hiddenTimer:  number
  trait:        PersonalityTrait
  waypoints:    { x: number; y: number; speed?: number }[]
}

export interface ResidentThought {
  name:     string
  unitName: string
  thought:  string
  happy:    boolean
}

export function residentName(unitName: string, cellIndex: number, unitIndex: number): string {
  const seed = cellIndex * 17 + unitIndex * 31
  return `${RESIDENT_FIRST_NAMES[seed % RESIDENT_FIRST_NAMES.length]} the ${unitName}`
}

export function rageDescription(happiness: number): string {
  if (happiness === 0)  return 'Left the city'
  if (happiness < 5)   return "I'm packing my bags!"
  if (happiness < 10)  return 'Furious — leaving soon!'
  if (happiness < 20)  return 'Furious — on the brink of leaving!'
  if (happiness < 30)  return 'Very unhappy — on edge!'
  if (happiness < 50)  return 'Very unhappy — restless and loud!'
  if (happiness < 60)  return 'Unsettled'
  if (happiness < 90)  return 'A little uneasy'
  return 'Content'
}

export function getUnitRequirements(
  cell: CityCell,
  cityState: CityState,
  cellIndex: number,
): { text: string; met: boolean }[] {
  const reqs: { text: string; met: boolean }[] = []
  const gridRows = cityState.rows ?? CITY_ROWS
  const gridCols = cityState.cols ?? CITY_COLS

  const wantedNeighbour = cell.affinityWith ?? cell.spawnedUnitName
  if (wantedNeighbour) {
    const neighbourMet = getNeighbourIndices(cellIndex, gridRows, gridCols).some(ni => {
      const nc = cityState.grid[ni]
      return nc?.spawnedUnitName === wantedNeighbour && (cityState.happiness[ni] ?? 100) > 0
    })
    reqs.push({
      text: cell.affinityWith
        ? `Wants a ${wantedNeighbour} next door`
        : `Wants another ${wantedNeighbour} next door`,
      met: neighbourMet,
    })
  }

  const foodScore = getCityFoodScore(cityState)
  reqs.push({ text: 'Needs adequate food supply', met: foodScore >= 50 })

  const pop = Math.max(spawnerUnitCount(cityState, cell.cardName), 1)
  const defense = cityDefense(cityState)
  const defenseScore = Math.min(100, (defense / pop) * 8)
  if (defense > 0 || defenseScore < 30) {
    reqs.push({ text: 'Needs city defenses', met: defenseScore >= 50 })
  }

  return reqs
}
