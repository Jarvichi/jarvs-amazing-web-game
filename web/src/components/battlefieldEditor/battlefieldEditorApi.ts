export async function saveBattlefieldAct(actId: string, data: unknown): Promise<void> {
  const res = await fetch('/api/battlefield-editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actId, data }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Save failed: ${text}`)
  }
}
