import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TabNav } from './TabNav';
import { SATCHEL_NAV } from '../hub/satchel/types';

const meta = {
  component: TabNav,
  title: 'UI/TabNav',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TabNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LabelsOnly: Story = {
  args: {
    ariaLabel: 'Collection sections',
    activeId: 'cards',
    onSelect: fn(),
    items: [
      { id: 'cards',    label: 'Cards' },
      { id: 'augments', label: 'Augments' },
      { id: 'heroes',   label: 'Heroes' },
    ],
  },
};

export const WithIcons: Story = {
  args: {
    ariaLabel: 'Settings categories',
    activeId: 'audio',
    onSelect: fn(),
    items: [
      { id: 'audio',   label: 'Audio',   icon: 'volume' },
      { id: 'display', label: 'Display', icon: 'display' },
      { id: 'account', label: 'Account', icon: 'player' },
      { id: 'game',    label: 'Game',    icon: 'database' },
      { id: 'about',   label: 'About',   icon: 'info' },
    ],
  },
};

/** A number draws a count pill; `true` draws a plain attention dot. */
export const WithBadges: Story = {
  args: {
    ariaLabel: 'Player sections',
    activeId: 'stats',
    onSelect: fn(),
    items: [
      { id: 'character',    label: 'Character' },
      { id: 'quests',       label: 'Quests', badge: true },
      { id: 'achievements', label: 'Achievements', badge: 3 },
      { id: 'stats',        label: 'Stats' },
    ],
  },
};

/** The satchel shape: a bottom bar on phones, a left rail from tablet up. */
export const BarPlacement: Story = {
  args: {
    ariaLabel: 'Satchel sections',
    activeId: 'satchel',
    onSelect: fn(),
    placement: 'bar',
    items: SATCHEL_NAV.map(i => (i.id === 'quests' ? { ...i, badge: true } : i)),
  },
};

/** The satchel sheet carries its own green ramp; the strip picks it up
 *  through --tab-nav-* rather than reverting to the global palette. */
export const SatchelPalette: Story = {
  args: { ...BarPlacement.args },
  decorators: [
    Story => (
      <div className="satchel-sheet" style={{ height: 90 }}>
        <Story />
      </div>
    ),
  ],
};
