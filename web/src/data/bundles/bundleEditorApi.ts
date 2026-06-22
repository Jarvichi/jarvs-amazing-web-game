// Persist the edited bundle registry back to src/data/bundles/bundles.json.
// Backed by the dev-server middleware registered in .storybook/main.ts.
export async function saveBundles(data: unknown): Promise<void> {
  const res = await fetch('/api/bundle-editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Save failed: ${text}`)
  }
}
