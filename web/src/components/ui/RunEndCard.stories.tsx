import type { Meta, StoryObj } from '@storybook/react-vite';

import { RunEndCard, type RunEndTone } from './RunEndCard';
import { StatRow } from './StatRow';

const meta = {
  title: 'UI/RunEndCard',
  component: RunEndCard,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof RunEndCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const wrapper = (children: React.ReactNode) => (
  <div style={{ position: 'relative', background: 'var(--game-bg)', padding: 48, display: 'flex', justifyContent: 'center' }}>
    {children}
  </div>
);

const sampleStats = (
  <>
    <div className="u-text-c" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>YOU WIN!</div>
    <div className="u-col u-gap-3">
      <StatRow accent label="SCORE" value="12 — 4" />
      <StatRow accent label="TIME" value="2m 14s" />
    </div>
  </>
);

export const Gold: Story = {
  args: { tone: 'gold', children: sampleStats },
  render: (args) => wrapper(<RunEndCard {...args} />),
};

export const Ember: Story = {
  args: { tone: 'ember', children: sampleStats },
  render: (args) => wrapper(<RunEndCard {...args} />),
};

export const Arcane: Story = {
  args: { tone: 'arcane', children: sampleStats },
  render: (args) => wrapper(<RunEndCard {...args} />),
};

const TONES: RunEndTone[] = ['gold', 'ember', 'arcane'];

export const AllTones: Story = {
  args: { tone: 'gold', children: null },
  render: () => (
    <div style={{ display: 'flex', gap: 24, background: 'var(--game-bg)', padding: 48 }}>
      {TONES.map((tone) => (
        <div key={tone} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <RunEndCard tone={tone}>{sampleStats}</RunEndCard>
        </div>
      ))}
    </div>
  ),
};
