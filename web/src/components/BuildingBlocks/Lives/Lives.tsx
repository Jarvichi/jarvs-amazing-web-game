
interface Props {
  maxLives: number
  currentLives: number
}

export function Lives({ maxLives, currentLives }: Props) {
  return (
    <div className="lives-container">
      {Array.from({ length: maxLives }, (_, i) => (
        <span key={i} className={`nm-life-pip ${i < currentLives ? 'nm-life-pip--full' : 'nm-life-pip--empty'}`}>
          ♥
        </span>
      ))}
    </div>
  )
}
