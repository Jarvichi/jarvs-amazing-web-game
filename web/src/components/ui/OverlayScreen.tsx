import React from 'react'
import { PageHeader } from './PageHeader'

interface Props {
  title: string
  subtitle?: string
  onBack?: () => void
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function OverlayScreen({ title, subtitle, onBack, right, children, className = 'overlay-screen u-col u-grow' }: Props) {
  return (
    <div className={className}>
      <PageHeader title={title} subtitle={subtitle} onBack={onBack} right={right} />
      {children}
    </div>
  )
}
