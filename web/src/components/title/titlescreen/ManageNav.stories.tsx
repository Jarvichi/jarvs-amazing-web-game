import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManageNav } from './ManageNav';

const meta = {
  component: ManageNav,
  parameters: { layout: 'centered' },
  title: 'Title/ManageNav',
} satisfies Meta<typeof ManageNav>;

export default meta;

type Story = StoryObj<typeof meta>;

const callbacks = {
  onPlayer: fn(),
  onDeckBuilder: fn(),
  onCollection: fn(),
  onShop: fn(),
  onCodex: fn(),
  onChronicle: fn(),
  onNews: fn(),
  onSettings: fn(),
};

export const NoAlerts: Story = {
  args: {
    ...callbacks,
    achievementAlert: false,
    collectionAlert: false,
    shopAlert: false,
    chronicleAlert: false,
    hasUnreadNews: false,
  },
};

export const AllAlerts: Story = {
  args: {
    ...callbacks,
    achievementAlert: true,
    collectionAlert: true,
    shopAlert: true,
    chronicleAlert: true,
    hasUnreadNews: true,
  },
};

export const WithCommander: Story = {
  args: {
    ...callbacks,
    achievementAlert: false,
    collectionAlert: false,
    shopAlert: false,
    chronicleAlert: false,
    hasUnreadNews: false,
    commanderName: 'Valeria',
    onCommander: fn(),
  },
};
