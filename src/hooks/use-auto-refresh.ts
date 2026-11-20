import { createContext, useContext, useMemo } from "react"
import { refetchInterval, type Polling, type RefreshSeconds } from "@/lib/refresh"

export interface AutoRefreshContextValue {
  autoRefresh: boolean
  setAutoRefresh: (value: boolean) => void
  intervalSeconds: RefreshSeconds
  setIntervalSeconds: (value: RefreshSeconds) => void
}

export const AutoRefreshContext = createContext<AutoRefreshContextValue | null>(null)

export function useAutoRefresh(): AutoRefreshContextValue {
  const value = useContext(AutoRefreshContext)
  if (!value) throw new Error("useAutoRefresh must be used inside AutoRefreshProvider")
  return value
}

/** Whether to poll, and at the interval chosen in the settings. */
export function usePolling(): Polling {
  const { autoRefresh, intervalSeconds } = useAutoRefresh()
  return useMemo(
    () => ({ autoRefresh, idleMs: intervalSeconds * 1000 }),
    [autoRefresh, intervalSeconds],
  )
}

/** Polling interval for data with nothing running (spec §4.3); off while auto refresh is paused. */
export function useIdleRefetchInterval() {
  return refetchInterval({ ...usePolling(), hasActive: false })
}
