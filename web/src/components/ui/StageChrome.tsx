import React, { ReactNode } from 'react'

interface Props {
  /** The toolbar, floated over the top of the stage. */
  bar: ReactNode
  /** Set when the stage bleeds past .game-container's gutter, so the bar can
   *  put that gutter back and stay aligned with chrome on other screens
   *  rather than butting up against the screen edge. */
  bleed?: boolean
  /** Overlays that must clear the bar — a minimap, corner buttons. They
   *  anchor to the area *below* the bar, so `top: 16px` on a child means
   *  16px under the bar rather than 16px under the top of the screen. */
  children?: ReactNode
}

/**
 * Floats a toolbar over a full-bleed stage (a game canvas, a node map)
 * instead of stacking above it in the flow, so the world runs the full
 * height of the screen and the chrome sits on top of it.
 *
 * The layer spans the whole stage rather than just the bar's strip, which is
 * what lets `children` sit in a flow row underneath: the bar's height is
 * whatever it happens to be — one row usually, two when it wraps on a small
 * phone — and everything below tracks it with no measuring, no CSS variable
 * to keep in sync, and nothing to go stale when the bar's contents change.
 *
 * It also means the layer covers the world, so it takes no pointer events;
 * only the bar and anything in `children` that opts back in do.
 */
export function StageChrome({ bar, bleed, children }: Props) {
  return (
    <div className={`stage-chrome${bleed ? ' stage-chrome--bleed' : ''}`}>
      <div className="stage-chrome__bar">{bar}</div>
      <div className="stage-chrome__body">{children}</div>
    </div>
  )
}
