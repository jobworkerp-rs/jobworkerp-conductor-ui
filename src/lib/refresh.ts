/** How often the conductor connection is probed; independent of auto refresh. */
export const IDLE_REFRESH_MS = 30_000
export const ACTIVE_REFRESH_MS = 5_000

/** Auto refresh intervals offered, in seconds (spec §4.3, §6.7). */
export const REFRESH_INTERVALS = [10, 30, 60, 120] as const
export type RefreshSeconds = (typeof REFRESH_INTERVALS)[number]
export const DEFAULT_REFRESH_SECONDS: RefreshSeconds = 30

export function parseRefreshSeconds(raw: string | null): RefreshSeconds {
  return REFRESH_INTERVALS.find((seconds) => String(seconds) === raw) ?? DEFAULT_REFRESH_SECONDS
}

/** Whether lists poll, and how often while nothing is running. */
export interface Polling {
  autoRefresh: boolean
  idleMs: number
}

/** Polling interval for lists (spec §4.3): faster while anything is still running. */
export function refetchInterval(state: Polling & { hasActive: boolean }): number | false {
  if (!state.autoRefresh) return false
  return state.hasActive ? ACTIVE_REFRESH_MS : state.idleMs
}

/**
 * Data younger than this is reused when another screen mounts, instead of
 * refetching on every navigation. Short enough that a change made elsewhere
 * shows up almost at once; polling and invalidation still apply.
 */
export const STALE_MS = 5_000
