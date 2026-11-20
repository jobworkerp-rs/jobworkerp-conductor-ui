// Requires a running conductor with gRPC-Web enabled: bash scripts/test-env.sh up
// The shared environment is never overwritten or cleared here; that is
// config-management.destructive.test.ts, against its own conductor.
import { afterEach, describe, expect, it } from "vitest"
import { createConductorClients } from "@/lib/clients"
import { TEST_CONDUCTOR_URL } from "@/test/endpoints"
import { uniqueName } from "@/test/names"
import { deleteConfig, listConfig } from "./config"
import { exportConfig, importConfig, validateConfig } from "./config-management"

const conductor = createConductorClients(TEST_CONDUCTOR_URL)
let prefix = ""

afterEach(async () => {
  for (const kind of ["schedules", "servers"] as const) {
    for (const entry of await listConfig(conductor, kind)) {
      if (entry.data.name.startsWith(prefix)) await deleteConfig(conductor, kind, entry.id)
    }
  }
})

// A server of its own (a unique address too), so nothing clashes with the
// settings other tests keep in the shared conductor.
function settings(name: string, extra = "") {
  return `
[[jobworkerp]]
name = "${name}-server"
address = "http://${name}.invalid:9000"
description = "from a file"

[[schedulers]]
name = "${name}-nightly"
jobworkerp = "${name}-server"
crontab = "0 0 3 * * *"
worker_name = "report"
enabled = false
${extra}`
}

const names = async (kind: "servers" | "schedules") =>
  (await listConfig(conductor, kind)).map((entry) => entry.data.name)

describe("config management service", () => {
  it("validates without writing, then imports what it validated", async () => {
    prefix = uniqueName("it", "import")
    const toml = settings(prefix)

    const validated = await validateConfig(conductor, toml, false)
    expect(validated).toEqual({
      ok: true,
      counts: { servers: 1, schedules: 1, resultHandlers: 0, slackHandlers: 0 },
      errors: [],
    })
    expect(await names("schedules")).not.toContain(`${prefix}-nightly`)

    expect((await importConfig(conductor, toml, false)).ok).toBe(true)
    const nightly = (await listConfig(conductor, "schedules")).find(
      (s) => s.data.name === `${prefix}-nightly`,
    )
    expect(nightly?.data.enabled).toBe(false)

    const exported = (await exportConfig(conductor, false)).toml
    expect(exported).toContain(`name = "${prefix}-nightly"`)
    expect(exported).toContain('description = "from a file"')
    expect((await exportConfig(conductor, true)).toml).not.toContain(`${prefix}-nightly`)
  })

  it("reports what an export leaves out: settings whose server is gone", async () => {
    prefix = uniqueName("it", "orphan")
    expect((await importConfig(conductor, settings(prefix), false)).ok).toBe(true)
    const server = (await listConfig(conductor, "servers")).find(
      (s) => s.data.name === `${prefix}-server`,
    )!
    // conductor lets a server go while settings still name it.
    await deleteConfig(conductor, "servers", server.id)

    const exported = await exportConfig(conductor, false)
    expect(exported.toml).not.toContain(`${prefix}-nightly`)
    expect(exported.leftOut.join("\n")).toContain(`${prefix}-nightly`)
  })

  it("lists every entry that cannot be imported and writes nothing", async () => {
    prefix = uniqueName("it", "broken")
    const broken = settings(
      prefix,
      `
[[slack_handlers]]
name = "${prefix}-bad"
jobworkerp = "${prefix}-server"
message_pattern = "("
worker_name = "w"

[[schedulers]]
name = "${prefix}-nowhere"
jobworkerp = "${prefix}-missing"
crontab = "0 0 * * * *"
worker_name = "w"
`,
    )
    const result = await importConfig(conductor, broken, false)
    expect(result.ok).toBe(false)
    expect(result.errors, result.errors.join("\n")).toHaveLength(2)
    expect(result.errors.join("\n")).toContain(`${prefix}-bad`)
    expect(result.errors.join("\n")).toContain(`${prefix}-missing`)
    expect(await names("servers")).not.toContain(`${prefix}-server`)

    const malformed = await validateConfig(conductor, "[[jobworkerp", false)
    expect(malformed.ok).toBe(false)
    expect(malformed.errors).toHaveLength(1)
  })
})
