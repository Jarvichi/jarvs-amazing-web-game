import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SettingsSlider } from './SettingsSlider';

const meta = {
  component: SettingsSlider,
  title: 'Settings/SettingsSlider',
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SettingsSlider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Volume: Story = {
  args: {
    value: 0.75, onChange: fn(), min: 0, max: 1, step: 0.05,
    label: 'Effects volume', readout: '75%',
  },
};

export const TextSize: Story = {
  args: {
    value: 14, onChange: fn(), min: 11, max: 18, step: 1,
    label: 'Text size', readout: '14px',
  },
};

/** The effects slider is disabled while sound is switched off. */
export const Disabled: Story = {
  args: {
    value: 0.5, onChange: fn(), min: 0, max: 1, step: 0.05,
    label: 'Effects volume', readout: '50%', disabled: true,
  },
};
