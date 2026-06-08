import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubInteriorViewer } from './HubInteriorViewer'
import { IRONHOLDKEEP, MILLHAVE, RAVENWATCH } from '../../data/hub/hubWorldFactory'

const meta = {
  component: HubInteriorViewer,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HubInteriorViewer>

export default meta
type Story = StoryObj<typeof meta>

const INTERIORS =  {  ...RAVENWATCH.HUB_INTERIORS,  ...IRONHOLDKEEP.HUB_INTERIORS,  ...MILLHAVE.HUB_INTERIORS}
const INTERIORS_KEYS = Object.keys( INTERIORS)

const INTERIOR_NPCS = {
    ...RAVENWATCH.INTERIOR_NPCS,
  ...IRONHOLDKEEP.INTERIOR_NPCS,
  ...MILLHAVE.INTERIOR_NPCS
}

// ── Browser: pick any interior from a dropdown ─────────────────────────────

export const Browser: Story = {
  args: { interior: INTERIORS[INTERIORS_KEYS[0]], interior_npcs: []},
  render: () => {
    const [selected, setSelected] = useState(INTERIORS[INTERIORS_KEYS[0]] ? INTERIORS[INTERIORS_KEYS[0]].id  : "Not Found")
    const interior = Object.values(INTERIORS).filter((interior)=> interior.id ? interior.id === selected : null)
    const interiorID =  interior[0].id ?? ""
    const interior_npc = interiorID !== "" ? INTERIOR_NPCS[interiorID] : []

    return (
      <div style={{ fontFamily: 'monospace', padding: 20, background: '#0a0e0a', minHeight: '100vh', color: '#88cc88' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>Hub Interior Browser</strong>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            style={{ background: '#111', color: '#88cc88', border: '1px solid #446644', padding: '4px 10px', fontFamily: 'monospace', fontSize: 13 }}
          >
  {Object.values(INTERIORS).map(interior => (
    <option key={interior.id ?? "Not Found"} value={interior.id ?? "Not Found"}>
      {interior.id ?? "Not Found"} — {interior.name}
    </option>
  ))}            

          </select>
          <span style={{ color: '#446644', fontSize: 12 }}>
            {interior[0].width}×{interior[0].height} tiles · {interior[0].decor.length} decor items
          </span>
        </div>
        {/* key forces remount when interiorId changes so PixiJS reinitialises */}
        <HubInteriorViewer key={selected} interior={interior[0]} interior_npcs={interior_npc} scale={2} />
      </div>
    )
  },
}

// ── One story per interior ─────────────────────────────────────────────────

// export const CardShop: Story        = { name: 'card-shop',        args: {  interior: RAVENWATCH.HUB_INTERIORS[0], interior_npcs: RAVENWATCH.INTERIOR_NPCS,     scale: 2 } }
// export const AugmentShop: Story     = { name: 'augment-shop',     args: {  currentLocation: RAVENWATCH,interiorId: 'augment-shop',     scale: 2 } }
// export const SupplyShop: Story      = { name: 'supply-shop',      args: { currentLocation: RAVENWATCH, interiorId: 'supply-shop',      scale: 2 } }
// export const ScholarsHall: Story    = { name: 'scholars-hall',    args: { currentLocation: RAVENWATCH, interiorId: 'scholars-hall',    scale: 2 } }
// export const Home: Story            = { name: 'home',             args: { currentLocation: RAVENWATCH, interiorId: 'home',             scale: 2 } }
// export const TraderDen: Story       = { name: 'trader-den',       args: { currentLocation: RAVENWATCH, interiorId: 'trader-den',       scale: 2 } }
// export const ScholarsNorthW: Story  = { name: 'scholars-north-w', args: { currentLocation: RAVENWATCH, interiorId: 'scholars-north-w', scale: 2 } }
// export const ScholarsNorthE: Story  = { name: 'scholars-north-e', args: { currentLocation: RAVENWATCH, interiorId: 'scholars-north-e', scale: 2 } }
// export const ScholarsHallW: Story   = { name: 'scholars-hall-w',  args: { currentLocation: RAVENWATCH, interiorId: 'scholars-hall-w',  scale: 2 } }
// export const SwBuildingB: Story     = { name: 'inn-building',    args: { currentLocation: RAVENWATCH, interiorId: 'inn-building',    scale: 2 } }
// export const TradersBuilding: Story = { name: 'traders-building', args: { currentLocation: RAVENWATCH, interiorId: 'traders-building', scale: 2 } }
// export const MarketBuilding: Story  = { name: 'market-building',  args: { currentLocation: RAVENWATCH, interiorId: 'market-building',  scale: 2 } }
// export const ArcadeBuildingE: Story = { name: 'arcade-building-e',args: {  currentLocation: RAVENWATCH,interiorId: 'arcade-building-e',scale: 2 } }
// export const ArcadeBuildingW: Story = { name: 'arcade-building-w',args: { currentLocation: RAVENWATCH, interiorId: 'arcade-building-w',scale: 2 } }
// export const BarracksNorth: Story   = { name: 'barracks-north',   args: {  currentLocation: RAVENWATCH,interiorId: 'barracks-north',   scale: 2 } }
// export const BarracksSouth: Story   = { name: 'barracks-south',   args: { currentLocation: RAVENWATCH, interiorId: 'barracks-south',   scale: 2 } }
// export const BarracksVault: Story   = { name: 'barracks-vault',   args: { currentLocation: RAVENWATCH, interiorId: 'barracks-vault',   scale: 2 } }
// export const TownHall: Story        = { name: 'town-hall',        args: { currentLocation: RAVENWATCH, interiorId: 'town-hall',        scale: 2 } }

