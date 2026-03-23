import React, { useState, useEffect, useCallback } from 'react'
import {
  CommanderState,
  PetAction,
  canInteract,
  cooldownRemaining,
  recordInteraction,
  rollCommanderReward,
  saveCommander,
  formatCooldown,
  promotionsRemainingToday,
  clearCommander,
} from '../game/commander'
import { AnimatedSpriteImg } from './SpriteImg'
import { OverlayScreen } from './OverlayScreen'

interface Props {
  commander: CommanderState
  onBack: () => void
  onRewardXp: (cardName: string, amount: number) => void
  onRewardCrystals: (amount: number) => void
  onRewardCard: () => void
  onRewardPack: () => void
  onCommanderChanged: (state: CommanderState | null) => void
}

interface Toast {
  id: number
  text: string
}

const ACTION_LABELS: Record<PetAction, string> = {
  feed: '🍖 Feed',
  play: '⚔ Train',
  pet:  '✨ Inspire',
}

const ACTION_FLAVOR: Record<PetAction, string[]> = {
  feed: [
    'Your commander devours the rations eagerly.',
    'They nod appreciatively at the meal.',
    'Strength restored.',
  ],
  play: [
    'A quick sparring session keeps the blade sharp.',
    'They laugh as they best you in a duel.',
    'Training complete — skills honed.',
  ],
  pet: [
    'A morale boost ripples through the ranks.',
    'Your words stir a fire in their eyes.',
    'Inspired and ready for battle.',
  ],
}

let toastSeq = 0

export function CommanderScreen({
  commander,
  onBack,
  onRewardXp,
  onRewardCrystals,
  onRewardCard,
  onRewardPack,
  onCommanderChanged,
}: Props) {
  const [state, setState] = useState<CommanderState>(commander)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [cooldowns, setCooldowns] = useState<Record<PetAction, number>>({ feed: 0, play: 0, pet: 0 })
  const [confirmDismiss, setConfirmDismiss] = useState(false)

  // Tick cooldown display every second
  useEffect(() => {
    const id = setInterval(() => {
      setCooldowns({
        feed: cooldownRemaining(state, 'feed'),
        play: cooldownRemaining(state, 'play'),
        pet:  cooldownRemaining(state, 'pet'),
      })
    }, 1000)
    return () => clearInterval(id)
  }, [state])

  function addToast(text: string) {
    const id = ++toastSeq
    setToasts(prev => [...prev, { id, text }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const handleAction = useCallback((action: PetAction) => {
    if (!canInteract(state, action)) return

    const reward = rollCommanderReward()
    const next   = recordInteraction(state, action)
    setState(next)
    saveCommander(next)

    // Flavor text
    const flavors = ACTION_FLAVOR[action]
    addToast(flavors[Math.floor(Math.random() * flavors.length)])

    // Reward
    if (reward.type === 'xp') {
      onRewardXp(state.cardName, reward.amount)
      addToast(`+${reward.amount} mastery XP for ${state.cardName}!`)
    } else if (reward.type === 'crystals') {
      onRewardCrystals(reward.amount)
      addToast(`+${reward.amount} 💎 found!`)
    } else if (reward.type === 'card') {
      onRewardCard()
      addToast('They found a card on patrol!')
    } else if (reward.type === 'pack') {
      onRewardPack()
      addToast('They returned with a card pack!')
    }
  }, [state, onRewardXp, onRewardCrystals, onRewardCard, onRewardPack])

  function handleDismiss() {
    clearCommander()
    onCommanderChanged(null)
  }

  const promosLeft = promotionsRemainingToday()

  return (
    <OverlayScreen title="COMMANDER'S QUARTERS" onBack={onBack}>
      {/* Commander home scene */}
      <div className="commander-scene">
        <div className="commander-scene-bg">
          <div className="commander-scene-floor" />
          <div className="commander-scene-wall" />
        </div>

        {/* Sprite */}
        <div className="commander-sprite-wrap">
          <AnimatedSpriteImg
            name={state.cardName}
            frameCount={3}
            fps={2}
            className="commander-sprite"
          />
        </div>

        <div className="commander-name">{state.cardName}</div>
        <div className="commander-subtitle">Army Commander</div>
      </div>

      {/* Toast messages */}
      <div className="commander-toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className="commander-toast">{t.text}</div>
        ))}
      </div>

      {/* Actions */}
      <div className="commander-actions">
        {(['feed', 'play', 'pet'] as PetAction[]).map(action => {
          const ready = cooldowns[action] === 0
          return (
            <button
              key={action}
              className={`action-btn${ready ? '' : ' action-btn--disabled'}`}
              onClick={() => handleAction(action)}
              disabled={!ready}
              title={ready ? undefined : `Ready in ${formatCooldown(cooldowns[action])}`}
            >
              {ACTION_LABELS[action]}
              {!ready && (
                <span className="commander-cd"> {formatCooldown(cooldowns[action])}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="commander-hint">
        Interact to earn mastery XP, crystals, cards, or packs.<br />
        Each action has a 30-minute cooldown.
      </div>

      {/* Dismiss section */}
      <div className="commander-dismiss-wrap">
        {!confirmDismiss ? (
          <button className="action-btn action-btn--danger" onClick={() => setConfirmDismiss(true)}>
            Dismiss Commander
          </button>
        ) : (
          <div className="commander-confirm">
            <span>Dismiss {state.cardName}? ({promosLeft} promotion{promosLeft !== 1 ? 's' : ''} left today)</span>
            <button className="action-btn action-btn--danger" onClick={handleDismiss}>Confirm</button>
            <button className="action-btn" onClick={() => setConfirmDismiss(false)}>Cancel</button>
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
