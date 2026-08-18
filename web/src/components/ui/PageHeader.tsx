import React from 'react'
import { Button } from './Button'
export interface Props {
    title: React.ReactNode | string
      subtitle?: string
    onBack?: () => void
    right?: React.ReactNode
}

export function PageHeader({ title, subtitle, onBack, right }: Props) {
    return (
        <div className="overlay-header u-flex u-items-c u-gap-6">
            {onBack && <Button onClick={onBack}>← BACK</Button>}
                    <div className="nm-act-label u-col u-grow">
            <span className="overlay-title">{title}</span>
            {subtitle && <span className="nm-act-sub">{subtitle}</span>}
            </div>
            {right}
        </div>
    )
}