import type { Meta, StoryObj } from '@storybook/react-vite';

import { CaskSounding } from './CaskSounding';

const meta = {
  component: CaskSounding,
  parameters: { layout: 'fullscreen' },
  args: { tier: 'taproom', onDone: () => {} },
} satisfies Meta<typeof CaskSounding>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TapRoom: Story = {};
export const Cellar: Story = { args: { tier: 'cellar' } };

/**
 * The top tier, and the slowest rack to lay — worth opening to see how long
 * the cellar-steps line sits there before the board appears.
 */
export const VintnersVault: Story = { args: { tier: 'vault' } };
