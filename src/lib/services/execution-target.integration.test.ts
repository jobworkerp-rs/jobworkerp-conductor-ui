// Requires two running jobworkerp instances: bash scripts/test-env.sh up
import { afterEach, describe, expect, it } from "vitest"
import { createJobworkerpClients, type JobworkerpClients } from "@/lib/clients"
import type { ManagedWorkerRef } from "@/lib/execution-target/cleanup"
import { WORKFLOW_TEMPLATE } from "@/lib/execution-target/definition"
import {
  EXECUTION_TARGET_DEFAULTS,
  type ExecutionTargetForm,
  type StoredTarget,
} from "@/lib/execution-target/form"
import type { JobworkerpServerLink } from "@/lib/runtime-config"
import { TEST_JOBWORKERP2_URL, TEST_JOBWORKERP_URL } from "@/test/endpoints"
import { uniqueName } from "@/test/names"
import { deleteWorkerByName } from "@/test/workers"
import { deleteSettingWithTarget, saveSettingWithTarget } from "./execution-target"
import { loadManagedWorkflow } from "./managed-workflows"

const link1: JobworkerpServerLink = { name: "one", grpcWebUrl: TEST_JOBWORKERP_URL }
const link2: JobworkerpServerLink = { name: "two", grpcWebUrl: TEST_JOBWORKERP2_URL }
// A second conductor server that reaches the same jobworkerp as "one".
const link1b: JobworkerpServerLink = { name: "one-again", grpcWebUrl: TEST_JOBWORKERP_URL }
const clients = new Map<string, JobworkerpClients>([
  ["1", createJobworkerpClients(TEST_JOBWORKERP_URL)],
  ["2", createJobworkerpClients(TEST_JOBWORKERP2_URL)],
  ["1b", createJobworkerpClients(TEST_JOBWORKERP_URL)],
])
const links: Record<string, JobworkerpServerLink> = { "1": link1, "2": link2, "1b": link1b }
const clientsFor = (serverId: string) => clients.get(serverId)
const linkFor = (serverId: string) => links[serverId]
const jw = (serverId: string) => clients.get(serverId)!

const created: [string, string][] = []
afterEach(async () => {
  for (const [serverId, name] of created.splice(0)) {
    const c = clients.get(serverId)
    if (c) await deleteWorkerByName(c, name).catch(() => {})
  }
})

function inlineForm(serverId: string, name: string): ExecutionTargetForm {
  created.push([serverId, name])
  return {
    ...EXECUTION_TARGET_DEFAULTS,
    serverId,
    method: "workflowInline",
    definition: WORKFLOW_TEMPLATE,
    managedWorkerName: name,
    args: '{"a":1}',
  }
}

const ref = (serverId: string, workerName: string): ManagedWorkerRef => ({
  serverId,
  workerName,
  link: linkFor(serverId),
})

async function status(serverId: string, name: string) {
  return (await loadManagedWorkflow(jw(serverId), name)).status
}

function recorder() {
  const saved: StoredTarget[] = []
  return { saved, save: async (target: StoredTarget) => void saved.push(target) }
}

describe("saveSettingWithTarget", () => {
  it("stores an inline definition, then saves the setting to run it", async () => {
    const name = uniqueName("it-target", "new")
    const { saved, save } = recorder()
    const result = await saveSettingWithTarget({
      form: inlineForm("1", name),
      kind: "schedule",
      settingName: "daily",
      clientsFor,
      linkFor,
      keepObsolete: false,
      save,
    })
    expect(saved).toEqual([
      expect.objectContaining({ worker: { workerName: name, using: "run" }, args: '{"a":1}' }),
    ])
    expect(result.cleanup).toBe("none")
    expect(await status("1", name)).toBe("found")
  })

  it("leaves the worker as it was when the setting cannot be saved", async () => {
    const name = uniqueName("it-target", "fail")
    await expect(
      saveSettingWithTarget({
        form: inlineForm("1", name),
        kind: "schedule",
        settingName: "daily",
        clientsFor,
        linkFor,
        keepObsolete: false,
        save: () => Promise.reject(new Error("conductor refused")),
      }),
    ).rejects.toThrow("conductor refused")
    expect(await status("1", name)).toBe("missing")
  })

  it("deletes the managed worker when switching to another method, unless kept", async () => {
    for (const keepObsolete of [false, true]) {
      const name = uniqueName("it-target", `switch-${keepObsolete}`)
      await saveSettingWithTarget({
        form: inlineForm("1", name),
        kind: "schedule",
        settingName: "daily",
        clientsFor,
        linkFor,
        keepObsolete: false,
        save: async () => {},
      })
      const result = await saveSettingWithTarget({
        form: { ...EXECUTION_TARGET_DEFAULTS, serverId: "1", method: "worker", workerName: "w" },
        previous: ref("1", name),
        kind: "schedule",
        settingName: "daily",
        clientsFor,
        linkFor,
        keepObsolete,
        save: async () => {},
      })
      expect(result.cleanup).toBe(keepObsolete ? "kept" : "deleted")
      expect(await status("1", name)).toBe(keepObsolete ? "found" : "missing")
    }
  })

  it("moves the worker to another jobworkerp when the server changes", async () => {
    const name = uniqueName("it-target", "move")
    created.push(["2", name])
    await saveSettingWithTarget({
      form: inlineForm("1", name),
      kind: "schedule",
      settingName: "daily",
      clientsFor,
      linkFor,
      keepObsolete: false,
      save: async () => {},
    })
    const result = await saveSettingWithTarget({
      form: { ...inlineForm("2", name) },
      previous: ref("1", name),
      kind: "schedule",
      settingName: "daily",
      clientsFor,
      linkFor,
      keepObsolete: false,
      save: async () => {},
    })
    expect(result.cleanup).toBe("deleted")
    expect(await status("1", name)).toBe("missing")
    expect(await status("2", name)).toBe("found")
  })

  it("keeps the worker when the new server reaches the same jobworkerp", async () => {
    const name = uniqueName("it-target", "same")
    await saveSettingWithTarget({
      form: inlineForm("1", name),
      kind: "schedule",
      settingName: "daily",
      clientsFor,
      linkFor,
      keepObsolete: false,
      save: async () => {},
    })
    const result = await saveSettingWithTarget({
      form: inlineForm("1b", name),
      previous: ref("1", name),
      kind: "schedule",
      settingName: "daily",
      clientsFor,
      linkFor,
      keepObsolete: false,
      save: async () => {},
    })
    expect(result.cleanup).toBe("none")
    expect(await status("1", name)).toBe("found")
  })

  it("reports a failed cleanup without failing the save", async () => {
    const result = await saveSettingWithTarget({
      form: { ...EXECUTION_TARGET_DEFAULTS, serverId: "1", method: "worker", workerName: "w" },
      previous: { serverId: "gone", workerName: "w", link: undefined },
      kind: "schedule",
      settingName: "daily",
      clientsFor: (id) =>
        id === "gone" ? createJobworkerpClients("http://127.0.0.1:9") : clientsFor(id),
      linkFor,
      keepObsolete: false,
      save: async () => "saved",
    })
    expect(result).toMatchObject({ saved: "saved", cleanup: "failed" })
    expect(result.cleanupError).toBeDefined()
  })

  it("needs a jobworkerp link to store a definition", async () => {
    await expect(
      saveSettingWithTarget({
        form: inlineForm("unlinked", uniqueName("it-target", "unlinked")),
        kind: "schedule",
        settingName: "daily",
        clientsFor,
        linkFor,
        keepObsolete: false,
        save: async () => {},
      }),
    ).rejects.toMatchObject({ messageKey: "executionTarget.errors.inlineUnavailable" })
  })
})

describe("deleteSettingWithTarget", () => {
  it("deletes the setting and then its managed worker, unless kept", async () => {
    for (const keepObsolete of [false, true]) {
      const name = uniqueName("it-target", `delete-${keepObsolete}`)
      await saveSettingWithTarget({
        form: inlineForm("1", name),
        kind: "schedule",
        settingName: "daily",
        clientsFor,
        linkFor,
        keepObsolete: false,
        save: async () => {},
      })
      let removed = false
      const result = await deleteSettingWithTarget({
        managed: ref("1", name),
        clientsFor,
        keepObsolete,
        remove: async () => {
          removed = true
        },
      })
      expect(removed).toBe(true)
      expect(result.cleanup).toBe(keepObsolete ? "kept" : "deleted")
      expect(await status("1", name)).toBe(keepObsolete ? "found" : "missing")
    }
  })

  it("keeps the worker when the setting cannot be deleted", async () => {
    const name = uniqueName("it-target", "delete-fail")
    await saveSettingWithTarget({
      form: inlineForm("1", name),
      kind: "schedule",
      settingName: "daily",
      clientsFor,
      linkFor,
      keepObsolete: false,
      save: async () => {},
    })
    await expect(
      deleteSettingWithTarget({
        managed: ref("1", name),
        clientsFor,
        keepObsolete: false,
        remove: () => Promise.reject(new Error("conductor refused")),
      }),
    ).rejects.toThrow("conductor refused")
    expect(await status("1", name)).toBe("found")
  })
})
