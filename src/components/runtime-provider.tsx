import { useMemo, type ReactNode } from "react"
import { RuntimeContext } from "@/hooks/use-runtime"
import { createRuntimeClients } from "@/lib/clients"
import type { RuntimeConfig } from "@/lib/runtime-config"

export function RuntimeProvider({
  config,
  children,
}: {
  config: RuntimeConfig
  children: ReactNode
}) {
  const value = useMemo(() => ({ config, ...createRuntimeClients(config) }), [config])
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}
