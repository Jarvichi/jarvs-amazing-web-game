import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QuestsModal } from './QuestsModal'
import type { HubQuestDef } from '../../data/hub/questDefs'

const meta = {
  component: QuestsModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuestsModal>

export default meta
type Story = StoryObj<typeof meta>

const sampleQuests: HubQuestDef[] = [
  {
    id: 'q-sample-1',
    type: 'fetch',
    title: 'The Missing Shipment',
    giverNpcId:      'merchant-npc',
    receiverNpcId:   'merchant-npc',
    offerDialogue:   'My crates never arrived from the docks. Can you help?',
    activeDialogue:  { find: 'Check the dockside warehouse for the missing crates.' },
    completeDialogue: 'Wonderful — thank you!',
    reward: { crystals: 50 },
    steps: [
      { key: 'find', type: 'collect', required: 1, pickupIds: ['crate-1'] },
    ],
  },
  {
    id: 'q-sample-2',
    type: 'chain',
    title: 'Supply Run',
    giverNpcId:      'alchemist-npc',
    receiverNpcId:   'alchemist-npc',
    offerDialogue:   'I need ingredients urgently.',
    activeDialogue: {
      herbs:    'Gather herbs from the market district.',
      crystals: 'Bring back the crystals from the vault.',
    },
    completeDialogue: 'Perfect, just what I needed.',
    reward: { crystals: 120 },
    steps: [
      { key: 'herbs',    type: 'collect', required: 3, pickupIds: ['herb-1', 'herb-2', 'herb-3'] },
      { key: 'crystals', type: 'collect', required: 2, pickupIds: ['crystal-1', 'crystal-2'] },
    ],
  },
]

export const NoActiveQuests: Story = {
  args: {
    onClose:   fn(),
    onAbandon: fn(),
    questDefs: [],
  },
}

export const WithQuests: Story = {
  args: {
    onClose:   fn(),
    onAbandon: fn(),
    questDefs: sampleQuests,
  },
}

export const Default: Story = {
  args: {
    onClose:   fn(),
    onAbandon: fn(),
    questDefs: sampleQuests,    
  },
}
