import React, { useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import {
  getChronicleStatus, markChapterRead, describeChallenge, describeReward,
  recordChronicleDecision, getChronicleAlignment,
  ChronicleChapterStatus, ChronicleAlignmentTrack,
} from '../../game/chronicle'

const ALIGNMENT_LABELS: Record<ChronicleAlignmentTrack, string> = {
  vigil: 'Vigil', accord: 'Accord', unbinding: 'Unbinding',
}

interface Props {
  onBack: () => void
}

function formatUnlockDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function ChronicleScreen({ onBack }: Props) {
  const [chapters, setChapters] = useState<ChronicleChapterStatus[]>(getChronicleStatus)
  const [openId, setOpenId] = useState<string | null>(null)

  const open = openId ? chapters.find(c => c.def.id === openId) ?? null : null

  function handleOpen(chapter: ChronicleChapterStatus) {
    if (!chapter.available) return
    markChapterRead(chapter.def.id)
    setChapters(getChronicleStatus())
    setOpenId(chapter.def.id)
  }

  function handleDecision(chapterId: string, optionId: string) {
    recordChronicleDecision(chapterId, optionId)
    setChapters(getChronicleStatus())
  }

  // ── Reading view ────────────────────────────────────────────────────────────
  if (open) {
    const c = open.def.challenge
    const decision = open.def.decision ?? null
    const chosenOption = decision && open.decisionOptionId
      ? decision.options.find(o => o.id === open.decisionOptionId) ?? null
      : null
    // Reading is part of completing a chapter; once it also has a decision,
    // making that decision is too — the challenge only appears once resolved.
    const challengeUnlocked = !decision || chosenOption !== null

    return (
      <OverlayScreen
        title="FRACTURE CHRONICLE"
        subtitle={`Chapter ${open.number} — ${open.def.title}`}
        onBack={() => setOpenId(null)}
      >
        <div className="chr-reader u-col u-gap-6">
          {open.def.lore.split('\n\n').map((para, i) => (
            <p key={i} className="chr-lore-para">{para}</p>
          ))}

          {decision && (
            <div className="chr-decision u-col u-gap-3">
              <div className="chr-section-label">A CHOICE</div>
              <div className="chr-decision-prompt">{decision.prompt}</div>
              <div className="chr-decision-options u-col u-gap-2">
                {decision.options.map((option, i) => {
                  const isChosen   = chosenOption?.id === option.id
                  const isDisabled = chosenOption !== null && !isChosen
                  return (
                    <button
                      key={option.id}
                      className={[
                        'chr-decision-option',
                        isChosen ? 'chr-decision-option--chosen' : '',
                      ].join(' ')}
                      onClick={() => handleDecision(open.def.id, option.id)}
                      disabled={isDisabled}
                    >
                      <span className="chr-decision-letter">{String.fromCharCode(65 + i)}.</span>
                      <span className="chr-decision-label u-grow">{option.label}</span>
                    </button>
                  )
                })}
              </div>
              {chosenOption && (
                <div className="chr-decision-consequence">{chosenOption.consequence}</div>
              )}
            </div>
          )}

          {challengeUnlocked && (
            <div className="chr-challenge u-col u-gap-3">
              <div className="chr-section-label">CHAPTER CHALLENGE</div>
              <div className="chr-challenge-desc">{describeChallenge(c)}</div>
              <div className="chr-progress-bar">
                <div
                  className="chr-progress-fill"
                  style={{ width: `${Math.round((open.progress / c.count) * 100)}%` }}
                />
              </div>
              <div className="chr-progress-label">
                {open.completed
                  ? '✓ Challenge complete'
                  : `${open.progress} / ${c.count}`}
              </div>
              <div className="chr-reward">
                Reward: {describeReward(open.def.reward)}
                {open.completed && <span className="chr-reward-claimed"> — claimed</span>}
              </div>
            </div>
          )}
        </div>
      </OverlayScreen>
    )
  }

  // ── Chapter list ────────────────────────────────────────────────────────────
  const alignment = getChronicleAlignment()
  const alignmentTracks = Object.keys(alignment) as ChronicleAlignmentTrack[]
  const alignmentMax = Math.max(1, ...alignmentTracks.map(t => alignment[t]))
  const hasAlignment = alignmentTracks.some(t => alignment[t] > 0)

  return (
    <OverlayScreen
      title="FRACTURE CHRONICLE"
      subtitle="What caused the Fracture? The story unfolds, chapter by chapter."
      onBack={onBack}
    >
      {hasAlignment && (
        <div className="chr-alignment-meter u-col u-gap-2">
          <div className="chr-section-label">YOUR PATH</div>
          {alignmentTracks.map(track => (
            <div key={track} className="chr-alignment-row u-flex u-items-c u-gap-3">
              <span className="chr-alignment-label">{ALIGNMENT_LABELS[track]}</span>
              <div className="chr-alignment-bar">
                <div
                  className="chr-alignment-fill"
                  style={{ width: `${(alignment[track] / alignmentMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="chr-list u-col u-gap-4">
        {chapters.map(chapter => (
          <button
            key={chapter.def.id}
            className={`chr-chapter${chapter.available ? '' : ' chr-chapter--locked'}`}
            onClick={() => handleOpen(chapter)}
            disabled={!chapter.available}
          >
            <div className="chr-chapter-head u-flex u-items-c u-gap-4">
              <span className="chr-chapter-num">CH.{chapter.number}</span>
              <span className="chr-chapter-title u-grow">
                {chapter.available ? chapter.def.title : '???'}
              </span>
              <span className="chr-chapter-state">
                {!chapter.available ? '🔒'
                  : chapter.completed ? '✓'
                  : !chapter.read ? 'NEW'
                  : `${chapter.progress}/${chapter.def.challenge.count}`}
              </span>
            </div>
            <div className="chr-chapter-sub">
              {chapter.available
                ? chapter.def.teaser
                : `Unlocks ${formatUnlockDate(chapter.def.availableFrom)}`}
            </div>
          </button>
        ))}
      </div>
    </OverlayScreen>
  )
}
