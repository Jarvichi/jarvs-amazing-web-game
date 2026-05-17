import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta = {
    title: 'UI/Button',
    component: Button,
    parameters: { layout: 'centered' },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "children": <>Click Me</>,
  },
};