import { useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubMinimap, MinimapObjective } from './HubMinimap'
import { RAVENWATCH } from '../../data/hub/hubWorldFactory'

// Story-friendly wrapper: HubMinimap reads the player position and viewport
// imperatively via refs, so we set those up here and feed it static demo data.
interface DemoProps {
  objectives: MinimapObjective[]
  player:     { x: number; y: number }
  viewport:   { width: number; height: number }
}

function MinimapDemo({ objectives, player, viewport }: DemoProps) {
  const playerRef   = useRef(player)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  return (
    <div style={{ position: 'relative', width: 460, height: 340, background: '#16241a', overflow: 'hidden' }}>
      <div
        ref={viewportRef}
        style={{ width: viewport.width, height: viewport.height, overflow: 'hidden' }}
      >
        <div style={{ width: RAVENWATCH.MAP_W, height: RAVENWATCH.MAP_H }} />
      </div>
      <HubMinimap
        locationData={RAVENWATCH}
        objectives={objectives}
        playerRef={playerRef}
        viewportRef={viewportRef}
      />
    </div>
  )
}

const meta = {
  component: MinimapDemo,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof MinimapDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    player:   { x: 200, y: 150 },
    viewport: { width: 460, height: 340 },
    objectives: [
      { x: 300, y: 200, kind: 'pickup' },
      { x: 150, y: 260, kind: 'npc' },
    ],
  },
}

export const OffscreenObjective: Story = {
  args: {
    player:   { x: 200, y: 150 },
    viewport: { width: 460, height: 340 },
    // Far outside the visible window → triggers the off-screen edge arrow.
    objectives: [{ x: 1700, y: 1300, kind: 'npc' }],
  },
}

export const NoObjectives: Story = {
  args: {
    player:     { x: 400, y: 400 },
    viewport:   { width: 460, height: 340 },
    objectives: [],
  },
}
