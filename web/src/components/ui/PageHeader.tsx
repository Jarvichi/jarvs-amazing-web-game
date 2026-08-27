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
 */
export function PageHeader({ title, subtitle, onBack, right, backLabel = 'Back' }: Props) {
    return (
        <div className="overlay-header u-flex u-items-c u-gap-6">
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
            <div className="nm-act-label u-col u-grow">
                <span className="overlay-title">{title}</span>
                {subtitle && <span className="nm-act-sub">{subtitle}</span>}
            </div>
            {right}
        </div>
    )
}
