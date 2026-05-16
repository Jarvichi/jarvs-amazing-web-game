import { TDGameState, TD_TOTAL_WAVES } from "../../../game/towerDefence";



export interface Props {
    game: TDGameState
    reward: number
    onDone: (reward: number) => void;
    rewardLabel: string
}

  export function TowerDefenceEndScreen({ game, reward, onDone, rewardLabel }: Props) {
    const won = game.phase === 'victory'
    return (
      <div className="td-end-screen u-col u-items-c u-just-c u-gap-7 u-text-c">
        <div className={`td-end-title ${won ? 'td-end-title--win' : 'td-end-title--lose'}`}>
          {won ? '⚔ VICTORY!' : '💀 DEFEATED'}
        </div>
        <div className="td-end-stat">Waves cleared: {game.wavesCompleted} / {TD_TOTAL_WAVES}</div>
        <div className="td-end-stat">Score: {game.score.toLocaleString()}</div>
        <div className="td-end-reward">Reward: {rewardLabel}</div>
        <button className="action-btn action-btn--gold" onClick={() => onDone(reward)}>
          COLLECT &amp; EXIT
        </button>
      </div>
    )
  }