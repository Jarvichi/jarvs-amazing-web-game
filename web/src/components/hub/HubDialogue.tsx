import React from 'react'

export interface DialogueChoice {
  label: string
  onClick: () => void
  primary?: boolean
  /** Visually dims the choice (e.g. an action that isn't available yet) without blocking the tap — onClick still fires so it can explain why. */
  disabled?: boolean
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
        <div
          style={
            // Single action stays inline/right-aligned; multiple branch options
            // stack vertically full-width so 3–4 choices read clearly.
            choices && choices.length > 1
              ? { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }
              : { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }
          }
        >
          {choices && choices.length > 0
            ? choices.map(c => (
                <button
                  key={c.label}
                  onClick={c.onClick}
                  style={{
                    background:    c.primary && !c.disabled ? 'rgba(68,102,68,0.6)' : 'none',
                    border:        '1px solid #446644',
                    color:         c.primary && !c.disabled ? '#c8e8c8' : '#88cc88',
                    opacity:       c.disabled ? 0.45 : 1,
                    fontSize:       10,
                    padding:       '4px 12px',
                    cursor:        c.disabled ? 'default' : 'pointer',
                    letterSpacing: '0.12em',
                    textAlign:     choices.length > 1 ? 'left' : 'center',
                    width:         choices.length > 1 ? '100%' : 'auto',
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
