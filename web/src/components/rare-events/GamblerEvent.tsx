import React, { useState, useMemo } from 'react'
import { RareEventEffect } from './types'

interface Props {
  onDone: (effect: RareEventEffect) => void
}

const GAMBLER_KEY = 'jarv_gambler'

interface GamblerHistory {
  encountered: boolean
  lost: boolean
}

function loadGamblerHistory(): GamblerHistory {
  try {
    const raw = localStorage.getItem(GAMBLER_KEY)
    if (raw) return JSON.parse(raw) as GamblerHistory
  } catch { /* ignore */ }
  return { encountered: false, lost: false }
}

function saveGamblerHistory(h: GamblerHistory): void {
  try { localStorage.setItem(GAMBLER_KEY, JSON.stringify(h)) } catch { /* ignore */ }
}

const TAP_COMMENTS = [
  '"Ohhh... are you getting close? Or did you fly past it?"',
  '"The number is written. Are you sure about this?"',
  '"One more? ...Do you feel lucky today?"',
  '"Interesting. Very interesting."',
  '"Mmm. Brave."',
  '"I can see the doubt in your eyes."',
  '"You\'re sweating. I like that."',
  '"Still going? Bold."',
  '"Every tap is a prayer, isn\'t it."',
  '"The paper doesn\'t lie. Your gut might."',
]

type Phase = 'intro' | 'tapping' | 'won' | 'walked' | 'bust'

export function GamblerEvent({ onDone }: Props) {
  const history = useMemo(() => loadGamblerHistory(), [])
  // Secret number: 8–22, chosen once
  const secret  = useMemo(() => 8 + Math.floor(Math.random() * 15), [])

  const [phase,    setPhase]    = useState<Phase>('intro')
  const [taps,     setTaps]     = useState(0)
  const [comment,  setComment]  = useState(TAP_COMMENTS[0])

  function handleTap() {
    const next = taps + 1
    setTaps(next)
    setComment(TAP_COMMENTS[next % TAP_COMMENTS.length])
    if (next > secret) {
      // Went over — bust immediately
      saveGamblerHistory({ encountered: true, lost: true })
      setPhase('bust')
    }
  }

  function handleStop() {
    if (taps === secret) {
      saveGamblerHistory({ encountered: true, lost: false })
      setPhase('won')
    } else {
      // Stopped at wrong number — no reward, no penalty
      saveGamblerHistory({ encountered: true, lost: history.lost })
      setPhase('walked')
    }
  }

  function handleWalkAway() {
    saveGamblerHistory({ encountered: true, lost: history.lost })
    setPhase('walked')
  }

  // ── Intro dialogue based on history ──────────────────────
  const introLine = history.lost
    ? '"Well, well... the fool returns. Ready to lose EVERYTHING again? Come on then. The number awaits."'
    : history.encountered
      ? '"You\'re back. Still too scared last time, weren\'t you. Let\'s see if you\'ve grown a spine."'
      : '"STOP EVERYTHING. I have a very special gift for you. One of every card in existence — all yours. You just have to guess my number. But if you go over... everything resets. Everything. Walk away now and I\'ll think less of you. Permanently."'

  const chickenLine = taps === 0
    ? '"Thought so. Chicken." He flips a rubber chicken onto the battlefield and disappears in a cloud of smoke.'
    : `'"Not bad... you made it to ${taps}. But you didn\'t have the nerve to finish." He tosses a rubber chicken at your feet and vanishes.'`

  return (
    <div className="ld-backdrop">
      <div className="ld-panel" style={{ maxWidth: 420 }}>

        {/* Header */}
        <div className="ld-header">
          <span className="ld-title" style={{ color: '#ffd700' }}>🎰 THE GAMBLER</span>
          <span className="ld-sub" style={{ fontStyle: 'italic', color: 'var(--game-text-color-dim)' }}>
            {phase === 'intro'   ? 'A stranger strides onto the battlefield, grinning.' :
             phase === 'tapping' ? comment :
             phase === 'won'     ? '"...I cannot believe it. Well played, commander."' :
             phase === 'walked'  ? '"A coward\'s exit."' :
                                   '"HA! HA HA HA HA HA!"'}
          </span>
        </div>

        {/* Gambler ASCII portrait */}
        <div style={{ textAlign: 'center', fontSize: 48, margin: '8px 0' }}>🎩</div>

        {/* Intro phase */}
        {phase === 'intro' && (
          <div className="ld-bid-box u-col u-items-c u-gap-6">
            <div className="ld-bid-text" style={{ fontStyle: 'italic', textAlign: 'center', lineHeight: 1.6 }}>
              {introLine}
            </div>
            <div className="ld-bid-actions" style={{ flexDirection: 'column', gap: 8 }}>
              <button className="action-btn action-btn--large" onClick={() => setPhase('tapping')}>
                I'LL PLAY →
              </button>
              <button className="action-btn" style={{ opacity: 0.6 }} onClick={handleWalkAway}>
                WALK AWAY (coward)
              </button>
            </div>
          </div>
        )}

        {/* Tapping phase */}
        {phase === 'tapping' && (
          <div className="ld-bid-box u-col u-items-c u-gap-6" style={{ gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--game-text-color-dim)', marginBottom: 4 }}>TAPS SO FAR</div>
              <div style={{ fontSize: 52, fontWeight: 'bold', color: '#ffd700', lineHeight: 1 }}>
                {taps}
              </div>
            </div>

            <button
              className="action-btn action-btn--large"
              onClick={handleTap}
              style={{ fontSize: 18, padding: '14px 32px', letterSpacing: 2 }}
            >
              TAP ({taps + 1})
            </button>

            <div className="ld-bid-actions" style={{ gap: 8 }}>
              <button
                className="action-btn"
                onClick={handleStop}
                style={{ flex: 1, borderColor: '#33ff99', color: '#33ff99' }}
              >
                ✓ STOP HERE
              </button>
              <button
                className="action-btn"
                onClick={handleWalkAway}
                style={{ flex: 1, opacity: 0.5 }}
              >
                WALK AWAY
              </button>
            </div>
          </div>
        )}

        {/* Won */}
        {phase === 'won' && (
          <div className="ld-bid-box u-col u-items-c u-gap-6">
            <div className="ld-result ld-result--win" style={{ fontSize: 22 }}>
              EXACT MATCH — YOU WIN
            </div>
            <div className="ld-bid-text" style={{ textAlign: 'center' }}>
              The number was <strong style={{ color: '#ffd700' }}>{secret}</strong>.
              One copy of every card now belongs to you.
            </div>
            <button
              className="action-btn action-btn--large"
              onClick={() => onDone({ grantAllCards: true, logMessage: '[GAMBLER] "Impossible. One in a million. Take your cards." He vanishes.' })}
            >
              CLAIM REWARD →
            </button>
          </div>
        )}

        {/* Walked away / stopped at wrong number */}
        {phase === 'walked' && (
          <div className="ld-bid-box u-col u-items-c u-gap-6">
            <div style={{ textAlign: 'center', fontSize: 36 }}>🐔</div>
            <div className="ld-bid-text" style={{ textAlign: 'center', fontStyle: 'italic' }}>
              {chickenLine}
            </div>
            {taps > 0 && taps !== secret && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--game-text-color-dim)' }}>
                The number was <strong style={{ color: '#ffd700' }}>{secret}</strong>.
              </div>
            )}
            <button
              className="action-btn action-btn--large"
              onClick={() => onDone({
                addInventoryItem: { id: 'rubber_chicken', name: 'Rubber Chicken', icon: '🐔', desc: 'A consolation prize from The Gambler. Still warm.' },
                logMessage: '[GAMBLER] "Chicken!" He cackles and vanishes in a puff of smoke.',
              })}
            >
              TAKE THE CHICKEN →
            </button>
          </div>
        )}

        {/* Bust — game reset */}
        {phase === 'bust' && (
          <div className="ld-bid-box u-col u-items-c u-gap-6">
            <div className="ld-result ld-result--lose" style={{ fontSize: 18 }}>
              YOU WENT OVER
            </div>
            <div className="ld-bid-text" style={{ textAlign: 'center' }}>
              The number was <strong style={{ color: '#ffd700' }}>{secret}</strong>.
              You tapped <strong style={{ color: '#ff4444' }}>{taps}</strong>.
            </div>
            <div className="ld-bid-text" style={{ textAlign: 'center', color: '#ff4444', fontWeight: 'bold' }}>
              ⚠ ALL PROGRESS WILL BE ERASED ⚠
            </div>
            <button
              className="action-btn action-btn--large"
              style={{ borderColor: '#ff4444', color: '#ff4444' }}
              onClick={() => onDone({ resetGame: true, logMessage: '[GAMBLER] "HA HA HA HA HA!" The world collapses.' })}
            >
              ACCEPT YOUR FATE →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
