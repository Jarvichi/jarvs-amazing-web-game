import React from 'react'
import { Icon } from '../../ui/icons/Icon'
import type { NewsItem } from '../../../game/news'

interface Props {
  item: NewsItem
  /** Formatted date — the screen owns "today" so this stays pure. */
  date: string
  /** Not yet seen on a previous visit: earns a NEW flag. */
  unread?: boolean
  onDismiss: (id: string) => void
}

/** A full news post: meta line, title, optional image, body. */
export function NewsCard({ item, date, unread = false, onDismiss }: Props) {
  return (
    <article className={`news-item u-col u-gap-3${unread ? ' news-item--unread' : ''}`}>
      <div className="news-item__meta u-flex u-items-c u-gap-4">
        <span className="news-item__date">{date}</span>
        {unread && <span className="news-item__new">NEW</span>}
        {item.tag && <span className="news-item__tag">{item.tag}</span>}
        <button
          type="button"
          className="news-item__dismiss"
          onClick={() => onDismiss(item.id)}
          title="Dismiss"
          aria-label={`Dismiss ${item.title}`}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <h3 className="news-item__title">{item.title}</h3>
      {item.imageUrl && (
        <img className="news-item__image" src={item.imageUrl} alt={item.title} />
      )}
      <div className="news-item__body">{item.body}</div>
    </article>
  )
}
