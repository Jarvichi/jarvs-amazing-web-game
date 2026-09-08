import type { Meta, StoryObj } from '@storybook/react-vite';

import { DepthPicker } from './DepthPicker';
import { WELLSPRING_DEPTHS } from '../Wellspring.logic';

const meta = {
  component: DepthPicker,
  parameters: { layout: 'centered' },
  args: { depths: WELLSPRING_DEPTHS, value: 'deep', onChange: () => {} },
} satisfies Meta<typeof DepthPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Shallow: Story = { args: { value: 'shallow' } };
export const Abyssal: Story = { args: { value: 'vault' } };

/** Locked once a board is under way, so a half-solved run can't vanish. */
export const Locked: Story = { args: { disabled: true } };
