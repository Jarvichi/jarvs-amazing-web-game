import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { UnitGroupToken, Props } from './UnitGroupToken';
import { exampleTDGameState, exampleTDUnit, exampleTowerPool } from '../../../game/types.sample';

const meta = {
  component: UnitGroupToken,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof UnitGroupToken>;

export default meta;

type Story = StoryObj<typeof meta>;



const defaultProps: Props = {

units: [exampleTDUnit,exampleTDUnit],
};

export const Default: Story = {
  args: {
    ...defaultProps,
  },
};

export const SingleUnit: Story = {
  args: {
    ...defaultProps,  
  units: [exampleTDUnit],
  },
};

export const Empty: Story = {
  args: {
    ...defaultProps,  
  units: [],
  },
};

export const ManyUnits: Story = {
  args: {
    ...defaultProps,
  units: [exampleTDUnit,exampleTDUnit,exampleTDUnit,exampleTDUnit,exampleTDUnit],
  },
};