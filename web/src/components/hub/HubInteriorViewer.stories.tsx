import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubInteriorViewer } from './HubInteriorViewer'
import { HUB_INTERIORS } from '../../data/hub/loader'

const meta = {
  component: HubInteriorViewer,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HubInteriorViewer>

export default meta
type Story = StoryObj<typeof meta>

const INTERIOR_IDS = Object.keys(HUB_INTERIORS)

// ── Browser: pick any interior from a dropdown ─────────────────────────────

export const Browser: Story = {
  render: () => {
    const [selected, setSelected] = useState(INTERIOR_IDS[0])
    const interior = HUB_INTERIORS[selected]

    return (
      <div style={{ fontFamily: 'monospace', padding: 20, background: '#0a0e0a', minHeight: '100vh', color: '#88cc88' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>Hub Interior Browser</strong>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            style={{ background: '#111', color: '#88cc88', border: '1px solid #446644', padding: '4px 10px', fontFamily: 'monospace', fontSize: 13 }}
          >
            {INTERIOR_IDS.map(id => (
              <option key={id} value={id}>{id} — {HUB_INTERIORS[id].name}</option>
            ))}
          </select>
          <span style={{ color: '#446644', fontSize: 12 }}>
            {interior.width}×{interior.height} tiles · {interior.decor.length} decor items
          </span>
        </div>
        {/* key forces remount when interiorId changes so PixiJS reinitialises */}
        <HubInteriorViewer key={selected} interiorId={selected} scale={2} />
      </div>
    )
  },
}

// ── One story per interior ─────────────────────────────────────────────────

export const CardShop: Story        = { name: 'card-shop',        args: { interiorId: 'card-shop',        scale: 2 } }
export const AugmentShop: Story     = { name: 'augment-shop',     args: { interiorId: 'augment-shop',     scale: 2 } }
export const SupplyShop: Story      = { name: 'supply-shop',      args: { interiorId: 'supply-shop',      scale: 2 } }
export const ScholarsHall: Story    = { name: 'scholars-hall',    args: { interiorId: 'scholars-hall',    scale: 2 } }
export const Home: Story            = { name: 'home',             args: { interiorId: 'home',             scale: 2 } }
export const TraderDen: Story       = { name: 'trader-den',       args: { interiorId: 'trader-den',       scale: 2 } }
export const ScholarsNorthW: Story  = { name: 'scholars-north-w', args: { interiorId: 'scholars-north-w', scale: 2 } }
export const ScholarsNorthE: Story  = { name: 'scholars-north-e', args: { interiorId: 'scholars-north-e', scale: 2 } }
export const ScholarsHallW: Story   = { name: 'scholars-hall-w',  args: { interiorId: 'scholars-hall-w',  scale: 2 } }
export const SwBuildingB: Story     = { name: 'sw-building-b',    args: { interiorId: 'sw-building-b',    scale: 2 } }
export const TradersBuilding: Story = { name: 'traders-building', args: { interiorId: 'traders-building', scale: 2 } }
export const MarketBuilding: Story  = { name: 'market-building',  args: { interiorId: 'market-building',  scale: 2 } }
export const ArcadeBuildingE: Story = { name: 'arcade-building-e',args: { interiorId: 'arcade-building-e',scale: 2 } }
export const ArcadeBuildingW: Story = { name: 'arcade-building-w',args: { interiorId: 'arcade-building-w',scale: 2 } }
export const BarracksNorth: Story   = { name: 'barracks-north',   args: { interiorId: 'barracks-north',   scale: 2 } }
export const BarracksSouth: Story   = { name: 'barracks-south',   args: { interiorId: 'barracks-south',   scale: 2 } }
export const BarracksVault: Story   = { name: 'barracks-vault',   args: { interiorId: 'barracks-vault',   scale: 2 } }
export const TownHall: Story        = { name: 'town-hall',        args: { interiorId: 'town-hall',        scale: 2 } }

