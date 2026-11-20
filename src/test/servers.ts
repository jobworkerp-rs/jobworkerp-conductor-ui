import type { ConductorClients } from "@/lib/clients"
import { listConfig } from "@/lib/services/config"

/** The server conductor's all-in-one bootstrap registers for its own jobworkerp. */
export async function localServerId(conductor: ConductorClients): Promise<string> {
  const local = (await listConfig(conductor, "servers")).find((s) => s.data.name === "local")
  if (!local) throw new Error('the test environment has no "local" server')
  return local.id
}
