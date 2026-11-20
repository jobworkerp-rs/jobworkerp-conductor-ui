import { useCallback, useMemo, useState, type ReactNode } from "react"
import { AutoRefreshContext } from "@/hooks/use-auto-refresh"
import { PREFERENCE_KEYS, readPreference, writePreference } from "@/lib/preferences"
import { parseRefreshSeconds, type RefreshSeconds } from "@/lib/refresh"

export function AutoRefreshProvider({ children }: { children: ReactNode }) {
  const [autoRefresh, setState] = useState(
    () => readPreference(PREFERENCE_KEYS.autoRefresh) !== "off",
  )
  const [intervalSeconds, setSeconds] = useState(() =>
    parseRefreshSeconds(readPreference(PREFERENCE_KEYS.refreshInterval)),
  )
  const setAutoRefresh = useCallback((value: boolean) => {
    setState(value)
    writePreference(PREFERENCE_KEYS.autoRefresh, value ? "on" : "off")
  }, [])
  const setIntervalSeconds = useCallback((value: RefreshSeconds) => {
    setSeconds(value)
    writePreference(PREFERENCE_KEYS.refreshInterval, String(value))
  }, [])
  const value = useMemo(
    () => ({ autoRefresh, setAutoRefresh, intervalSeconds, setIntervalSeconds }),
    [autoRefresh, setAutoRefresh, intervalSeconds, setIntervalSeconds],
  )
  return <AutoRefreshContext.Provider value={value}>{children}</AutoRefreshContext.Provider>
}
