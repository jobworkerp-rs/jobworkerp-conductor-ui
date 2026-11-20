import { beforeAll, describe, expect, it } from "vitest"
import { EXECUTION_TARGET_DEFAULTS } from "@/lib/execution-target/form"
import type { ExecutionTargetContext } from "@/lib/execution-target/validate"
import { loadTestRustCron } from "@/test/wasm"
import {
  JOB_TIMEOUT_MAX,
  SCHEDULE_FORM_DEFAULTS,
  toScheduleData,
  toScheduleForm,
  validateScheduleForm,
  type ScheduleFormValues,
} from "./form"
import type { RustCron } from "./rust-cron"

let cron: RustCron
beforeAll(async () => {
  cron = await loadTestRustCron()
})

const context: ExecutionTargetContext = {
  kind: "schedule",
  workflowRunner: false,
  inlineAvailable: true,
}

const valid: ScheduleFormValues = {
  ...SCHEDULE_FORM_DEFAULTS,
  name: "nightly",
  crontab: "0 0 3 * * *",
  target: {
    ...EXECUTION_TARGET_DEFAULTS,
    serverId: "1",
    method: "worker",
    workerName: "w",
    args: '{"a":1}',
  },
}

const validate = (overrides: Partial<ScheduleFormValues>) =>
  validateScheduleForm({ ...valid, ...overrides }, context, cron)

describe("SCHEDULE_FORM_DEFAULTS", () => {
  it("starts enabled with no expression and conductor's default timeout", () => {
    expect(SCHEDULE_FORM_DEFAULTS).toMatchObject({ crontab: "", jobTimeoutSec: "", enabled: true })
  })
})

describe("validateScheduleForm", () => {
  it("accepts a valid schedule", () => {
    expect(validate({})).toEqual({})
  })

  it("requires an expression", () => {
    expect(validate({ crontab: "  " }).crontab).toEqual({ key: "common.formErrors.required" })
  })

  it("checks the expression with conductor's rules, after adding seconds", () => {
    expect(validate({ crontab: "0 3 * * *" })).toEqual({})
    expect(validate({ crontab: "0 0 24 * * *" }).crontab).toMatchObject({
      key: "schedules.form.errors.crontab",
      detail: expect.stringMatching(/.+/),
    })
    expect(validate({ crontab: "@midnight" }).crontab?.key).toBe("schedules.form.errors.crontab")
  })

  it("refuses to save while conductor's rules are not available", () => {
    // conductor stores any expression, so an unchecked one could never run.
    expect(validateScheduleForm(valid, context, undefined).crontab).toEqual({
      key: "schedules.form.errors.cronUnavailable",
    })
  })

  it("accepts a blank, zero or in-range whole-second timeout", () => {
    for (const jobTimeoutSec of ["", " ", "0", "1200", String(JOB_TIMEOUT_MAX)]) {
      expect(validate({ jobTimeoutSec }), jobTimeoutSec).toEqual({})
    }
  })

  it("refuses a timeout that is too large, negative, fractional or not a number", () => {
    for (const jobTimeoutSec of [String(JOB_TIMEOUT_MAX + 1), "-1", "1.5", "1e3", "abc"]) {
      expect(validate({ jobTimeoutSec }).jobTimeoutSec, jobTimeoutSec).toEqual({
        key: "schedules.form.errors.jobTimeout",
        values: { max: JOB_TIMEOUT_MAX },
      })
    }
  })

  it("reports the common name and target errors", () => {
    const errors = validate({ name: "", target: { ...valid.target, serverId: "" } })
    expect(errors.name).toBeDefined()
    expect(errors.target?.serverId).toBeDefined()
  })
})

describe("toScheduleData / toScheduleForm", () => {
  it("stores the normalized expression, the timeout and the target", () => {
    const data = toScheduleData(
      { ...valid, crontab: " 0 3 * * * ", jobTimeoutSec: "60", description: " d " },
      1_700_000_000.9,
    )
    expect(data).toMatchObject({
      name: "nightly",
      description: "d",
      crontab: "0 0 3 * * *",
      jobTimeoutSec: 60,
      enabled: true,
      jobworkerpServerId: { value: "1" },
      workflowUrl: "",
      worker: { workerName: "w" },
      args: '{"a":1}',
      createdAt: "1700000000",
      updatedAt: "1700000000",
    })
  })

  it("leaves the timeout unset when blank and sends zero as zero", () => {
    expect(toScheduleData({ ...valid, jobTimeoutSec: "" }, 1).jobTimeoutSec).toBeUndefined()
    expect(toScheduleData({ ...valid, jobTimeoutSec: "0" }, 1).jobTimeoutSec).toBe(0)
  })

  it("keeps the creation time on update", () => {
    expect(toScheduleData(valid, 2000, "1000")).toMatchObject({
      createdAt: "1000",
      updatedAt: "2000",
    })
  })

  it("round-trips through the stored form", () => {
    const form = { ...valid, description: "d", jobTimeoutSec: "0" }
    expect(toScheduleForm(toScheduleData(form, 1))).toEqual(form)
    expect(toScheduleForm(toScheduleData({ ...valid, jobTimeoutSec: "" }, 1)).jobTimeoutSec).toBe(
      "",
    )
  })
})
