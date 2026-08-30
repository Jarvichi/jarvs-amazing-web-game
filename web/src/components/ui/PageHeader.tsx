import React from 'react'
import { Button } from './Button'
import { Icon } from './icons/Icon'

export interface Props {
    title: React.ReactNode | string
    subtitle?: string
    onBack?: () => void
    right?: React.ReactNode
    /** Accessible name / tooltip for the back control. Defaults to "Back". */
    backLabel?: string
}

/**
 * Standard screen header: back control, title (+ optional subtitle), and a
 * right-hand slot for per-screen status.
 *
 * The back control is icon-only. It used to be a full-size "← BACK" text
 * button, which cost ~95px of width in every one of the 40 screens that
 * render an OverlayScreen — enough to push subtitles and right-slot status
 * onto a second line on a phone. The square icon button keeps the same 44px
 * touch target on coarse pointers (see .page-back-btn in panels.css) and
 * hands the reclaimed width back to the title.
 *
 * Layout is a three-column grid (see .overlay-header in panels.css) rather
 * than a flex row, so the title sits centred over the screen instead of
 * being pushed off to whatever width the back button leaves. Both side cells
 * are always rendered — an empty one still holds its column, which is what
 * keeps a title centred on the screens that pass no back control or no
 * right-hand slot.
 */
export function PageHeader({ title, subtitle, onBack, right, backLabel = 'Back' }: Props) {
    return (
        <div className="overlay-header">
            <div className="overlay-header__side">
                {onBack && (
                    <Button
                        className="page-back-btn"
                        onClick={onBack}
                        title={backLabel}
                        aria-label={backLabel}
                    >
                        <Icon name="back-arrow" size={20} />
                    </Button>
                )}
            </div>
            <div className="overlay-header__title u-col">
                <span className="overlay-title">{title}</span>
                {subtitle && <span className="nm-act-sub">{subtitle}</span>}
            </div>
            <div className="overlay-header__side overlay-header__side--right">{right}</div>
        </div>
    )
}
