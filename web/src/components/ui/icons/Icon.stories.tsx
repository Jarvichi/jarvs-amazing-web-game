import type { Meta, StoryObj } from '@storybook/react-vite';

import { Icon } from './Icon';
import { IconSprite, ICON_NAMES } from './IconSprite';

const meta = {
  title: 'UI/Icon',
  component: Icon,
  parameters: { layout: 'centered' },
  decorators: [(Story) => (<><IconSprite /><Story /></>)],
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { name: 'player' },
};

export const AllIcons: Story = {
  args: { name: 'player' },
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, auto)',
      gap: 20,
      background: 'var(--game-bg)',
      color: 'var(--game-text-color)',
      padding: 20,
    }}>
      {ICON_NAMES.map((name) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 10 }}>
          <Icon name={name} size={28} />
          <span>{name}</span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  args: { name: 'trophy' },
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--game-bg)', color: 'var(--color-gold-alt)', padding: 20 }}>
      <Icon name="trophy" size={16} />
      <Icon name="trophy" size={20} />
      <Icon name="trophy" size={24} />
      <Icon name="trophy" size={32} />
      <Icon name="trophy" size={48} />
    </div>
  ),
};

export const ThemedByColor: Story = {
  args: { name: 'crystal' },
  render: () => (
    <div style={{ display: 'flex', gap: 16, background: 'var(--game-bg)', padding: 20 }}>
      <Icon name="crystal" size={32} style={{ color: 'var(--game-text-color)' }} />
      <Icon name="crystal" size={32} style={{ color: 'var(--accent-gold)' }} />
      <Icon name="crystal" size={32} style={{ color: 'var(--accent-ember)' }} />
      <Icon name="crystal" size={32} style={{ color: 'var(--accent-arcane)' }} />
    </div>
  ),
};
