import type { Meta, StoryObj } from '@storybook/react-vite';

import { SettingsRow } from './SettingsRow';
import { SettingsToggle } from './SettingsToggle';
import { Button } from '../../ui/Button';

const meta = {
  component: SettingsRow,
  title: 'Settings/SettingsRow',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SettingsRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithToggle: Story = {
  args: {
    label: 'Sound',
    sublabel: 'Procedurally generated audio',
    children: <SettingsToggle checked onChange={() => {}} label="Sound" />,
  },
};

export const WithButton: Story = {
  args: {
    label: 'Export save data',
    sublabel: 'Download all localStorage as a JSON file',
    children: <Button>EXPORT</Button>,
  },
};

/** About-screen rows have no control at all — just label and value. */
export const TextOnly: Story = {
  args: {
    label: 'Build ID',
    sublabel: 'a1b2c3d',
  },
};

/** Used when the control is a button group too wide to sit beside the text. */
export const Stacked: Story = {
  args: {
    stacked: true,
    label: 'Cloud save found',
    sublabel: 'Load it? Your local progress will be replaced.',
    children: (
      <div className="u-flex u-gap-4">
        <Button>LOAD CLOUD SAVE</Button>
        <Button size="xs">KEEP LOCAL</Button>
      </div>
    ),
  },
};
