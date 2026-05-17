import type { Meta, StoryObj } from '@storybook/react-vite';

import { SpriteImg, AnimatedSpriteImg } from './SpriteImg';

const meta = {
  component: SpriteImg,
  title: 'UI/SpriteImg',
  parameters: { layout: 'centered' },  
} satisfies Meta<typeof SpriteImg>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'Goblin',
  },
};

export const Dragon: Story = {
  args: {
    name: 'Dragon',
  },
};

export const WithFallback: Story = {
  args: {
    name: 'nonexistent-unit',
    fallbackName: 'Goblin',
  },
};

export const MissingSprite: Story = {
  args: {
    name: 'nonexistent-unit',
  },
};

export const Animated: Story = {
  args: { name: 'Goblin' },
  render: () => <AnimatedSpriteImg name="Goblin" frameCount={3} fps={4} />,
};
