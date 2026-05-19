import React from 'react'
import {
  CityState, HistorySample,
  RESOURCE_ICONS, ResourceType,
} from '../../../game/cityBuilder'
import { StatsSparkline } from './StatsSparkline'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGold(n: number): string {
  const abs = Math.abs(n)
  let s: string
  if (abs >= 1_000_000) s = `${(abs / 1_000_000).toFixed(1)}M`
  else if (abs >= 1_000) s = `${(abs / 1_000).toFixed(1)}K`
  else s = String(Math.round(abs))
  return n < 0 ? `-${s}` : s
}

function fmtDelta(n: number, isGold = false): string {
  if (n === 0) return '—'
  const str = isGold ? fmtGold(n) : String(Math.round(n))
  return n > 0 ? `+${str}` : str
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── Series colors ─────────────────────────────────────────────────────────────

const COLORS: Record<string, string> = {
  gold:   '#c8a020',
  pop:    '#40b0c0',
  def:    '#50c878',
  wheat:  '#d4a020',
  wood:   '#8b6030',
  ore:    '#9090a0',
  bread:  '#d0a84c',
  planks: '#a07040',
  metal:  '#6888a8',
}

const RES_ORDER: ResourceType[] = ['wheat', 'wood', 'ore', 'bread', 'planks', 'metal']

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StatCardProps {
  icon:    string
  label:   string
  value:   string
  delta?:  number
  isGold?: boolean
}

function StatCard({ icon, label, value, delta, isGold }: StatCardProps) {
  const deltaStr = delta !== undefined ? fmtDelta(delta, isGold) : null
  const deltaClass = !deltaStr || deltaStr === '—'
    ? 'city-stat-card-delta--zero'
    : delta! > 0 ? 'city-stat-card-delta--pos' : 'city-stat-card-delta--neg'
  return (
    <div className="city-stat-card">
      <div className="city-stat-card-label">{icon} {label}</div>
      <div className="city-stat-card-value">{value}</div>
      {deltaStr && (
        <div className={`city-stat-card-delta ${deltaClass}`}>{deltaStr}</div>
      )}
    </div>
  )
}

interface ChartSectionProps {
  title:   string
  children: React.ReactNode
}
function ChartSection({ title, children }: ChartSectionProps) {
  return (
    <div className="city-stats-section">
      <div className="city-stats-section-header">{title}</div>
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  city:   CityState
  onBack: () => void
}

export function StatsScreen({ city, onBack }: Props) {
  const history: HistorySample[] = city.history ?? []
  const n = history.length

  const latest = history[n - 1]
  const oldest = history[0]

  const extract = (key: keyof HistorySample) =>
    history.map(s => s[key] as number)

  const goldData  = extract('gold')
  const popData   = extract('pop')
  const defData   = extract('def')
  const attackMask = history.map(s => s.attacked ?? false)

  const resData: Record<ResourceType, number[]> = {
    wheat:  extract('wheat'),
    wood:   extract('wood'),
    ore:    extract('ore'),
    bread:  extract('bread'),
    planks: extract('planks'),
    metal:  extract('metal'),
  }

  // Window duration label
  const windowLabel = n >= 2
    ? `Last ${fmtDuration(latest.t - oldest.t)}`
    : n === 1 ? 'First sample' : 'No data yet'

  // Deltas (change over entire history window)
  const goldDelta = n >= 2 ? latest.gold  - oldest.gold  : 0
  const popDelta  = n >= 2 ? latest.pop   - oldest.pop   : 0
  const defDelta  = n >= 2 ? latest.def   - oldest.def   : 0

  // Time axis labels for the gold chart
  function timeLabel(i: number): string {
    if (n < 2) return ''
    const ageMs  = latest.t - history[i].t
    if (ageMs < 60_000) return 'now'
    return `${fmtDuration(ageMs)} ago`
  }

  if (n === 0) {
    return (
      <div className="city-screen u-col u-gap-2">
        <div className="city-header u-flex u-items-c u-gap-3">
          <button className="action-btn" onClick={onBack}>← BACK</button>
          <div className="city-title">📊 CITY STATS</div>
        </div>
        <div className="city-stats-empty">
          <div className="city-stats-empty-icon">📊</div>
          <div>No data yet.</div>
          <div className="city-stats-empty-hint">
            Stats are sampled every 10 minutes of play.<br />
            Check back after a little while!
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="city-screen u-relative u-col u-gap-2">
      {/* Header */}
      <div className="city-header u-flex u-items-c u-gap-3">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="city-title">📊 CITY STATS</div>
        <span className="city-stats-window-label">{windowLabel}</span>
      </div>

      {/* Scrollable content */}
      <div className="city-stats-scroll">

        {/* Summary cards */}
        <div className="city-stats-summary">
          <StatCard
            icon="💰" label="GOLD"
            value={fmtGold(latest.gold)}
            delta={goldDelta}
            isGold
          />
          <StatCard
            icon="👥" label="POP"
            value={String(latest.pop)}
            delta={popDelta}
          />
          <StatCard
            icon="🛡" label="DEFENSE"
            value={String(latest.def)}
            delta={defDelta}
          />
          <StatCard
            icon="⚔" label="ATTACKS"
            value={String(attackMask.filter(Boolean).length)}
          />
        </div>

        {/* Gold chart */}
        <ChartSection title="GOLD OVER TIME">
          <div className="city-stats-chart-wrap">
            <StatsSparkline
              data={goldData}
              attacks={attackMask}
              color={COLORS.gold}
              height={80}
              showMax
              formatMax={fmtGold}
            />
            <div className="city-stats-chart-labels">
              <span>{timeLabel(0)}</span>
              <span className="city-stats-chart-range">
                {fmtGold(Math.min(...goldData))} – {fmtGold(Math.max(...goldData))}
              </span>
              <span>now</span>
            </div>
          </div>
          {attackMask.some(Boolean) && (
            <div className="city-stats-attack-legend">
              <span className="city-sparkline-attack-mark city-sparkline-attack-mark--inline" />
              {' '}attack event
            </div>
          )}
        </ChartSection>

        {/* Resources */}
        <ChartSection title="RESOURCES">
          <div className="city-stats-res-grid">
            {RES_ORDER.map(res => {
              const d = resData[res]
              const cur = d[d.length - 1] ?? 0
              const delta = d.length >= 2 ? cur - d[0] : 0
              const allZero = d.every(v => v === 0)
              if (allZero) return null
              return (
                <div key={res} className="city-stats-res-cell">
                  <div className="city-stats-res-label">
                    {RESOURCE_ICONS[res]} {res.toUpperCase()}
                  </div>
                  <div className="city-stats-chart-wrap city-stats-chart-wrap--sm">
                    <StatsSparkline
                      data={d}
                      color={COLORS[res]}
                      height={40}
                      showMax
                    />
                  </div>
                  <div className="city-stats-res-footer">
                    <span className="city-stats-res-cur">{Math.floor(cur)}</span>
                    <span className={`city-stats-res-delta ${delta > 0 ? 'city-stat-card-delta--pos' : delta < 0 ? 'city-stat-card-delta--neg' : 'city-stat-card-delta--zero'}`}>
                      {fmtDelta(delta)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </ChartSection>

        {/* Population & Defense */}
        <ChartSection title="POPULATION &amp; DEFENSE">
          <div className="city-stats-duo">
            <div>
              <div className="city-stats-res-label">👥 POPULATION</div>
              <div className="city-stats-chart-wrap">
                <StatsSparkline data={popData} color={COLORS.pop} height={50} showMax />
              </div>
              <div className="city-stats-chart-labels">
                <span>{Math.min(...popData)}</span>
                <span></span>
                <span>{Math.max(...popData)}</span>
              </div>
            </div>
            <div>
              <div className="city-stats-res-label">🛡 DEFENSE</div>
              <div className="city-stats-chart-wrap">
                <StatsSparkline data={defData} color={COLORS.def} height={50} showMax />
              </div>
              <div className="city-stats-chart-labels">
                <span>{Math.min(...defData)}</span>
                <span></span>
                <span>{Math.max(...defData)}</span>
              </div>
            </div>
          </div>
        </ChartSection>

      </div>
    </div>
  )
}
