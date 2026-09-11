      
      import { Icon } from '../ui/icons/Icon'

      export interface WinStreakProps {
        winStreak: number;
        bestStreak: number;
        }
      
      export function WinStreak({ winStreak, bestStreak }: WinStreakProps) {
        return (
          <>
      
      {/* Win streak ribbon (top-left corner) */}
      {winStreak > 0 && (
        <div className="streak-ribbon-wrap">
          <div className="streak-ribbon">🔥 {winStreak}</div>
        </div>
      )}
      {bestStreak > 1 && winStreak === 0 && (
        <div className="streak-ribbon-wrap">
          <div className="streak-ribbon streak-ribbon--faded"><Icon name="trophy" size={13} /> {bestStreak}</div>
        </div>
      )}
            </>
        )
        }