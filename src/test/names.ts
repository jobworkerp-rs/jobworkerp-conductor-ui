/** A name no other test run uses, so tests can share one conductor and clean up by prefix. */
export function uniqueName(prefix: string, label: string) {
  return `${prefix}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
