import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LoginButton, Props } from './LoginButton';

const meta = {
  title: 'UI/LoginButton',
  parameters: { layout: 'centered' },  
  component: LoginButton,
} satisfies Meta<typeof LoginButton>;

export default meta;

type Story = StoryObj<typeof meta>;

const defaultProps: Props = {
  onSignIn: fn(),
  onSignOut: fn(),
  user: null,
  playerName: null,
};


export const Default: Story = {
  args: {
    ...defaultProps
  },
};

export const SignedIn: Story = {
  args: {
    ...defaultProps,
    user: {
      displayName: "Test User",
      email: "test@example.com",
      isAnonymous: false,
    } as any, // Cast to any since we're only using a subset of User properties
    playerName: "Test Player",
  },
};