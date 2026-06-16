import { fn } from 'storybook/test'
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubWorld, Props } from './HubWorld'
import {
  ALL_QUEST_DEFS,
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
} from '../../data/hub/hubWorldFactory'

const meta = {
  component: HubWorld,
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
} satisfies Meta<typeof HubWorld>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onBack: fn(),
    onFeedback: fn(),
    user: null,

    locationData:    RAVENWATCH,
    locationQuests: RAVENWATCH_QUESTS,
    questDefs:       RAVENWATCH_QUESTS.HUB_QUEST_DEFS,
    allQuestDefs:    ALL_QUEST_DEFS   
  },
}

function tileInspector (args: Props){

    const [tile, setTile] = useState<{ tx: number; ty: number } | null>(null)
    const [copied, setCopied] = useState(false)

    const handleTileTap = (tx: number, ty: number) => {
      setTile({ tx, ty })
      navigator.clipboard?.writeText(`[${tx}, ${ty}]`).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }).catch(() => {})
    }

    return (
      <>
        <HubWorld {...args} onTileTap={handleTileTap} />
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#0a0a18ee', color: '#88ff88', fontFamily: 'monospace', fontSize: 13,
          padding: '6px 16px', borderRadius: 4, border: '1px solid #44aa44',
          zIndex: 9999, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {tile
            ? `[${tile.tx}, ${tile.ty}]  ${copied ? '✓ copied' : ''}`
            : 'click any tile to see coordinates'}
        </div>
      </>
    )

}


export const TileInspector: Story = {
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(),
    onFeedback: fn(),
    user: null,

        locationData:    RAVENWATCH,
    locationQuests: RAVENWATCH_QUESTS,
    questDefs:       RAVENWATCH_QUESTS.HUB_QUEST_DEFS,
    allQuestDefs:    ALL_QUEST_DEFS   
  },
}

export const MillhavenTileInspector: Story = {
    render: (args) => tileInspector(args),
  args: {
    onBack: fn(),
    onFeedback: fn(),
    user: null,

    locationData:    MILLHAVE,
    locationQuests: MILLHAVE_QUESTS,
    questDefs:       MILLHAVE_QUESTS.HUB_QUEST_DEFS,
    allQuestDefs:    ALL_QUEST_DEFS   
  },
}

export const IronholdKeepTileInspector: Story = {
  name: 'Ironhold Keep — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: IRONHOLDKEEP, locationQuests: IRONHOLDKEEP_QUESTS,
    questDefs: IRONHOLDKEEP_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const ThornwoodCampTileInspector: Story = {
  name: 'Thornwood Camp — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: THORNWOODCAMP, locationQuests: THORNWOODCAMP_QUESTS,
    questDefs: THORNWOODCAMP_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const CapitalCityTileInspector: Story = {
  name: 'Capital City — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: CAPITALCITY, locationQuests: CAPITALCITY_QUESTS,
    questDefs: CAPITALCITY_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const RoyalPalaceTileInspector: Story = {
  name: 'Royal Palace — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: ROYALPALACE, locationQuests: ROYALPALACE_QUESTS,
    questDefs: ROYALPALACE_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const SaltmerePortTileInspector: Story = {
  name: 'Saltmere Port — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: SALTMEREPORT, locationQuests: SALTMEREPORT_QUESTS,
    questDefs: SALTMEREPORT_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const GearfordTileInspector: Story = {
  name: 'Gearford — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: GEARFORD, locationQuests: GEARFORD_QUESTS,
    questDefs: GEARFORD_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const HarrowfieldTileInspector: Story = {
  name: 'Harrowfield — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: HARROWFIELD, locationQuests: HARROWFIELD_QUESTS,
    questDefs: HARROWFIELD_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const ApplefordTileInspector: Story = {
  name: 'Appleford — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: APPLEFORD, locationQuests: APPLEFORD_QUESTS,
    questDefs: APPLEFORD_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const GravemoorTileInspector: Story = {
  name: 'Gravemoor — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: GRAVEMOOR, locationQuests: GRAVEMOOR_QUESTS,
    questDefs: GRAVEMOOR_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const HollowmereTileInspector: Story = {
  name: 'Hollowmere — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: HOLLOWMERE, locationQuests: HOLLOWMERE_QUESTS,
    questDefs: HOLLOWMERE_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}

export const DreadspirecCitadelTileInspector: Story = {
  name: 'Dreadspire Citadel — Tile Inspector',
  render: (args) => tileInspector(args),
  args: {
    onBack: fn(), onFeedback: fn(), user: null,
    locationData: DREADSPIRECITADEL, locationQuests: DREADSPIRECITADEL_QUESTS,
    questDefs: DREADSPIRECITADEL_QUESTS.HUB_QUEST_DEFS, allQuestDefs: ALL_QUEST_DEFS,
  },
}
