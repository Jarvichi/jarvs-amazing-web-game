import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardTile } from './CardTile';
import { exampleCard } from '../game/types.sample';




const meta = {
  component: CardTile,
} satisfies Meta<typeof CardTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    card: exampleCard,
  },
};

export const CanAffordFalse: Story = {
  args: {
    card: exampleCard,
    canAfford: false,
  },
};

export const Disabled: Story = {
  args: {
    card: exampleCard,
    disabled: true, 
    },
};

export const LockedHero: Story = {
  args: {
    card: { ...exampleCard, isHero: true },
    lockedSecs: 15,
   },
};

export const IsHero: Story = {
  args: {
    card: { ...exampleCard, isHero: true },
   },
};

export const Upgradeable: Story = {
  args: {
    card: { ...exampleCard, upgradeEffect: { type: 'buffAttack', amount: 2 } },
    upgradeable: true,
   },
};

export const ShowDetails: Story = {
  args: {
    card: exampleCard,
    showDetails: true,  
  },
};

export const AllProps: Story = {
  args: {
    card: { ...exampleCard, isHero: true, upgradeEffect: { type: 'buffAttack', amount: 2 } },
    canAfford: false,
    disabled: true,
    lockedSecs: 15,
    upgradeable: true,
    showDetails: true,  
  },
};