import { fn } from 'storybook/test'
import { useRef, useState, useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubTownCanvas } from './HubTownCanvas'
import {
  RAVENWATCH, RAVENWATCH_QUESTS,
  MILLHAVE, MILLHAVE_QUESTS,
  IRONHOLDKEEP, IRONHOLDKEEP_QUESTS,
  THORNWOODCAMP, THORNWOODCAMP_QUESTS,
  CAPITALCITY, CAPITALCITY_QUESTS,
  ROYALPALACE, ROYALPALACE_QUESTS,
  SALTMEREPORT, SALTMEREPORT_QUESTS,
  GEARFORD, GEARFORD_QUESTS,
  HARROWFIELD, HARROWFIELD_QUESTS,
  APPLEFORD, APPLEFORD_QUESTS,
  GRAVEMOOR, GRAVEMOOR_QUESTS,
  HOLLOWMERE, HOLLOWMERE_QUESTS,
  DREADSPIRECITADEL, DREADSPIRECITADEL_QUESTS,
} from '../../data/hub/hubTownStoryFixtures'

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

// Exercises the production path: viewport-sized canvas with the camera driven
// by a native scroll container (HubWorld does the same with its scrollRef).
function ViewportCanvas(args: React.ComponentProps<typeof HubTownCanvas>) {
  const returnRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={scrollRef} style={{ overflow: 'auto', width: '100vw', height: '100vh' }}>
      <HubTownCanvas {...args} returnRef={returnRef} viewportRef={scrollRef} />
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

export const RavenwatchViewportCamera: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: RAVENWATCH,
    questData: RAVENWATCH_QUESTS,
  },
  render: (args) => <ViewportCanvas {...args} />,
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

export const Millhaven: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: MILLHAVE,
    questData: MILLHAVE_QUESTS,
  },
}

export const ThornwoodCamp: Story = {
  name: 'Thornwood Camp',
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: THORNWOODCAMP,
    questData: THORNWOODCAMP_QUESTS,
  },
}

export const CapitalCity: Story = {
  name: 'Capital City',
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: CAPITALCITY,
    questData: CAPITALCITY_QUESTS,
  },
}

export const RoyalPalace: Story = {
  name: 'Royal Palace',
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: ROYALPALACE,
    questData: ROYALPALACE_QUESTS,
  },
}

export const SaltmerePort: Story = {
  name: 'Saltmere Port',
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: SALTMEREPORT,
    questData: SALTMEREPORT_QUESTS,
  },
}

export const Gearford: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: GEARFORD,
    questData: GEARFORD_QUESTS,
  },
}

export const Harrowfield: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: HARROWFIELD,
    questData: HARROWFIELD_QUESTS,
  },
}

export const Appleford: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: APPLEFORD,
    questData: APPLEFORD_QUESTS,
  },
}

export const Gravemoor: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: GRAVEMOOR,
    questData: GRAVEMOOR_QUESTS,
  },
}

export const Hollowmere: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: HOLLOWMERE,
    questData: HOLLOWMERE_QUESTS,
  },
}

export const DreadspirecCitadel: Story = {
  name: 'Dreadspire Citadel',
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
    locationData: DREADSPIRECITADEL,
    questData: DREADSPIRECITADEL_QUESTS,
  },
}