export const THEMES = ["light", "dark", "system"] as const
export type Theme = (typeof THEMES)[number]

export function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value)
}

/** localStorage keys of the per-browser display preferences (spec §6.7). */
export const PREFERENCE_KEYS = {
  language: "conductor-ui.language",
  theme: "conductor-ui.theme",
  autoRefresh: "conductor-ui.auto-refresh",
  refreshInterval: "conductor-ui.refresh-interval",
} as const

// localStorage can throw (privacy modes, disabled storage); preferences are
// best-effort, so failures fall back to defaults instead of breaking the app.
export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Not persisting a preference is acceptable.
  }
}
