import { useEffect, useState } from "react"
import { nowSeconds } from "@/lib/format"

/** The current time in UNIX seconds, refreshed every `intervalMs`. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(nowSeconds)
  useEffect(() => {
    const timer = setInterval(() => setNow(nowSeconds()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
