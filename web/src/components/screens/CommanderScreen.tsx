import React, { useState, useEffect, useCallback, useRef } from 'react'
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
} from '../../game/commander'
import { getMasteryXp, masteryProgress, loadCollection } from '../../game/collection'
import { AnimatedSpriteImg } from '../ui/SpriteImg'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Button } from '../ui/Button'

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

interface Sparkle {
  id: number
  x: number
  y: number
  emoji: string
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

const IDLE_LINES = [
  '...',
  '!',
  'Ready for battle.',
  '♪',
  'Hmm...',
  '*yawns*',
  '*stretches*',
  'When do we march?',
  '⚔',
  '*looks around*',
]

const TAP_EMOJIS = ['💖', '✨', '⭐', '💫', '❤️']
const TAP_SPEECH = ['♥', '!', '^_^', '~', '♪']

function CommanderXpBar({ xp }: { xp: number }) {
  const { level, current, needed } = masteryProgress(xp)
  const pct = needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 100
  return (
    <div className="commander-xp-wrap u-relative u-flex u-items-c u-gap-3">
      <span className="commander-xp-label">Lv.{level}</span>
      <div className="commander-xp-bar">
        <div className="commander-xp-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="commander-xp-label">{current}/{needed} XP</span>
    </div>
  )
}

let toastSeq = 0
let sparkleSeq = 0

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
  const [cooldowns, setCooldowns] = useState<Record<PetAction, number>>(() => ({
    feed: cooldownRemaining(commander, 'feed'),
    play: cooldownRemaining(commander, 'play'),
    pet:  cooldownRemaining(commander, 'pet'),
  }))
  const [confirmDismiss, setConfirmDismiss] = useState(false)
  const [masteryXp, setMasteryXp] = useState(() => getMasteryXp(loadCollection(), commander.cardName))
  const [levelUp, setLevelUp] = useState(false)
  const [spriteBounce, setSpriteBounce] = useState(false)
  const [sparkles, setSparkles] = useState<Sparkle[]>([])
  const [speechBubble, setSpeechBubble] = useState<string | null>(null)

  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gyroUpsideDownRef = useRef(false)
  const lastShakeRef = useRef(0)

  // ── Helpers ──────────────────────────────────────────────────────────────

  const showSpeechBubble = useCallback((text: string) => {
    setSpeechBubble(text)
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current)
    speechTimerRef.current = setTimeout(() => setSpeechBubble(null), 2500)
  }, [])

  const triggerBounce = useCallback(() => {
    setSpriteBounce(true)
    setTimeout(() => setSpriteBounce(false), 500)
  }, [])

  // ── Cooldown tick ─────────────────────────────────────────────────────────

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

  // ── Idle behaviour ────────────────────────────────────────────────────────

  const scheduleIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    const delay = 15000 + Math.random() * 45000
    idleTimerRef.current = setTimeout(() => {
      showSpeechBubble(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)])
      scheduleIdle()
    }, delay)
  }, [showSpeechBubble])

  useEffect(() => {
    scheduleIdle()
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current) }
  }, [scheduleIdle])

  // ── Gyroscope: upside-down + shake ────────────────────────────────────────

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0
      const upsideDown = Math.abs(beta) > 100
      if (upsideDown && !gyroUpsideDownRef.current) {
        gyroUpsideDownRef.current = true
        showSpeechBubble('Whoa! Put me down!')
        triggerBounce()
      } else if (!upsideDown) {
        gyroUpsideDownRef.current = false
      }
    }

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity
      if (!acc) return
      const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2)
      const now = Date.now()
      if (magnitude > 25 && now - lastShakeRef.current > 2000) {
        lastShakeRef.current = now
        showSpeechBubble('Aaaah! Stop shaking me!')
        triggerBounce()
      }
    }

    window.addEventListener('deviceorientation', handleOrientation)
    window.addEventListener('devicemotion', handleMotion)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [showSpeechBubble, triggerBounce])

  // ── Tap / pet sprite ──────────────────────────────────────────────────────

  function handleSpriteClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const emoji = TAP_EMOJIS[Math.floor(Math.random() * TAP_EMOJIS.length)]
    const id = ++sparkleSeq
    setSparkles(prev => [...prev, { id, x, y, emoji }])
    setTimeout(() => setSparkles(prev => prev.filter(s => s.id !== id)), 800)
    triggerBounce()
    showSpeechBubble(TAP_SPEECH[Math.floor(Math.random() * TAP_SPEECH.length)])
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function addToast(text: string) {
    const id = ++toastSeq
    setToasts(prev => [...prev, { id, text }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  // ── Action buttons ────────────────────────────────────────────────────────

  const handleAction = useCallback((action: PetAction) => {
    if (!canInteract(state, action)) return

    const reward = rollCommanderReward()
    const next   = recordInteraction(state, action)
    setState(next)
    saveCommander(next)

    const flavors = ACTION_FLAVOR[action]
    addToast(flavors[Math.floor(Math.random() * flavors.length)])

    if (reward.type === 'xp') {
      onRewardXp(state.cardName, reward.amount)
      setMasteryXp(prev => {
        const oldLevel = masteryProgress(prev).level
        const newXp    = prev + reward.amount
        const newLevel = masteryProgress(newXp).level
        if (newLevel > oldLevel) {
          setTimeout(() => {
            setLevelUp(true)
            setTimeout(() => setLevelUp(false), 2500)
          }, 300)
        }
        return newXp
      })
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

        {/* Tappable sprite */}
        <div
          className={`commander-sprite-wrap${spriteBounce ? ' commander-sprite-bounce' : ''}`}
          onClick={handleSpriteClick}
          role="button"
          aria-label="Pet your commander"
          style={{ cursor: 'pointer' }}
        >
          {sparkles.map(s => (
            <span
              key={s.id}
              className="commander-sparkle"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >{s.emoji}</span>
          ))}
          <AnimatedSpriteImg
            name={state.cardName}
            frameCount={3}
            fps={2}
            className="commander-sprite"
          />
          {speechBubble && (
            <div className="commander-speech">{speechBubble}</div>
          )}
        </div>

        {/* Level-up overlay */}
        {levelUp && (
          <div className="commander-levelup u-absolute u-flex u-items-c u-just-c">
            <span className="commander-levelup-text">⭐ LEVEL UP! ⭐</span>
          </div>
        )}

        <div className="commander-name">{state.cardName}</div>
        <div className="commander-subtitle">Army Commander</div>
        <CommanderXpBar xp={masteryXp} />
      </div>

      {/* Toast messages */}
      <div className="commander-toasts u-col u-gap-2 u-text-c" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className="commander-toast">{t.text}</div>
        ))}
      </div>

      {/* Actions */}
      <div className="commander-actions u-flex u-gap-4 u-just-c u-wrap">
        {(['feed', 'play', 'pet'] as PetAction[]).map(action => {
          const ready = cooldowns[action] === 0
          return (
            <Button
              key={action}
              onClick={() => handleAction(action)}
              disabled={!ready}
              title={ready ? undefined : `Ready in ${formatCooldown(cooldowns[action])}`}
            >
              {ACTION_LABELS[action]}
              {!ready && (
                <span className="commander-cd"> {formatCooldown(cooldowns[action])}</span>
              )}
            </Button>
          )
        })}
      </div>

      <div className="commander-hint">
        Interact to earn mastery XP, crystals, cards, or packs.<br />
        Each action has a 30-minute cooldown.
      </div>

      {/* Dismiss section */}
      <div className="commander-dismiss-wrap u-flex u-just-c">
        {!confirmDismiss ? (
          <Button variant="danger" onClick={() => setConfirmDismiss(true)}>
            Dismiss Commander
          </Button>
        ) : (
          <div className="commander-confirm u-flex u-items-c u-gap-4 u-wrap u-just-c">
            <span>Dismiss {state.cardName}? ({promosLeft} promotion{promosLeft !== 1 ? 's' : ''} left today)</span>
            <Button variant="danger" onClick={handleDismiss}>Confirm</Button>
            <Button onClick={() => setConfirmDismiss(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
