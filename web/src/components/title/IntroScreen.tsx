import React, { useEffect, useState } from 'react'

interface Props {
  onDone: () => void
}

type Slide = 'awesome' | 'jarv'

const SLIDE_DURATION_MS = 4500

export function IntroScreen({ onDone }: Props) {
  const [slide, setSlide] = useState<Slide>('awesome')
  const [fading, setFading] = useState(false)

  function advance() {
    setFading(true)
    setTimeout(() => {
      if (slide === 'awesome') {
        setSlide('jarv')
        setFading(false)
      } else {
        onDone()
      }
    }, 500)
  }

  // Auto-advance after SLIDE_DURATION_MS
  useEffect(() => {
    const t = setTimeout(advance, SLIDE_DURATION_MS)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide])

  return (
    <div
      className="intro-screen"
      onClick={advance}
      title="Click to skip"
    >
      <div className="intro-content" style={{ opacity: fading ? 0 : 1 }}>
        {slide === 'awesome' && (
          <div className="intro-slide intro-slide--awesome">
            <img
              src={`${import.meta.env.BASE_URL}awesome-software-logo.jpg`}
              alt="Awesome Software"
              className="intro-awesome-logo"
            />
            <div className="intro-presents">PRESENTS</div>
          </div>
        )}

        {slide === 'jarv' && (
          <div className="intro-slide intro-slide--jarv">
            <img
              src={`${import.meta.env.BASE_URL}jarv-logo.svg`}
              alt="Jarv"
              className="intro-jarv-logo"
            />
            <div className="intro-jarv-credit">A Jarv Creation</div>
          </div>
        )}

        <div className="intro-skip-hint">tap to skip</div>
      </div>
    </div>
  )
}
