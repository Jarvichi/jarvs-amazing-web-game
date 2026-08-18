import type { Meta, StoryObj } from '@storybook/react-vite';

import { Panel, type PanelElevation, type PanelTone } from './Panel';

const meta = {
  title: 'UI/Panel',
  component: Panel,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Panel>;

export default meta;

type Story = StoryObj<typeof meta>;

const sample = (label: string) => (
  <div style={{ padding: 16, minWidth: 160, color: 'var(--game-text-color)' }}>{label}</div>
);

export const Flat: Story = { args: { elevation: 'flat', children: sample('flat / neutral') } };
export const Raised: Story = { args: { elevation: 'raised', children: sample('raised / neutral') } };
export const Floating: Story = { args: { elevation: 'floating', children: sample('floating / neutral') } };

export const FlatGold: Story = { args: { elevation: 'flat', tone: 'gold', children: sample('flat / gold') } };
export const RaisedGold: Story = { args: { elevation: 'raised', tone: 'gold', children: sample('raised / gold') } };
export const FloatingGold: Story = { args: { elevation: 'floating', tone: 'gold', children: sample('floating / gold') } };

export const FlatDanger: Story = { args: { elevation: 'flat', tone: 'danger', children: sample('flat / danger') } };
export const RaisedDanger: Story = { args: { elevation: 'raised', tone: 'danger', children: sample('raised / danger') } };
export const FloatingDanger: Story = { args: { elevation: 'floating', tone: 'danger', children: sample('floating / danger') } };

export const FlatArcane: Story = { args: { elevation: 'flat', tone: 'arcane', children: sample('flat / arcane') } };
export const RaisedArcane: Story = { args: { elevation: 'raised', tone: 'arcane', children: sample('raised / arcane') } };
export const FloatingArcane: Story = { args: { elevation: 'floating', tone: 'arcane', children: sample('floating / arcane') } };

export const WithRuneCorners: Story = {
  args: { elevation: 'raised', tone: 'gold', runeCorners: true, children: sample('raised / gold / runeCorners') },
};

const ELEVATIONS: PanelElevation[] = ['flat', 'raised', 'floating'];
const TONES: PanelTone[] = ['neutral', 'gold', 'danger', 'arcane'];

export const AllCombinations: Story = {
  args: { children: null },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 16, background: 'var(--game-bg)', padding: 16 }}>
      {ELEVATIONS.flatMap((elevation) =>
        TONES.map((tone) => (
          <Panel key={`${elevation}-${tone}`} elevation={elevation} tone={tone} runeCorners={tone !== 'neutral'}>
            {sample(`${elevation} / ${tone}`)}
          </Panel>
        ))
      )}
    </div>
  ),
};
