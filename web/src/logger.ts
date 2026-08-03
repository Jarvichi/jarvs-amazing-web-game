/**
 * Thin error-logging facade used by game logic files.
 * Initialised with the Rollbar instance in main.tsx so game files
 * stay free of direct browser/Rollbar dependencies.
 */

type ErrorLogger = (msg: string, ctx?: Record<string, unknown>) => void

let _logError: ErrorLogger = () => {}
let _logWarn: ErrorLogger = () => {}

export function setErrorLogger(fn: ErrorLogger): void {
  _logError = fn
}

export function logError(msg: string, ctx?: Record<string, unknown>): void {
  _logError(msg, ctx)
}

export function setWarnLogger(fn: ErrorLogger): void {
  _logWarn = fn
}

/**
 * Degraded-but-handled conditions: the player is unaffected or recovered on a
 * fallback. Use `logError` only when something is actually broken for them.
 */
export function logWarn(msg: string, ctx?: Record<string, unknown>): void {
  _logWarn(msg, ctx)
}
