import React from 'react'

interface Props {
  /** Letters to display in order, e.g. ['T','R','A','I','L']. */
  letters: string[]
  /** How many letters (from the left) are lit. */
  litCount: number
  /** Adds the ember "loser" tint to each letter when set. */
  tone?: 'loser'
  title?: string
}

export function WordMeter({ letters, litCount, tone, title }: Props) {
  return (
    <div className="fm-word-meter" title={title}>
      {letters.map((letter, i) => (
        <span
          key={letter + i}
          className={`fm-word-letter${tone === 'loser' ? ' fm-word-letter--loser' : ''}${i < litCount ? ' fm-word-letter--lit' : ''}`}
        >
          {letter}
        </span>
      ))}
    </div>
  )
}
