import type { Meta, StoryObj } from '@storybook/react-vite';

import { PageHeader, Props } from './PageHeader';

export default {
    title: 'UI/PageHeader',
    component: PageHeader,
    parameters: { layout: 'centered' },
}

export const Default = {
    args: {
        title: 'Page Title',
    },
}