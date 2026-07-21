import React from 'react'

/**
 * Suspense fallback shown briefly while a lazy-loaded screen's chunk fetches.
 * Styled to match ErrorBoundary's fallback so loading and error states feel
 * like the same system.
 */
export function ScreenLoadingFallback(): React.ReactElement {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 16, textAlign: 'center',
    }}>
      <div className="title-logo">JARV'S</div>
    </div>
  )
}
