import React from 'react'

interface Props {
  line:    string | null
  onClose: () => void
}

export function HubDialogue({ line, onClose }: Props) {
  return (
    <div
      style={{
        position:       'absolute',
        bottom:          56,
        left:           '50%',
        transform:      'translateX(-50%)',
        width:          'calc(100% - 40px)',
        maxWidth:        440,
        pointerEvents:  line ? 'auto' : 'none',
        opacity:        line ? 1 : 0,
        transition:     'opacity 0.25s ease',
        zIndex:          10,
      }}
    >
      <div style={{
        background:   'rgba(8,14,8,0.93)',
        border:       '1px solid #446644',
        padding:      '10px 14px',
        display:      'flex',
        alignItems:   'flex-start',
        gap:           12,
      }}>
        <div style={{
          flex:          1,
          fontSize:      13,
          color:         '#c8e8c8',
          letterSpacing: '0.03em',
          lineHeight:     1.55,
        }}>
          {line ?? ''}
        </div>
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
            flexShrink:     0,
            marginTop:      1,
          }}
        >
          OK
        </button>
      </div>
    </div>
  )
}
