import React, { ReactNode } from 'react'

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar u-flex u-items-c u-just-l u-wrap">{children}</div>
}
