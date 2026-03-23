import { useEffect } from 'react'

interface Props {
  smashedNames: string[]
  onDone: () => void
}

export default function FingerSmash({ smashedNames, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      pointerEvents: 'none',
    }}>
      <div style={{
        fontSize: '7rem',
        lineHeight: 1,
        animation: 'fingerSmash 1.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        transformOrigin: 'top center',
      }}>
        👇
      </div>
      {smashedNames.length > 0 && (
        <div style={{
          marginTop: '0.5rem',
          background: 'rgba(0,0,0,0.85)',
          color: '#ff5555',
          padding: '0.4rem 1rem',
          borderRadius: '6px',
          fontSize: '0.9rem',
          fontFamily: 'monospace',
          animation: 'smashFadeIn 0.25s ease 0.5s both',
          border: '1px solid #ff5555',
        }}>
          SQUISHED: {smashedNames.join(', ')}
        </div>
      )}
      <style>{`
        @keyframes fingerSmash {
          0%   { transform: translateY(-110%); }
          30%  { transform: translateY(2%); }
          50%  { transform: translateY(2%) scaleY(0.82); }
          65%  { transform: translateY(-4%) scaleY(1.06); }
          78%  { transform: translateY(0%) scaleY(1); }
          88%  { transform: translateY(0%) scaleY(1); }
          100% { transform: translateY(-110%); }
        }
        @keyframes smashFadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
