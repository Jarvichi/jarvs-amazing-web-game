// Fisher-Yates shuffle (returns a copy, does not mutate the input) — used to
// randomize dialogue-tree choice order so a "good"/"neutral"/"bad" outcome
// isn't always in the same list position.
export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
