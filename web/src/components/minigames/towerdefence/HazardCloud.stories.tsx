import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { HazardCloud, Props } from './HazardCloud';
import { exampleTDHazard, exampleTowerPool } from '../../../game/types.sample';

const meta = {
  component: HazardCloud,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HazardCloud>;

export default meta;

type Story = StoryObj<typeof meta>;



const defaultProps: Props = {

  hazard: exampleTDHazard,
};

export const Default: Story = {
  args: {
    ...defaultProps,
  },
};
