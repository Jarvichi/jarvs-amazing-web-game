import React, { useEffect, useState, useMemo } from 'react'
import { RareEventEffect } from './types'

interface Props {
  onDone: (effect: RareEventEffect) => void
}

const ALL_LINES = [
  'A unit crossed the field today. Historians will call this the Goblin Incident. Mostly because it rhymed.',
  "The commander's strategy, if it could be called that, unfolded with the confident incoherence of a plan that once seemed reasonable.",
  'Units perished. More units crossed. The great wheel of deployment continued to turn, indifferent to the feelings of those caught in its spokes.',
  'At this precise moment, somewhere, a farmer is tending cabbages. The cabbages have opinions about the situation. The farmer does not know this.',
  'The enemy base regarded the approaching forces with what might have been concern, if enemy bases were capable of such things. Which they are not. Probably.',
  'Victory, all generals know, is merely defeat that has not yet arrived. The narrator offers no further comment on current probability.',
  'A wall was built. Then destroyed. Then built again. Somewhere in this there is a metaphor. The narrator was paid by the word and has declined to locate it.',
  'Thirteen seconds ago something significant happened. The narrator was briefly distracted. It was probably a goblin.',
  "In the grand tapestry of this campaign, this moment would later be described as 'the middle bit.' It is, by most metrics, exactly that.",
  'The battlefield stretches to the horizon. Actually it does not. It is a fixed rectangular play area. The narrator apologises for the poetry.',
]

// Show 4 randomly chosen lines; each line is visible for DISPLAY_MS before fading
const DISPLAY_MS    = 11000
const FADE_MS       = 600

export function NarratorEvent({ onDone }: Props) {
  const lines = useMemo(() => {
    const shuffled = [...ALL_LINES].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 4)
  }, [])

  const [lineIndex, setLineIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Cycle through lines
    const showNext = () => {
      setLineIndex(i => i + 1)
      setVisible(true)
    }
    // Fade out before switching
    const fadeOutAt = DISPLAY_MS - FADE_MS
    const fadeId = setTimeout(() => setVisible(false), fadeOutAt)
    const nextId = setTimeout(showNext, DISPLAY_MS)
    return () => { clearTimeout(fadeId); clearTimeout(nextId) }
  }, [lineIndex])

  useEffect(() => {
    if (lineIndex < lines.length) return
    // All lines shown, done
    const id = setTimeout(() => onDone({ logMessage: '[NARRATOR] has left the battlefield.' }), 500)
    return () => clearTimeout(id)
  }, [lineIndex, lines.length, onDone])

  if (lineIndex >= lines.length) return null

  return (
    <div className={`narrator-box${visible ? ' narrator-box--visible' : ''}`}>
      <div className="narrator-label">NARRATOR</div>
      <div className="narrator-text">{lines[lineIndex]}</div>
    </div>
  )
}
