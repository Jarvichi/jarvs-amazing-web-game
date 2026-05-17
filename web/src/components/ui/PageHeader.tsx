import React from 'react'
export interface Props {
    title: React.ReactNode | string
    onBack: () => void
    right?: React.ReactNode
}

export function PageHeader({ title, onBack, right }: Props) {
    return (
        <div className="overlay-header u-flex u-items-c u-gap-6">
            {onBack && <button className="action-btn" onClick={onBack}>← BACK</button>}
            <span className="overlay-title">{title}</span>
            {right}
        </div>
    )
}