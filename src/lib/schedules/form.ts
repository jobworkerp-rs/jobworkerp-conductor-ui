import {
  EXECUTION_TARGET_DEFAULTS,
  fromStoredTarget,
  optional,
  toStoredTarget,
  type ExecutionTargetForm,
} from "@/lib/execution-target/form"
import {
  validateExecutionTarget,
  type ExecutionTargetContext,
  type ExecutionTargetErrors,
} from "@/lib/execution-target/validate"
import type { FieldError } from "@/lib/field-error"
import { toEpochSeconds } from "@/lib/format"
import type { CronSchedulerData } from "@/lib/grpc/jobworkerp_conductor/data/cron_scheduler"
import {
  compactErrors,
  descriptionFieldError,
  hasErrors,
  nameFieldError,
  requiredFieldError,
} from "@/lib/validation"
import { normalizeCrontab } from "./crontab"
import type { RustCron } from "./rust-cron"

/** job_timeout_sec is a uint32; unset means conductor's default, 0 no limit. */
export const JOB_TIMEOUT_MAX = 4_294_967_295
/** conductor's default when the timeout is unset. */
export const JOB_TIMEOUT_DEFAULT_SEC = 1200

export interface ScheduleFormValues {
  name: string
  description: string
  crontab: string
  /** Whole seconds as typed; blank leaves conductor's default. */
  jobTimeoutSec: string
  enabled: boolean
  target: ExecutionTargetForm
}

export const SCHEDULE_FORM_DEFAULTS: ScheduleFormValues = {
  name: "",
  description: "",
  crontab: "",
  jobTimeoutSec: "",
  enabled: true,
  target: EXECUTION_TARGET_DEFAULTS,
}

export type ScheduleFormErrors = Partial<
  Record<Exclude<keyof ScheduleFormValues, "target">, FieldError>
> & { target?: ExecutionTargetErrors }

function crontabError(input: string, cron: RustCron | undefined): FieldError | undefined {
  const required = requiredFieldError(input)
  if (required) return required
  // conductor stores any expression and only fails to schedule a bad one, so
  // nothing is saved unchecked.
  if (!cron) return { key: "schedules.form.errors.cronUnavailable" }
  const message = cron.check(normalizeCrontab(input).expression)
  return message === undefined
    ? undefined
    : { key: "schedules.form.errors.crontab", detail: message }
}

function jobTimeoutError(input: string): FieldError | undefined {
  const text = input.trim()
  if (text === "" || (/^\d+$/.test(text) && Number(text) <= JOB_TIMEOUT_MAX)) return undefined
  return { key: "schedules.form.errors.jobTimeout", values: { max: JOB_TIMEOUT_MAX } }
}

export function validateScheduleForm(
  values: ScheduleFormValues,
  targetContext: ExecutionTargetContext,
  cron: RustCron | undefined,
): ScheduleFormErrors {
  const target = validateExecutionTarget(values.target, targetContext).errors
  return compactErrors<ScheduleFormErrors>({
    name: nameFieldError(values.name),
    description: descriptionFieldError(values.description),
    crontab: crontabError(values.crontab, cron),
    jobTimeoutSec: jobTimeoutError(values.jobTimeoutSec),
    target: hasErrors(target) ? target : undefined,
  })
}

/**
 * conductor stores the timestamps the client sends (spec §4.3), so the UI
 * stamps them; an update keeps the original creation time.
 */
export function toScheduleData(
  values: ScheduleFormValues,
  nowSeconds: number,
  createdAt?: string,
): CronSchedulerData {
  const now = toEpochSeconds(nowSeconds)
  const timeout = values.jobTimeoutSec.trim()
  return {
    name: values.name.trim(),
    description: optional(values.description),
    jobworkerpServerId: { value: values.target.serverId },
    crontab: normalizeCrontab(values.crontab).expression,
    jobTimeoutSec: timeout === "" ? undefined : Number(timeout),
    ...toStoredTarget(values.target),
    enabled: values.enabled,
    createdAt: createdAt ?? now,
    updatedAt: now,
  }
}

export function toScheduleForm(
  data: CronSchedulerData,
  managed?: { definition: string; channel: string },
): ScheduleFormValues {
  return {
    name: data.name,
    description: data.description ?? "",
    crontab: data.crontab,
    jobTimeoutSec: data.jobTimeoutSec === undefined ? "" : String(data.jobTimeoutSec),
    enabled: data.enabled,
    target: fromStoredTarget({
      serverId: data.jobworkerpServerId?.value ?? "",
      stored: data,
      managed,
    }),
  }
}
