import React from 'react'
import { PageHeader } from './PageHeader'

interface Props {
  title: string
  onBack: () => void
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function OverlayScreen({ title, onBack, right, children, className = 'overlay-screen u-col u-grow' }: Props) {
  return (
    <div className={className}>
      <PageHeader title={title} onBack={onBack} right={right} />
      {children}
    </div>
  )
}
