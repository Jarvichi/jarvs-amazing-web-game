import React from 'react'

export interface DialogueChoice {
  label: string
  onClick: () => void
  primary?: boolean
}

interface Props {
  line:         string | null
  onClose:      () => void
  speakerName?: string
  choices?:     DialogueChoice[]
}

export function HubDialogue({ line, onClose, speakerName, choices }: Props) {
  return (
    <div
      style={{
        position:      'absolute',
        bottom:         56,
        left:          '50%',
        transform:     'translateX(-50%)',
        width:         'calc(100% - 40px)',
        maxWidth:       440,
        pointerEvents: line ? 'auto' : 'none',
        opacity:       line ? 1 : 0,
        transition:    'opacity 0.25s ease',
        zIndex:         10,
      }}
    >
      <div style={{
        background:  'rgba(8,14,8,0.93)',
        border:      '1px solid #446644',
        padding:     '10px 14px',
      }}>
        {speakerName && (
          <div style={{
            fontSize:      10,
            color:         '#88cc88',
            letterSpacing: '0.12em',
            marginBottom:   6,
            textTransform: 'uppercase',
          }}>
            {speakerName}
          </div>
        )}
        <div style={{
          fontSize:      13,
          color:         '#c8e8c8',
          letterSpacing: '0.03em',
          lineHeight:     1.55,
          marginBottom:  choices && choices.length > 0 ? 10 : 0,
        }}>
          {line ?? ''}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          {choices && choices.length > 0
            ? choices.map(c => (
                <button
                  key={c.label}
                  onClick={c.onClick}
                  style={{
                    background:    c.primary ? 'rgba(68,102,68,0.6)' : 'none',
                    border:        '1px solid #446644',
                    color:         c.primary ? '#c8e8c8' : '#88cc88',
                    fontSize:       10,
                    padding:       '4px 12px',
                    cursor:        'pointer',
                    letterSpacing: '0.12em',
                  }}
                >
                  {c.label}
                </button>
              ))
            : (
                <button
                  onClick={onClose}
                  style={{
                    background:    'none',
                    border:        '1px solid #446644',
                    color:         '#88cc88',
                    fontSize:       10,
                    padding:       '3px 10px',
                    cursor:        'pointer',
                    letterSpacing: '0.12em',
                  }}
                >
                  OK
                </button>
              )
          }
        </div>
      </div>
    </div>
  )
}
