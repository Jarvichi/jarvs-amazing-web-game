import React from 'react'
import { ModalBackdrop } from '../../ui/ModalBackdrop'
import { isSatisfied, type ItemDetail } from '../../../game/hub/satchelItems'
import { ListRow } from './ListRow'
import { GroupHeading } from './GroupHeading'
import { EntityChip } from './EntityChip'
import { SatchelEmpty } from './SatchelSheet'

interface Props {
  detail: ItemDetail
  onClose: () => void
}

/** What one item is for, and who deals in it.
 *
 *  The trade journal already knew who sells and buys what — it was just filed
 *  in a different tab from the item itself, so the question "where do I get
 *  more of these?" had no answer at the point it gets asked. */
export function ItemDetailSheet({ detail, onClose }: Props) {
  const { item, sellers, buyers } = detail
  const nothingKnown = !item.need && sellers.length === 0 && buyers.length === 0

  return (
    <ModalBackdrop onClose={onClose} title={item.name}>
      <div className="satchel-sheet satchel-sheet--detail">
        <header className="satchel-sheet__header">
          <h2 className="satchel-sheet__title">
            <span aria-hidden="true">{item.icon}</span> {item.name}
          </h2>
          <span className="satchel-sheet__meta">
            {item.need ? `${item.count}/${item.need.required}` : `×${item.count}`}
          </span>
          <button type="button" className="satchel-sheet__close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="satchel-sheet__body">
          {item.need && (
            <>
              <GroupHeading tone={isSatisfied(item) ? 'gold' : 'default'}>Wanted for</GroupHeading>
              <ListRow
                icon="📜"
                title={item.need.questTitle}
                subtitle={isSatisfied(item) ? 'You have enough — hand it in.' : `${item.count} of ${item.need.required} gathered`}
                progress={{ current: item.count, required: item.need.required }}
              />
            </>
          )}

          {sellers.length > 0 && (
            <>
              <GroupHeading count={sellers.length}>Sold by</GroupHeading>
              {sellers.map(s => (
                <ListRow
                  key={`${s.speaker}:${s.town}`}
                  icon="🪙"
                  title={s.speaker}
                  subtitle={<EntityChip label={s.town} icon="🧭" tone="quiet" />}
                  value={`${s.price} ${s.currency === 'tickets' ? '🎫' : '💎'}`}
                />
              ))}
            </>
          )}

          {buyers.length > 0 && (
            <>
              <GroupHeading count={buyers.length}>Wanted by</GroupHeading>
              {buyers.map(b => (
                <ListRow
                  key={`${b.speaker}:${b.town}`}
                  icon="🤝"
                  title={b.speaker}
                  subtitle={<EntityChip label={b.town} icon="🧭" tone="quiet" />}
                  value={b.rewardSummary}
                />
              ))}
            </>
          )}

          {nothingKnown && (
            <SatchelEmpty>
              No one you've met deals in these yet. Ask around — the Codex records who
              buys and sells what as you find out.
            </SatchelEmpty>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}
