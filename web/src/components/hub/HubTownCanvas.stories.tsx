import { fn } from 'storybook/test'
import { useRef, useState, useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubTownCanvas } from './HubTownCanvas'
import { IRONHOLDKEEP, IRONHOLDKEEP_QUESTS, MILLHAVE, MILLHAVE_QUESTS, RAVENWATCH, RAVENWATCH_QUESTS } from '../../data/hub/hubWorldFactory'

const PAN_STEP = 64

function PannableCanvas(args: React.ComponentProps<typeof HubTownCanvas>) {
  const returnRef = useRef<(() => void) | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dirs: Record<string, [number, number]> = {
        ArrowLeft:  [ PAN_STEP, 0],
        ArrowRight: [-PAN_STEP, 0],
        ArrowUp:    [0,  PAN_STEP],
        ArrowDown:  [0, -PAN_STEP],
      }
      const d = dirs[e.key]
      if (!d) return
      e.preventDefault()
      setOffset(o => ({ x: o.x + d[0], y: o.y + d[1] }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ overflow: 'hidden', width: '100vw', height: '100vh' }}>
      <div style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, willChange: 'transform' }}>
        <HubTownCanvas {...args} returnRef={returnRef} />
      </div>
    </div>
  )
}

const meta = {
  component: HubTownCanvas,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
  render: (args) => <PannableCanvas {...args} />,
} satisfies Meta<typeof HubTownCanvas>

export default meta
type Story = StoryObj<typeof meta>

export const Ravenwatch: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: RAVENWATCH,
    questData: RAVENWATCH_QUESTS,
  },
}

export const IronholdKeep: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: IRONHOLDKEEP,
    questData: IRONHOLDKEEP_QUESTS
  },
}

export const millhaven: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: MILLHAVE,
    questData: MILLHAVE_QUESTS
  },
}