import { useState, useRef, useEffect, Profiler } from 'react';
import { fn, within, expect } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Battlefield } from './Battlefield';
import { exampleGameState } from "../../game/types.sample";
import { tick, newGame } from '../../game/engine';
import { spawnUnit } from '../../game/engine/helpers';
import type { GameState } from '../../game/types';

const meta = {
  component: Battlefield,
} satisfies Meta<typeof Battlefield>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "state": exampleGameState,
    "onPlayCard": fn(),
  },
};

// ---- Performance profiling story ----

const PERF_TICK_COUNT = 30
const PERF_TICK_MS = 100

function createHeavyState(): GameState {
  const state = newGame()
  const mobile = { name: 'Goblin', maxHp: 25, attack: 6, moveSpeed: 32, attackRange: 35, attackCooldownMs: 1000, isWall: false, bypassWall: false }
  const ranged = { name: 'Archer', maxHp: 18, attack: 8, moveSpeed: 28, attackRange: 90, attackCooldownMs: 1200, isWall: false, bypassWall: true }
  for (let i = 0; i < 10; i++) {
    state.field.push(spawnUnit(mobile, 'player'))
    state.field.push(spawnUnit(mobile, 'opponent'))
  }
  for (let i = 0; i < 5; i++) {
    state.field.push(spawnUnit(ranged, 'player'))
    state.field.push(spawnUnit(ranged, 'opponent'))
  }
  for (let i = 0; i < 10; i++) {
    state.bloodPools.push({ id: `pool-${i}`, x: 60 + i * 30, y: ((i % 5) - 2) * 18 })
  }
  return state
}

const noop = () => {}

function PerfHarness() {
  const [gameState, setGameState] = useState<GameState>(createHeavyState)
  const durations = useRef<number[]>([])
  const tickCount = useRef(0)
  const [result, setResult] = useState<{ avg: number; max: number } | null>(null)

  useEffect(() => {
    let rafId: number
    function loop() {
      if (tickCount.current >= PERF_TICK_COUNT) {
        const d = durations.current
        const avg = d.reduce((a, b) => a + b, 0) / (d.length || 1)
        setResult({ avg, max: Math.max(...d, 0) })
        return
      }
      setGameState(prev => prev.phase.type === 'playing' ? tick(prev, PERF_TICK_MS) : prev)
      tickCount.current++
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div>
      <Profiler
        id="battlefield"
        onRender={(_, __, actualDuration) => { durations.current.push(actualDuration) }}
      >
        <Battlefield state={gameState} onPlayCard={noop} />
      </Profiler>
      {result && (
        <div
          data-testid="perf-done"
          data-avg={result.avg.toFixed(2)}
          data-max={result.max.toFixed(2)}
          style={{ display: 'none' }}
        />
      )}
    </div>
  )
}

export const PerformanceProfile: Story = {
  args: { state: exampleGameState, onPlayCard: noop },
  render: () => <PerfHarness />,
  play: async ({ canvasElement }) => {
    const el = await within(canvasElement).findByTestId('perf-done', {}, { timeout: 15000 })
    const avg = parseFloat(el.dataset.avg ?? '0')
    const max = parseFloat(el.dataset.max ?? '0')
    expect(avg, `avg render ${avg.toFixed(1)} ms — expected < 50 ms. Check React.memo wrappers on LaneUnit/ForestBorder.`).toBeLessThan(50)
    expect(max, `max render ${max.toFixed(1)} ms — expected < 150 ms. Check React.memo wrappers on LaneUnit/ForestBorder.`).toBeLessThan(150)
  },
}
