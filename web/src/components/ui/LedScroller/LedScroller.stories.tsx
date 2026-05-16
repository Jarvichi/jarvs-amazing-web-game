import type { Meta, StoryObj } from '@storybook/react-vite';

import { LedScroller, LedScrollerMessage } from './LedScroller';

const meta = {
  component: LedScroller,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LedScroller>;

const aToZMessages: LedScrollerMessage[] = Array.from({ length: 26 }, (_, i) => ({
  text: String.fromCharCode(65 + i), // ASCII codes for A-Z
  id: `msg-${i + 1}`,
}));

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: { text: 'Hello, World!', id: '1' },
  },
};

export const Alphabet: Story = {
  args: {
    messages: aToZMessages,
  },
};

export const Numbers: Story = {
  args: {
    messages: [{ text: '0', id: '1' }, { text: '1', id: '2' }, { text: '2', id: '3' }, { text: '3', id: '4' }, { text: '4', id: '5' }, { text: '5', id: '6' }, { text: '6', id: '7' }, { text: '7', id: '8' }, { text: '8', id: '9' }, { text: '9', id: '10' }],
  },
};

export const Symbols: Story = {
  args: {
    messages: [{ text: '!', id: '1' }, { text: '?', id: '2' }, { text: '.', id: '3' }, { text: ',', id: '4' }, { text: '&', id: '5' }, { text: '(', id: '6' }, { text: ')', id: '7' }, { text: '=', id: '8' }, { text: '+', id: '9' }, { text: '-', id: '10' }, { text: '"', id: '11' }, { text: "'", id: '12' }, { text: '<', id: '13' }, { text: '>', id: '14' }, { text: '/', id: '15' }, { text: '×', id: '16' }],
  },
};

// '🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🃏', '🌟', '💰'
export const Emojis: Story = {
  args: {
    messages: [
      { text: '🌟', id: '1' },
       { text: '🃏', id: '2' },
        { text: '💰', id: '3' },
         { text: '🍒', id: '4' },
          { text: '🍋', id: '5' },
            { text: '🍊', id: '6' } ,
              { text: '🍇', id: '7' },
                { text: '⭐', id: '8' },
                  { text: '🔔', id: '9' },
                    { text: '💎', id: '10' }         ,],
  },
};