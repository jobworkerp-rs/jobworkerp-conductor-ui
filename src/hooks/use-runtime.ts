import { createContext, useContext } from "react"
import type { RuntimeClients } from "@/lib/clients"
import type { RuntimeConfig } from "@/lib/runtime-config"

export interface RuntimeContextValue extends RuntimeClients {
  config: RuntimeConfig
}

export const RuntimeContext = createContext<RuntimeContextValue | null>(null)

export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext)
  if (!value) throw new Error("useRuntime must be used inside RuntimeProvider")
  return value
}
