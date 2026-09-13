import React from 'react'

interface Props {
  traits: string[]
}

export function CardTraitsRow({ traits }: Props) {
  if (traits.length === 0) return null
  return (
    <div className="cdm-traits u-flex u-wrap u-gap-2">
      {traits.map(t => <span key={t} className="cdm-trait">{t}</span>)}
    </div>
  )
}
