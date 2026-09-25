// ─── /adventure: fitting words into the dialog box ──────────────────────────

/** Characters per line and lines per box, at the dialog's 2× text. */
export const DIALOG_COLS = 28
export const DIALOG_LINES = 3

/** Break text into lines of at most `width` characters, at spaces. */
export function wrap(text: string, width = DIALOG_COLS): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word
    else if (line.length + 1 + word.length <= width) line += ` ${word}`
    else { lines.push(line); line = word }
    while (line.length > width) { lines.push(line.slice(0, width)); line = line.slice(width) }
  }
  if (line) lines.push(line)
  return lines
}

/** Re-cut pages so each fits the box; lines within a page are joined by "\n". */
export function paginate(pages: string[], width = DIALOG_COLS, height = DIALOG_LINES): string[] {
  const out: string[] = []
  for (const page of pages) {
    const lines = wrap(page, width)
    for (let i = 0; i < lines.length; i += height) out.push(lines.slice(i, i + height).join('\n'))
  }
  return out
}
