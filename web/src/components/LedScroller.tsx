import { useEffect, useRef } from 'react'

const SCROLLER_LENGTH = 60
const HEIGHT = 7
const FPS = 30


export interface LedScrollerMessage {
    text: string
    id: string // unique ID for the message, used to track it across updates
}

export interface Props {
  message?: LedScrollerMessage
  messages?: LedScrollerMessage[] // if set, rotate through these messages instead of the main one
  dotRadius?: number 
  dotPitch?: number
  colour?: string
}

// Each entry is an array of columns; each column is HEIGHT booleans (row 0 = top)
function charToLED(theChar: string = ' '): boolean[][] {
  switch (theChar) {
    case 'A': return [
      [false, false, true, true, true, true, true],
      [false, true, false, false, true, false, false],
      [true, false, false, false, true, false, false],
      [false, true, false, false, true, false, false],
      [false, false, true, true, true, true, true]]
    case 'B': return [
      [true, true, true, true, true, true, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [false, true, true, false, true, true, false]]
    case 'C': return [
      [false, true, true, true, true, true, false],
      [true, false, false, false, false, false, true],
      [true, false, false, false, false, false, true],
      [true, false, false, false, false, false, true],
      [false, true, false, false, false, true, false]]
    case 'D': return [
      [true, true, true, true, true, true, true],
      [true, false, false, false, false, false, true],
      [true, false, false, false, false, false, true],
      [true, false, false, false, false, false, true],
      [false, true, true, true, true, true, false]]
    case 'E': return [
      [true, true, true, true, true, true, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, false, false, false, true]]
    case 'F': return [
      [true, true, true, true, true, true, true],
      [true, false, false, true, false, false, false],
      [true, false, false, true, false, false, false],
      [true, false, false, true, false, false, false],
      [true, false, false, false, false, false, false]]
    case 'G': return [
      [false, true, true, true, true, true, false],
      [true, false, false, false, false, false, true],
      [true, false, false, false, false, false, true],
      [true, false, false, false, true, false, true],
      [true, true, false, false, true, true, true]]
    case 'H': return [
      [true, true, true, true, true, true, true],
      [false, false, false, true, false, false, false],
      [false, false, false, true, false, false, false],
      [false, false, false, true, false, false, false],
      [true, true, true, true, true, true, true]]
    case 'I': return [
      [false, false, false, false, false, false, false],
      [true, false, false, false, false, false, true],
      [true, true, true, true, true, true, true],
      [true, false, false, false, false, false, true],
      [false, false, false, false, false, false, false]]
    case 'J': return [
      [false, false, false, false, false, true, false],
      [false, false, false, false, false, false, true],
      [true, false, false, false, false, false, true],
      [true, true, true, true, true, true, false],
      [true, false, false, false, false, false, false]]
    case 'K': return [
      [true, true, true, true, true, true, true],
      [false, false, false, true, false, false, false],
      [false, false, true, false, true, false, false],
      [false, true, false, false, false, true, false],
      [true, false, false, false, false, false, true]]
    case 'L': return [
      [true, true, true, true, true, true, true],
      [false, false, false, false, false, false, true],
      [false, false, false, false, false, false, true],
      [false, false, false, false, false, false, true],
      [false, false, false, false, false, false, true]]
    case 'M': return [
      [true, true, true, true, true, true, true],
      [false, true, false, false, false, false, false],
      [false, false, true, false, false, false, false],
      [false, true, false, false, false, false, false],
      [true, true, true, true, true, true, true]]
    case 'N': return [
      [true, true, true, true, true, true, true],
      [false, false, true, false, false, false, false],
      [false, false, false, true, false, false, false],
      [false, false, false, false, true, false, false],
      [true, true, true, true, true, true, true]]
    case 'O': return [
      [false, true, true, true, true, true, false],
      [true, false, false, false, false, false, true],
      [true, false, false, false, false, false, true],
      [true, false, false, false, false, false, true],
      [false, true, true, true, true, true, false]]
    case 'P': return [
      [true, true, true, true, true, true, true],
      [true, false, false, true, false, false, false],
      [true, false, false, true, false, false, false],
      [true, false, false, true, false, false, false],
      [false, true, true, false, false, false, false]]
    case 'Q': return [
      [false, true, true, true, true, true, false],
      [true, false, false, false, false, false, true],
      [true, false, false, false, true, false, true],
      [true, false, false, false, false, true, false],
      [false, true, true, true, true, false, true]]
    case 'R': return [
      [true, true, true, true, true, true, true],
      [true, false, false, true, false, false, false],
      [true, false, false, true, false, false, false],
      [true, false, false, true, false, false, false],
      [false, true, true, false, true, true, true]]
    case 'S': return [
      [false, true, true, false, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, false, true, true, false]]
    case 'T': return [
      [true, false, false, false, false, false, false],
      [true, false, false, false, false, false, false],
      [true, true, true, true, true, true, true],
      [true, false, false, false, false, false, false],
      [true, false, false, false, false, false, false]]
    case 'U': return [
      [true, true, true, true, true, true, false],
      [false, false, false, false, false, false, true],
      [false, false, false, false, false, false, true],
      [false, false, false, false, false, false, true],
      [true, true, true, true, true, true, false]]
    case 'V': return [
      [true, true, true, true, true, false, false],
      [false, false, false, false, false, true, false],
      [false, false, false, false, false, false, true],
      [false, false, false, false, false, true, false],
      [true, true, true, true, true, false, false]]
    case 'W': return [
      [true, true, true, true, true, true, false],
      [false, false, false, false, false, false, true],
      [false, false, false, false, true, true, false],
      [false, false, false, false, false, false, true],
      [true, true, true, true, true, true, false]]
    case 'X': return [
      [true, false, false, false, false, false, true],
      [false, true, true, false, true, true, false],
      [false, false, false, true, false, false, false],
      [false, true, true, false, true, true, false],
      [true, false, false, false, false, false, true]]
    case 'Y': return [
      [true, false, false, false, false, false, false],
      [false, true, false, false, false, false, false],
      [false, false, true, true, true, true, true],
      [false, true, false, false, false, false, false],
      [true, false, false, false, false, false, false]]
    case 'Z': return [
      [true, false, false, false, false, true, true],
      [true, false, false, false, true, false, true],
      [true, false, false, true, false, false, true],
      [true, false, true, false, false, false, true],
      [true, true, false, false, false, false, true]]
    case '0': return [
      [false, true, true, true, true, true, false],
      [true, false, false, false, true, false, true],
      [true, false, false, true, false, false, true],
      [true, false, true, false, false, false, true],
      [false, true, true, true, true, true, false]]
    case '1': return [
      [false, false, false, false, false, false, false],
      [false, true, false, false, false, false, true],
      [true, true, true, true, true, true, true],
      [false, false, false, false, false, false, true],
      [false, false, false, false, false, false, false]]
    case '2': return [
      [true, false, false, false, false, true, true],
      [true, false, false, false, true, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [false, true, true, false, false, false, true]]
    case '3': return [
      [false, true, false, false, false, true, false],
      [true, false, false, false, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [false, true, true, false, true, true, false]]
    case '4': return [
      [false, false, false, true, true, false, false],
      [false, false, true, false, true, false, false],
      [false, true, false, false, true, false, false],
      [true, true, true, true, true, true, true],
      [false, false, false, false, true, false, false]]
    case '5': return [
      [true, true, true, false, false, true, false],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, false, true, true, false]]
    case '6': return [
      [false, true, true, true, true, true, false],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [false, true, false, false, true, true, false]]
    case '7': return [
      [true, false, false, false, false, false, false],
      [true, false, false, false, false, false, false],
      [true, false, false, false, true, true, true],
      [true, false, false, true, false, false, false],
      [true, true, true, false, false, false, false]]
    case '8': return [
      [false, true, true, false, true, true, false],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [false, true, true, false, true, true, false]]
    case '9': return [
      [false, true, true, false, false, true, false],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [true, false, false, true, false, false, true],
      [false, true, true, true, true, true, false]]
    case '!': return [
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false],
      [true, true, true, true, true, false, true],
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false]]
    case '?': return [
      [false, false, false, false, false, false, false],
      [true, false, false, false, false, false, false],
      [true, false, false, true, true, false, true],
      [false, true, false, true, false, false, false],
      [false, false, true, true, false, false, false]]
    case '.': return [
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, true],
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false]]
    case ',': return [
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, true],
      [false, false, false, false, false, true, false],
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false]]
    case '-': return [
      [false, false, false, false, false, false, false],
      [false, false, false, true, false, false, false],
      [false, false, false, true, false, false, false],
      [false, false, false, true, false, false, false],
      [false, false, false, false, false, false, false]]
    case '+': return [
      [false, false, false, true, false, false, false],
      [false, false, false, true, false, false, false],
      [false, true, true, true, true, true, false],
      [false, false, false, true, false, false, false],
      [false, false, false, true, false, false, false]]
    case ':': return [
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false],
      [false, false, true, false, false, true, false],
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false]]
    case '×': return [
      [false, true, false, false, false, true, false],
      [false, false, true, false, true, false, false],
      [false, false, false, true, false, false, false],
      [false, false, true, false, true, false, false],
      [false, true, false, false, false, true, false]]
    case '&': return [
        [false, true, false, true, true, true, false],
        [true, false, true, false, false, false, true],
        [true, false, true, true, false, false, true],
        [false, true, false, false, true, true, false],
        [false, false, false, true, false, false, true]]
    case '(': return [
              [false, false, false, false, false, false, false],

      [false, false, true, true, true, false, false],
      [false, true, false, false, false, true, false],
      [true, false, false, false, false, false, true],
      [false, false, false, false, false, false, false]]
    case ')': return [
      [false, false, false, false, false, false, false],
      [true, false, false, false, false, false, true],
      [false, true, false, false, false, true, false],
      [false, false, true, true, true, false, false],
      [false, false, false, false, false, false, false]]
      case '=': return [
        [false, false, true, false, true, false, false],
        [false, false, true, false, true, false, false],
        [false, false, true, false, true, false, false],
        [false, false, true, false, true, false, false],
        [false, false, true, false, true, false, false]]
    case '"': return [
      [false, false, false, false, false, false, false],
      [true, true, false, false, false, false, false],
      [false, false, false, false, false, false, false],
      [true, true, false, false, false, false, false],
      [false, false, false, false, false, false, false]]
    case "'": return [
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false],
      [true, true, false, false, false, false, false],
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false]]
    case '<': return [
      [false, false, false, true, false, false, false],
      [false, false, true, false, false, false, false],
      [false, true, false, false, false, false, false],
      [false, false, true, false, false, false, false],
      [false, false, false, true, false, false, false]]
    case '>': return [
      [false, false, false, true, false, false, false],
      [false, false, false, false, true, false, false],
      [false, false, false, false, false, true, false],
      [false, false, false, false, true, false, false],
      [false, false, false, true, false, false, false]]
      case '/': return [
        [false, false, false, false, false, true, false],
        [false, false, false, false, true, false, false],
        [false, false, false, true, false, false, false],
        [false, false, true, false, false, false, false],
        [false, true, false, false, false, false, false]]
case '🌟': return [
  [true, false, true, false, false, false, true],
  [false, false, true, true, true, false, false],
  [false, true, true, true, false, false, true],
  [false, false, true, true, true, false, false],
  [true, false, true, false, false, false, true],
]
case '🃏': return [
  [false, false, false, false, true, false, false],
  [false, true, false, false, false, true, false],
  [false, false, false, true, false, true, false],
  [false, true, false, false, false, true, false],
  [false, false, false, false, true, false, false],
]
case '💰': return [
  [false, false, true, false, false, true, false],
  [false, true, false, true, false, true, false],
  [true, true, true, true, true, true, true],
  [false, true, false, true, false, true, false],
  [false, true, false, false, true, false, false],
]
case '💎': return [
  [false, false, true, false, false, false, false],
  [false, true, true, true, false, false, false],
  [false, true, true, true, true, false, false],
  [false, true, true, true, false, false, false],
  [false, false, true, false, false, false, false],
]
case '🍒': return [
  [false, true, false, false, true, false, false],
  [true, true, true, false, true, true, false],
  [true, true, true, true, true, true, false],
  [false, true, true, true, true, false, false],
  [false, false, true, false, false, false, false],
]
case '🍋': return [
  [false, false, true, true, true, false, false],
  [false, true, true, true, true, true, false],
  [true, true, true, true, true, true, true],
  [false, true, true, true, true, true, false],
  [false, false, true, true, true, false, false],
]
case '🍊': return [
  [false, false, true, true, true, false, false],
  [false, true, true, true, true, true, false],
  [true, true, true, true, true, true, true],
  [false, true, true, true, true, true, false],
  [false, false, true, true, true, false, false],
]
case '🍇': return [
  [false, false, true, true, true, false, false],
  [false, true, true, true, true, true, false],
  [false, true, true, true, true, true, false],
  [false, false, true, true, true, false, false],
  [false, false, true, false, true, false, false],
]
case '⭐': return [
  [false, false, true, false, false, false, false],
  [false, false, true, true, true, false, false],
  [false, true, true, true, false, false, false],
  [false, false, true, true, true, false, false],
  [false, false, true, false, false, false, false],
]
case '🔔': return [
  [false, false, false, false, false, true, false],
  [false, true, true, true, true, true, false],
  [true, true, true, true, true, true, true],
  [false, true, true, true, true, true, false],
  [false, false, false, false, false, true, false],
]
    default:
      return [[false, false, false, false, false, false, false]]
  }
}

function textToLED(theWord: string): boolean[][] {
  const cols: boolean[][][] = []
  for (const ch of theWord.toUpperCase()) {
    cols.push(charToLED(ch))
    cols.push(charToLED()) // one-column gap between characters
  }
  return ([] as boolean[][]).concat(...cols)
}

export function LedScroller({ message={
    text: '',
    id: ''
},messages=[], dotRadius = 2.2, dotPitch = dotRadius * 2.5, colour = '#ff8800' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = SCROLLER_LENGTH * dotPitch
    canvas.height = HEIGHT * dotPitch
    const ctx = canvas.getContext('2d')!

    const messageArray = textToLED(message?.text || '')

    for (const msg of messages) {
      const arr = textToLED(msg?.text || '')
      messageArray.push(...arr, ...charToLED(' ')) // add a gap between messages
    }

    let leftPointer = SCROLLER_LENGTH + 1
    const furthestLeftPoint = -messageArray.length
    let lastTime = 0
    let animId = 0

    function draw(time: number) {
      animId = requestAnimationFrame(draw)
      if (time - lastTime < 1000 / FPS) return
      lastTime = time

      if (leftPointer === furthestLeftPoint) {
        leftPointer = SCROLLER_LENGTH + 1
      }

      ctx.fillStyle = '#0a0500'
      ctx.fillRect(0, 0, canvas!.width, canvas!.height)

      for (let col = 0; col < SCROLLER_LENGTH; col++) {
        const msgCol = col - leftPointer
        for (let row = 0; row < HEIGHT; row++) {
          const on = msgCol >= 0 && msgCol < messageArray.length && messageArray[msgCol][row]
          ctx.fillStyle = on ? colour : '#1f0e00'
          ctx.beginPath()
          ctx.arc(
            col * dotPitch + dotPitch / 2,
            row * dotPitch + dotPitch / 2,
            dotRadius,
            0, Math.PI * 2
          )
          ctx.fill()
        }
      }

      leftPointer--
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [message, messages, dotPitch, dotRadius])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', borderRadius: '4px' }}
    />
  )
}
