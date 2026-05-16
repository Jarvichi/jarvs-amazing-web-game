import { TDAttackEvent } from "../../../game/towerDefence"
export interface Props { ev: TDAttackEvent }

const TRAVEL_MS: Partial<Record<string, number>> = { lightning: 150 }
const DEFAULT_TRAVEL_MS = 500

export function AttackEffect({ ev }: Props) {
    const dx = ev.toX - ev.fromX
    const dy = ev.toY - ev.fromY
    const len = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    const pType = ev.projectileType ?? 'magic'
    const hitDelay = `${((TRAVEL_MS[pType] ?? DEFAULT_TRAVEL_MS) * 0.8) / 1000}s`

    // AOE ring: no travel line, just an expanding ring at target
    if (pType === 'aoe' || (ev.aoeRadius && len < 2)) {
        const r = ev.aoeRadius ?? 48
        return (
            <div
                className="anim-aoe-ring"
                style={{
                    position: 'absolute',
                    left: ev.toX - r,
                    top: ev.toY - r,
                    width: r * 2,
                    height: r * 2,
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    zIndex: 16,
                }}
            />
        )
    }

    return (
        <>
            {/* Projectile line — typed class drives colour/thickness */}
            <div
                className={`anim-projectile anim-projectile--${pType}`}
                style={{
                    position: 'absolute',
                    left: ev.fromX,
                    top: ev.fromY,
                    width: len,
                    transform: `translate(0, -50%) rotate(${angle}deg)`,
                    transformOrigin: '0 50%',
                    pointerEvents: 'none',
                    zIndex: 15,
                }}
            />
            {/* Hit spark — typed class drives colour; delayed to match projectile arrival */}
            <div
                className={`anim-hit anim-hit--${pType}`}
                style={{
                    position: 'absolute',
                    left: ev.toX,
                    top: ev.toY,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 16,
                    animationDelay: hitDelay,
                }}
            />
        </>
    )
}
