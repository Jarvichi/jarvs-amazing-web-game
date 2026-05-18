import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatsScreen } from './StatsScreen'
import { CityState, HistorySample } from '../../../game/cityBuilder'

const meta = {
  component: StatsScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof StatsScreen>

export default meta
type Story = StoryObj<typeof meta>

// Minimal CityState shape — only fields StatsScreen actually reads
function makeCity(history: HistorySample[]): CityState {
  return {
    grid:                [],
    gold:                history[history.length - 1]?.gold ?? 0,
    resources:           { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 },
    lastTick:            Date.now(),
    happiness:           {},
    rows:                4,
    nextAttackAt:        Date.now() + 3_600_000,
    fortifications:      [],
    builderQueue:        [],
    builderCount:        2,
    lastAttack:          null,
    chronicle:           [],
    completedMilestones: [],
    attacksProcessed:    0,
    tradeOffer:          null,
    activeCaravan:       null,
    history,
  }
}

// Generate a plausible 24h history with a growth trend and a few attacks
function generateHistory(samples = 24): HistorySample[] {
  const now = Date.now()
  const out: HistorySample[] = []
  let gold  = 8_000
  let wheat = 200
  let wood  = 80
  let pop   = 4
  let def   = 30

  for (let i = 0; i < samples; i++) {
    const t = now - (samples - 1 - i) * 10 * 60_000
    gold  += 400 + Math.random() * 200 - 50
    wheat  = Math.max(0, wheat + 10 - Math.random() * 8)
    wood   = Math.max(0, wood  + 4  - Math.random() * 3)
    if (i % 8 === 0 && pop < 12) pop++
    const attacked = i === 6 || i === 15
    if (attacked) { gold -= 1_200; def = Math.max(10, def - 5) }
    out.push({
      t,
      gold:   Math.round(gold),
      pop,
      def,
      wheat:  Math.round(wheat),
      wood:   Math.round(wood),
      ore:    Math.round(20 + i * 2),
      bread:  Math.round(Math.max(0, 30 - i)),
      planks: Math.round(10 + i * 0.5),
      metal:  Math.round(5 + i * 0.8),
      attacked,
    })
  }
  return out
}

export const WithData: Story = {
  args: {
    city: makeCity(generateHistory(36)),
    onBack: () => {},
  },
}

export const FewSamples: Story = {
  args: {
    city: makeCity(generateHistory(3)),
    onBack: () => {},
  },
}

export const NoData: Story = {
  args: {
    city: makeCity([]),
    onBack: () => {},
  },
}
