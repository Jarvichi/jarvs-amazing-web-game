import { TDHazard } from "../../../game/towerDefence"

export interface Props { hazard: TDHazard }

export function HazardCloud({ hazard }: Props) {
  const d = hazard.radius * 2
  return (
    <div
      className="td-hazard"
      style={{
        position: 'absolute',
        left: hazard.x - hazard.radius,
        top:  hazard.y - hazard.radius,
        width: d,
        height: d,
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 8,
      }}
    />
  )
}