import type { Meta, StoryObj } from '@storybook/react-vite';

import { PageHeader } from './PageHeader';
import { IconSprite } from './icons/IconSprite';

/* PageHeader renders the back control as an <Icon>, which resolves a
   <symbol> from the sprite mounted once near the app root — Storybook has
   no App.tsx, so each story mounts its own. */
const meta: Meta<typeof PageHeader> = {
    title: 'UI/PageHeader',
    component: PageHeader,
    parameters: { layout: 'padded' },
    decorators: [
        (Story) => (
            <div style={{ width: 420 }}>
                <IconSprite />
                <Story />
            </div>
        ),
    ],
};
export default meta;

type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
    args: {
        title: 'Page Title',
    },
};

export const WithBack: Story = {
    args: {
        title: "WHAT'S NEW",
        onBack: () => {},
    },
};

/* The case the compact back control exists for: at phone width, title,
   subtitle and right-hand status all still fit. */
export const WithSubtitleAndStatus: Story = {
    args: {
        title: 'FRACTURE CHRONICLE',
        subtitle: 'Chapter 5 — The Archive’s Long Silence',
        onBack: () => {},
        right: <span className="overlay-count">29/30 cards</span>,
    },
};
