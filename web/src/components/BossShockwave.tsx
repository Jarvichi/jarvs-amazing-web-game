import { useEffect } from 'react'

interface Props {
  onDone: () => void
}

export default function BossShockwave({ onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Full-screen flash burst */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(255, 80, 0, 0.18)',
        animation: 'bossShockwaveFlash 0.4s ease-out both',
      }} />
      {/* Three expanding ripple rings, staggered */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          left: '72%',
          top: '50%',
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255, 100, 20, 0.9)',
          borderRadius: '50%',
          animation: `bossShockwaveRing 1.1s ease-out ${i * 0.18}s both`,
        }} />
      ))}
      <style>{`
        @keyframes bossShockwaveFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes bossShockwaveRing {
          0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(18); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
