import React from 'react'
import rollbar from '../rollbar'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Top-level error boundary: reports render errors to Rollbar (with component
 * stack) and shows a reload fallback instead of silently unmounting the app.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    rollbar?.error(error, { componentStack: info.componentStack })
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16, textAlign: 'center',
      }}>
        <div className="title-logo">JARV'S</div>
        <p>Something went wrong. The error has been reported.</p>
        <button className="action-btn" onClick={() => window.location.reload()}>
          RELOAD
        </button>
      </div>
    )
  }
}
