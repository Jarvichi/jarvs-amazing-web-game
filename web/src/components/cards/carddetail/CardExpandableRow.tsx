import React from 'react'

interface Props {
  labelContent: React.ReactNode
  labelClassName: string
  tagsText: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

/** One disclosure row in the strengths/weaknesses/affinity/synergy list —
 *  a label, a one-line tag summary, and a chevron that expands to the full
 *  detail text below. Replaces four near-identical hand-rolled blocks that
 *  used to live directly in CardDetailModal. */
export function CardExpandableRow({ labelContent, labelClassName, tagsText, expanded, onToggle, children }: Props) {
  return (
    <>
      <button className="cdm-sw-row u-flex u-gap-3 cdm-sw-row--btn" onClick={onToggle}>
        <span className={`cdm-sw-label ${labelClassName}`}>{labelContent}</span>
        <span className="cdm-sw-tags">{tagsText}</span>
        <span className="cdm-sw-chevron">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="cdm-sw-detail">{children}</div>
      )}
    </>
  )
}
