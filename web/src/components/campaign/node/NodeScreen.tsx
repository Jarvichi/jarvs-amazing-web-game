import React from 'react'
import { PageHeader } from '../../ui/PageHeader'
import { NodeStatsStrip } from './NodeStatsStrip'

interface Stats {
  hp: number
  maxHp: number
  lives?: number
  maxLives?: number
}

interface Props {
  title: React.ReactNode
  /** The run's HP/lives, shown in the header — omitted by node screens that
   *  sit outside an active run (relic pick, replay briefing, stat upgrade,
   *  the mystery reward, the cutscene), which have no HP to show. */
  stats?: Stats
  children: React.ReactNode
  /** Primary action(s) for this node, in a consistent footer position below
   *  the scrolling content — each node still owns its own button labels and
   *  count (a single CONTINUE, a BEGIN + BACK pair, three choice buttons…). */
  actions?: React.ReactNode
}

/** The one frame every campaign run-loop screen shares (#2324) — title bar
 *  (reusing PageHeader, same as every OverlayScreen) plus a consistent
 *  content/actions layout, so the player doesn't get a different chrome on
 *  every node between two identically-framed map screens. */
export function NodeScreen({ title, stats, children, actions }: Props) {
  return (
    <div className="node-screen u-col u-grow">
      <PageHeader title={title} right={stats && <NodeStatsStrip {...stats} />} />
      <div className="node-screen-body u-col u-grow">
        {children}
      </div>
      {actions && <div className="node-screen-actions u-col u-gap-5 u-items-c">{actions}</div>}
    </div>
  )
}
