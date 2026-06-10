export function isQuestIdUnique(
  id: string,
  quests: Array<{ id: string }>,
  excludeIndex: number,
): boolean {
  return quests.every((q, i) => i === excludeIndex || q.id !== id)
}

export function generateQuestId(existingIds: string[]): string {
  const set = new Set(existingIds)
  let n = 1
  while (set.has(`new-quest-${n}`)) n++
  return `new-quest-${n}`
}
