import { TDGameState, TD_TOTAL_WAVES } from "../../../game/towerDefence";
import { MinigameResultPanel } from "../MinigameResultPanel";



export interface Props {
    game: TDGameState
    reward: number
    onDone: (reward: number) => void;
    rewardLabel: string
}

  export function TowerDefenceEndScreen({ game, reward, onDone, rewardLabel }: Props) {
    const won = game.phase === 'victory'
    return (
      <div className="td-end-screen u-col u-items-c u-just-c">
        <MinigameResultPanel
          headline={won ? '⚔ VICTORY!' : '💀 DEFEATED'}
          ctaLabel="COLLECT & EXIT"
          onCta={() => onDone(reward)}
          tone={won ? 'gold' : 'ember'}
        >
          <div className="td-end-stat">Waves cleared: {game.wavesCompleted} / {TD_TOTAL_WAVES}</div>
          <div className="td-end-stat">Score: {game.score.toLocaleString()}</div>
          <div className="td-end-reward">Reward: {rewardLabel}</div>
        </MinigameResultPanel>
      </div>
    )
  }
