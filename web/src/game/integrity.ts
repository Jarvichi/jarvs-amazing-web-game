import { logError } from '../logger'

const CHECKSUMS_KEY = 'jarv_checksums'

function djb2(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

function readChecksums(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CHECKSUMS_KEY)
    if (raw) return JSON.parse(raw) as Record<string, string>
  } catch { /* ignore */ }
  return {}
}

function writeChecksums(sums: Record<string, string>): void {
  try {
    localStorage.setItem(CHECKSUMS_KEY, JSON.stringify(sums))
  } catch { /* ignore */ }
}

const _violations: string[] = []

export function getIntegrityViolations(): string[] {
  return [..._violations]
}

export function clearIntegrityViolations(): void {
  _violations.length = 0
}

/**
 * Validate the raw serialised string for a localStorage key against its stored
 * checksum.  Returns true if intact.  On first call for a key (no stored checksum)
 * silently writes the checksum and returns true — this is the migration guard that
 * prevents existing saves from being flagged on first deploy.
 */
export function validateIntegrity(storageKey: string, data: string): boolean {
  const sums = readChecksums()
  const stored = sums[storageKey]
  const actual = djb2(data)

  if (!stored) {
    sums[storageKey] = actual
    writeChecksums(sums)
    return true
  }

  if (stored !== actual) {
    logError('integrity check failed — data may have been modified externally', {
      key: storageKey,
    })
    _violations.push(storageKey)
    // Update so we don't re-fire on subsequent loads
    sums[storageKey] = actual
    writeChecksums(sums)
    return false
  }

  return true
}

/** Call after every legitimate write to keep the stored checksum current. */
export function updateChecksum(storageKey: string, data: string): void {
  const sums = readChecksums()
  sums[storageKey] = djb2(data)
  writeChecksums(sums)
}
