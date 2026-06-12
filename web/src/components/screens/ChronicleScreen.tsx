import React, { useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import {
  getChronicleStatus, markChapterRead, describeChallenge, describeReward,
  ChronicleChapterStatus,
} from '../../game/chronicle'

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

  // ── Reading view ────────────────────────────────────────────────────────────
  if (open) {
    const c = open.def.challenge
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
        </div>
      </OverlayScreen>
    )
  }

  // ── Chapter list ────────────────────────────────────────────────────────────
  return (
    <OverlayScreen
      title="FRACTURE CHRONICLE"
      subtitle="What caused the Fracture? The story unfolds, chapter by chapter."
      onBack={onBack}
    >
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
