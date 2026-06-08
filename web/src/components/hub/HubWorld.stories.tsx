import { fn } from 'storybook/test'
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubWorld } from './HubWorld'
import { ALL_QUEST_DEFS, ALL_QUESTS, IRONHOLDKEEP, IRONHOLDKEEP_QUESTS, MILLHAVE, MILLHAVE_QUESTS, RAVENWATCH, RAVENWATCH_QUESTS } from '../../data/hub/hubWorldFactory'

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

function tileInspector (args){

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
    render: (args) => tileInspector(args),
  args: {
    onBack: fn(),
    onFeedback: fn(),
    user: null,

    locationData:    IRONHOLDKEEP,
    locationQuests: IRONHOLDKEEP_QUESTS,
    questDefs:       IRONHOLDKEEP_QUESTS.HUB_QUEST_DEFS,
    allQuestDefs:    ALL_QUEST_DEFS   
  },
}