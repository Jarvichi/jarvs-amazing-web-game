import React from 'react'
import { GiftDef, rewardSummary } from '../../game/gifts'

interface Props {
  gifts: GiftDef[]
  onClaim: () => void
}

export function GiftClaimModal({ gifts, onClaim }: Props) {
  return (
    <div className="daily-modal-backdrop" onClick={onClaim}>
      <div className="daily-modal" onClick={e => e.stopPropagation()}>
        <div className="daily-modal-header">✦ GIFT RECEIVED ✦</div>
        <div className="daily-modal-sub">The developer has sent you a gift!</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', margin: '12px 0' }}>
          {gifts.map(gift => (
            <div key={gift.id} style={{ borderTop: '1px solid rgba(255,200,50,0.3)', paddingTop: '10px' }}>
              <div className="daily-modal-value" style={{ fontSize: '13px', marginBottom: '4px' }}>
                🎁 {gift.name}
              </div>
              <div className="daily-modal-desc" style={{ marginBottom: '6px' }}>
                {gift.description}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {gift.rewards.map((r, i) => (
                  <div key={i} className="daily-modal-desc" style={{ color: '#ffcc00' }}>
                    + {rewardSummary(r)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button className="action-btn action-btn--gold" onClick={onClaim}>
          CLAIM ALL ✓
        </button>
      </div>
    </div>
  )
}
