import React from 'react'
import { Button } from '../BuildingBlocks/Button'
import type { QuickBattleMode } from '../../game/campaignHelpers'

export type { QuickBattleMode }


interface Props {
  onStartBattle: (mode: QuickBattleMode) => void
  onBack: () => void
}

export function QuickBattleScreen({ onStartBattle, onBack }: Props) {

  const d20 = Math.random()

  return (
    <div className="qb-screen">
      <div className="qb-header u-text-c">
        <div className="qb-title">⚔  QUICK BATTLE</div>
        <div className="qb-subtitle">Choose your difficulty</div>
      </div>

      <div className="qb-options u-col">
        <div className="qb-option u-col u-gap-5">
          <Button className="action-btn" onClick={() => onStartBattle('easy')}>
            ▶  PLAY EASY
          </Button>
          <div className="qb-option-desc">
            <p>Opponent has a handicap; play at normal speed.</p>
            <p>Reward: standard card pack (2 cards).</p>
          </div>

        </div>

        <div className="qb-option u-col u-gap-5">
          <Button className="action-btn" onClick={() => onStartBattle('normal')}>
            ▶  PLAY NORMAL
          </Button>
          <div className="qb-option-desc">
            <p>Opponent builds their deck from cards you own.</p>
            <p>Reward: standard card pack (5 cards).</p>
          </div>

        </div>

        <div className="qb-option u-col u-gap-5">
          <Button className="action-btn" onClick={() => onStartBattle('mirror')}>
            ▶  PLAY MIRROR DECK
          </Button>
          <div className="qb-option-desc">
            <p>Opponent uses a copy of your own deck.</p>
            <p>Reward: standard card pack (5 cards).</p>
          </div>

        </div>
        <div className="qb-option u-col u-gap-5">
          {
            getRandomMode(onStartBattle, d20)
          }
        </div>
      </div>

      <button className="action-btn action-btn--danger" onClick={onBack}>← BACK</button>
    </div>
  )
}

function getRandomMode(onStartBattle: (mode: QuickBattleMode) => void, d20: number) {
  const modes: JSX.Element[] = []

 modes[0] = (
      <>  
        <Button className="action-btn" onClick={() => onStartBattle('hero-only')} variant='gold'>
          ▶  HERO ONLY
        </Button>
        <div className="qb-option-desc">
          <p>Opponent's deck consists of hero cards only.</p>
          <p>Reward: legendary card pack (5 cards).</p>
        </div></>
    )
  modes[1] = (
      <>
        <Button className="action-btn" onClick={() => onStartBattle('chaos')} variant='gold'>
          ▶  PLAY CHAOS!
        </Button>
        <div className="qb-option-desc">
          <p>Play in a chaotic environment with unpredictable outcomes.</p>
          <p>Reward: legendary card pack (2 cards).</p>
        </div></>

    )
  modes[2] = (
      <>
        <Button className="action-btn" onClick={() => onStartBattle('only-units')} variant='gold'>
          ▶  UNITS ONLY
        </Button>
        <div className="qb-option-desc">
          <p>Opponent's deck consists of units only.</p>
          <p>Reward: unit-focused card pack (3 cards).</p>
        </div></>
    )
modes[3] = (
      <>
        <Button className="action-btn" onClick={() => onStartBattle('only-spells')} variant='gold'>
          ▶  SPELLS ONLY
        </Button>
        <div className="qb-option-desc">
          <p>Opponent's deck consists of spells only.</p>
          <p>Reward: spell-focused card pack (3 cards).</p>
        </div></>
    )
 modes[4] = (
      <>
        <Button className="action-btn" onClick={() => onStartBattle('only-buildings')} variant='gold'>
          ▶  BUILDINGS ONLY
        </Button>
        <div className="qb-option-desc">
          <p>Opponent's deck consists of buildings only.</p>
          <p>Reward: building-focused card pack (3 cards).</p>
        </div></>
    ) 
  modes[5] = (
      <>
        <Button className="action-btn" onClick={() => onStartBattle('common-only')} variant='gold'>
          ▶  COMMON ONLY
        </Button>
        <div className="qb-option-desc">
          <p>Opponent's deck consists of common cards only.</p>
          <p>Reward: common card pack (5 cards).</p>
        </div></>
    ) 
modes[6] = (
      <>
        <Button className="action-btn" onClick={() => onStartBattle('uncommon-only')} variant='gold'>
          ▶  UNCOMMON ONLY
        </Button>
        <div className="qb-option-desc">
          <p>Opponent's deck consists of uncommon cards only.</p>
          <p>Reward: uncommon card pack (5 cards).</p>
        </div></>
    ) 
modes[7] = (
      <>
        <Button className="action-btn" onClick={() => onStartBattle('rare-only')} variant='gold'>
          ▶  RARE ONLY
        </Button>
        <div className="qb-option-desc">
          <p>Opponent's deck consists of rare cards only.</p>
          <p>Reward: rare card pack (5 cards).</p>
        </div></>
    ) 
modes[8] = (
      <>
        <Button className="action-btn" onClick={() => onStartBattle('legendary-only')} variant='gold'>
          ▶  LEGENDARY ONLY
        </Button>
        <div className="qb-option-desc">
          <p>Opponent's deck consists of legendary cards only.</p>
          <p>Reward: legendary card pack (5 cards).</p>
        </div></>
    ) 

  
  // 90% chance to get mode 0, 10% chance to get a random special mode
  if (d20 < 0.9) {
    return (      <>
        <Button className="action-btn" onClick={() => onStartBattle('unlimited')}>
          ▶  PLAY UNLIMITED
        </Button>
        <div className="qb-option-desc">
          <p>Play without any restrictions.</p>
          <p>Reward: rare card pack (3 cards).</p>
        </div>
      </>)
  } else {
    const index = Math.floor(Math.random() * modes.length)
    return modes[index]
  } 
}
