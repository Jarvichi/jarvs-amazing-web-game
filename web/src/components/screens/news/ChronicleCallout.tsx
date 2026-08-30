import React from 'react'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  /** Chapter number, 1-based. */
  number: number
  title: string
  teaser: string
  /** Reward for completing the chapter's challenge, e.g. "💎 40 crystals". */
  reward: string
  /** The player hasn't read this chapter yet. */
  unread?: boolean
  /** Omitted when the screen has no route to the Chronicle. */
  onOpen?: () => void
}

/**
 * The latest Fracture Chronicle chapter, banner-style, at the top of the feed.
 *
 * Replaces the LED dot-matrix scroller that used to sit here: at 60 columns
 * it could only ever show ~10 characters of a sentence, so it read as
 * mid-word garbage, and the sentence it was scrolling was the very post
 * printed directly beneath it. This says the same thing at a glance and
 * gives the player somewhere to go.
 */
export function ChronicleCallout({ number, title, teaser, reward, unread = false, onOpen }: Props) {
  return (
    <section className={`news-callout${unread ? ' news-callout--unread' : ''}`}>
      <Icon name="chronicle" size={24} className="news-callout__icon" />
      <div className="news-callout__text">
        <span className="news-callout__eyebrow">
          {unread ? 'New chapter' : 'Latest chapter'} · Fracture Chronicle
        </span>
        <span className="news-callout__title">Chapter {number} — {title}</span>
        <span className="news-callout__teaser">{teaser}</span>
        <span className="news-callout__reward">Complete its challenge to earn {reward}</span>
      </div>
      {onOpen && (
        <Button className="action-btn--gold news-callout__cta" onClick={onOpen}>Read</Button>
      )}
    </section>
  )
}
