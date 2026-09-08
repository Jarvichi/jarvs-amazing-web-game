import type { Meta, StoryObj } from '@storybook/react-vite';

import { Wellspring } from './Wellspring';

const meta = {
  component: Wellspring,
  parameters: { layout: 'fullscreen' },
  args: { onDone: () => {}, depth: 'deep' },
} satisfies Meta<typeof Wellspring>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A village cistern: 4x4, no tees, two cells welded correct as a scaffold. */
export const Cistern: Story = { args: { depth: 'shallow' } };

/** The middling depth most towns' wells drop into. */
export const Aqueduct: Story = {};

/** A ley vault: 6x6, crosses and seized cells, and edges that wrap. */
export const LeyVault: Story = { args: { depth: 'vault' } };
