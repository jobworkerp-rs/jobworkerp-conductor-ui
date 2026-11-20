// Requires a running conductor with gRPC-Web enabled: bash scripts/test-env.sh up
import { afterEach, describe, expect, it } from "vitest"
import { createConductorClients } from "@/lib/clients"
import { classifyError } from "@/lib/errors"
import { toServerData, SERVER_FORM_DEFAULTS } from "@/lib/servers/form"
import { TEST_CONDUCTOR_URL } from "@/test/endpoints"
import { uniqueName } from "@/test/names"
import { findEntity } from "@/lib/entities"
import { createConfig, deleteConfig, listConfig, setConfigEnabled, updateConfig } from "./config"

const conductor = createConductorClients(TEST_CONDUCTOR_URL)
const created: string[] = []

async function create(label: string, overrides: Partial<typeof SERVER_FORM_DEFAULTS> = {}) {
  const data = toServerData(
    { ...SERVER_FORM_DEFAULTS, name: uniqueName("it", label), host: "jw.test", ...overrides },
    1_700_000_000,
  )
  const id = await createConfig(conductor, "servers", data)
  created.push(id)
  return { id, data }
}

async function findInList(id: string) {
  return findEntity(await listConfig(conductor, "servers"), id)
}

afterEach(async () => {
  for (const id of created.splice(0)) await deleteConfig(conductor, "servers", id).catch(() => {})
})

describe("configuration service, with servers", () => {
  it("creates a server that the full list returns", async () => {
    const { id, data } = await create("create", { description: "desc", sslEnabled: true })
    expect((await findInList(id))?.data).toEqual(data)
  })

  it("updates every field but keeps created_at", async () => {
    const { id, data } = await create("update")
    const next = toServerData(
      { ...SERVER_FORM_DEFAULTS, name: `${data.name}-renamed`, host: "other", port: "9443" },
      1_800_000_000,
      data.createdAt,
    )
    await updateConfig(conductor, "servers", id, next)
    const stored = (await findInList(id))?.data
    expect(stored).toEqual(next)
    expect(stored?.createdAt).toBe("1700000000")
  })

  it("toggles enabled from the latest stored values", async () => {
    const { id, data } = await create("toggle")
    // A change made elsewhere after this client loaded the list.
    await updateConfig(conductor, "servers", id, { ...data, description: "changed elsewhere" })
    await setConfigEnabled(conductor, "servers", id, false, 1_900_000_000)
    expect((await findInList(id))?.data).toEqual({
      ...data,
      description: "changed elsewhere",
      enabled: false,
      updatedAt: "1900000000",
    })
  })

  it("rejects a duplicate name with ALREADY_EXISTS", async () => {
    const { data } = await create("dup")
    const error = await createConfig(conductor, "servers", data).catch((e: unknown) => e)
    expect(classifyError(error).messageKey).toBe("errors.status.already_exists")
  })

  it("reports NOT_FOUND for a server deleted in the meantime", async () => {
    const { id, data } = await create("gone")
    await deleteConfig(conductor, "servers", id)
    for (const action of [
      () => updateConfig(conductor, "servers", id, data),
      () => setConfigEnabled(conductor, "servers", id, true, 1),
      () => deleteConfig(conductor, "servers", id),
    ]) {
      const error = await action().catch((e: unknown) => e)
      expect(classifyError(error).messageKey).toBe("errors.status.not_found")
    }
  })
})
