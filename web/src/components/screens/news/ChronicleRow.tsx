import React from 'react'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  /** Chapter number, 1-based. */
  number: number
  title: string
  /** The chapter's one-line teaser. */
  teaser: string
  /** Formatted date the chapter unlocked. */
  date: string
  /** Reward for completing the chapter's challenge, e.g. "💎 40 crystals". */
  reward: string
  unread?: boolean
  onOpen?: () => void
  onDismiss: () => void
}

/**
 * One Fracture Chronicle chapter, as a row rather than a card.
 *
 * Chapters arrive as news posts that are identical apart from a number and a
 * teaser — as full cards, half a dozen of them filled the screen with the
 * same two paragraphs of "read the new chapter and complete its challenge"
 * boilerplate. The reward and the tap target say all of that in one line.
 */
export function ChronicleRow({ number, title, teaser, date, reward, unread = false, onOpen, onDismiss }: Props) {
  const label = `Chapter ${number} — ${title}`
  const body = (
    <>
      <span className="news-chapter__icon" aria-hidden="true">📜</span>
      <span className="news-chapter__label">
        <span className="news-chapter__title">
          {label}
          {unread && <span className="news-item__new">NEW</span>}
        </span>
        <span className="news-chapter__teaser">{teaser}</span>
      </span>
      <span className="news-chapter__value">{reward}</span>
    </>
  )

  return (
    <div className={`news-chapter${unread ? ' news-chapter--unread' : ''}`}>
      {onOpen
        ? <button type="button" className="news-chapter__main news-chapter__main--tappable" onClick={onOpen}>{body}</button>
        : <div className="news-chapter__main">{body}</div>}
      <span className="news-chapter__date">{date}</span>
      <button
        type="button"
        className="news-item__dismiss"
        onClick={onDismiss}
        title="Dismiss"
        aria-label={`Dismiss ${label}`}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}
