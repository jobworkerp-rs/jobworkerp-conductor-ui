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
import type { WorkerResultHandlerData } from "@/lib/grpc/jobworkerp_conductor/data/worker_result_handler"
import {
  compactErrors,
  hasErrors,
  descriptionFieldError,
  nameFieldError,
  requiredFieldError,
} from "@/lib/validation"

export interface ResultHandlerFormValues {
  name: string
  description: string
  listenServerId: string
  listenWorkerName: string
  enabled: boolean
  target: ExecutionTargetForm
}

export const RESULT_HANDLER_FORM_DEFAULTS: ResultHandlerFormValues = {
  name: "",
  description: "",
  listenServerId: "",
  listenWorkerName: "",
  enabled: true,
  target: EXECUTION_TARGET_DEFAULTS,
}

export type ResultHandlerFormErrors = Partial<
  Record<Exclude<keyof ResultHandlerFormValues, "target">, FieldError>
> & { target?: ExecutionTargetErrors }

export function validateResultHandlerForm(
  values: ResultHandlerFormValues,
  targetContext: ExecutionTargetContext,
): ResultHandlerFormErrors {
  const target = validateExecutionTarget(values.target, targetContext).errors
  return compactErrors<ResultHandlerFormErrors>({
    name: nameFieldError(values.name),
    description: descriptionFieldError(values.description),
    listenServerId: requiredFieldError(values.listenServerId),
    listenWorkerName: requiredFieldError(values.listenWorkerName),
    target: hasErrors(target) ? target : undefined,
  })
}

/**
 * conductor stores the timestamps the client sends (spec §4.3), so the UI
 * stamps them; an update keeps the original creation time. The follow-up runs
 * on the execution target's server.
 */
export function toResultHandlerData(
  values: ResultHandlerFormValues,
  nowSeconds: number,
  createdAt?: string,
): WorkerResultHandlerData {
  const now = toEpochSeconds(nowSeconds)
  return {
    name: values.name.trim(),
    description: optional(values.description),
    listenJobworkerpServerId: { value: values.listenServerId },
    listenWorkerName: values.listenWorkerName.trim(),
    processJobworkerpServerId: { value: values.target.serverId },
    ...toStoredTarget(values.target),
    enabled: values.enabled,
    createdAt: createdAt ?? now,
    updatedAt: now,
  }
}

export function toResultHandlerForm(
  data: WorkerResultHandlerData,
  managed?: { definition: string; channel: string },
): ResultHandlerFormValues {
  return {
    name: data.name,
    description: data.description ?? "",
    listenServerId: data.listenJobworkerpServerId?.value ?? "",
    listenWorkerName: data.listenWorkerName,
    enabled: data.enabled,
    target: fromStoredTarget({
      serverId: data.processJobworkerpServerId?.value ?? "",
      stored: data,
      managed,
    }),
  }
}

/**
 * The follow-up runs where the watched worker lives unless the user chose
 * otherwise (spec §6.4): the target server follows the watched server while
 * the two still match.
 */
export function followListenServer(
  values: ResultHandlerFormValues,
  listenServerId: string,
): ResultHandlerFormValues {
  const follows = values.target.serverId === "" || values.target.serverId === values.listenServerId
  return {
    ...values,
    listenServerId,
    target: follows ? { ...values.target, serverId: listenServerId } : values.target,
  }
}
