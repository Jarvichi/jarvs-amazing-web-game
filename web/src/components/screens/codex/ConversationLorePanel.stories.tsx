import type { Meta, StoryObj } from '@storybook/react-vite';

import { ConversationLorePanel } from './ConversationLorePanel';

const meta = {
  component: ConversationLorePanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ConversationLorePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PartiallyMet: Story = {
  args: {
    entry: {
      id: 'merchant',
      name: 'Old Tam',
      title: 'The Wandering Merchant',
      icon: '🛒',
      seenCount: 1,
      stages: [
        {
          index: 0,
          greeting: 'Well now, a new face. Care to see my wares?',
          choices: [
            { label: 'Show me what you have.', response: 'Patience, patience. Let me set up.' },
          ],
          seen: true,
        },
        {
          index: 1,
          greeting: '',
          seen: false,
        },
      ],
    },
  },
};

export const FullyMet: Story = {
  args: {
    entry: {
      id: 'merchant',
      name: 'Old Tam',
      title: 'The Wandering Merchant',
      icon: '🛒',
      seenCount: 1,
      stages: [
        {
          index: 0,
          greeting: 'Well now, a new face. Care to see my wares?',
          seen: true,
        },
      ],
    },
  },
};
