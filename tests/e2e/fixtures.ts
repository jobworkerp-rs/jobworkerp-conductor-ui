import AxeBuilder from "@axe-core/playwright"
import { expect, test as base, type Page } from "@playwright/test"
import { createConductorClients, createJobworkerpClients } from "../../src/lib/clients"
import type { ExecutionTargetForm } from "../../src/lib/execution-target/form"
import { nowSeconds } from "../../src/lib/format"
import { toScheduleData, type ScheduleFormValues } from "../../src/lib/schedules/form"
import { SERVER_FORM_DEFAULTS, toServerData } from "../../src/lib/servers/form"
import { createConfig, deleteConfig, listConfig } from "../../src/lib/services/config"
import { uniqueName as uniqueNameWithPrefix } from "../../src/test/names"
import { inertScheduleForm } from "../../src/test/schedules"
import {
  TEST_CONDUCTOR_URL as CONDUCTOR_URL,
  TEST_JOBWORKERP_URL as JOBWORKERP_URL,
} from "../../src/test/endpoints"

export { CONDUCTOR_URL }

/**
 * Serves the runtime configuration the way a container would (config.js),
 * so each test can point the UI at a real or a deliberately unreachable
 * endpoint. The API itself is never stubbed.
 */
export async function serveRuntimeConfig(page: Page, config: Record<string, string>) {
  await page.route("**/config.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.__CONDUCTOR_UI_CONFIG__ = ${JSON.stringify(config)};`,
    }),
  )
}

export const realConfig = {
  conductorUrl: CONDUCTOR_URL,
  jobworkerpServers: JSON.stringify([
    { name: "local", grpcWebUrl: JOBWORKERP_URL, adminUiUrl: "http://127.0.0.1:5174" },
  ]),
}

/** A `test` whose `app` page runs the UI with the given runtime configuration. */
export const testWithConfig = (config: Record<string, string>) =>
  base.extend<{ app: Page }>({
    app: async ({ page }, use) => {
      await serveRuntimeConfig(page, config)
      await use(page)
    },
  })

export const test = testWithConfig(realConfig)

export { expect }

/** The real conductor admin API, for arranging and cleaning up test data. */
export const conductor = createConductorClients(CONDUCTOR_URL)
/** The jobworkerp behind the "local" server of the runtime configuration. */
export const jobworkerp = createJobworkerpClients(JOBWORKERP_URL)

export const uniqueName = (label: string) => uniqueNameWithPrefix("e2e", label)

/** Registers a server through the service the UI uses. */
export function createServerViaApi(name: string) {
  return createConfig(
    conductor,
    "servers",
    toServerData({ ...SERVER_FORM_DEFAULTS, name, host: "jw.e2e" }, nowSeconds()),
  )
}

/**
 * A schedule on the server through the service the UI uses: disabled and of
 * a worker that does not exist unless `target` and the values say otherwise.
 */
export function createScheduleViaApi(
  name: string,
  serverId: string,
  {
    target = { workerName: "e2e-worker" },
    ...values
  }: { target?: Partial<ExecutionTargetForm> } & Partial<Omit<ScheduleFormValues, "target">> = {},
) {
  return createConfig(
    conductor,
    "schedules",
    toScheduleData({ ...inertScheduleForm(name, serverId, target), ...values }, nowSeconds()),
  )
}

/**
 * Removes what a test created, found by the name prefix: settings first, then
 * servers, then jobworkerp workers (managed ones carry the setting name).
 */
export async function cleanUpByPrefix(prefix: string) {
  for (const kind of ["schedules", "slackHandlers", "resultHandlers", "servers"] as const) {
    for (const entry of await listConfig(conductor, kind)) {
      if (entry.data.name.startsWith(prefix)) await deleteConfig(conductor, kind, entry.id)
    }
  }
  for await (const worker of jobworkerp.worker.findList({ runnerTypes: [], runnerIds: [] })) {
    if (worker.id && worker.data?.name.includes(prefix)) await jobworkerp.worker.delete(worker.id)
  }
}

/** Axe check shared by every screen (spec §7.2): no serious or critical violations. */
export async function expectNoSeriousAxeViolations(page: Page) {
  // Mid fade-in, a dialog's colours are partly transparent and fail contrast
  // for a moment; check what the user ends up seeing (spinners never end).
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .every((animation) => animation.playState !== "running"),
  )
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  )
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([])
}
