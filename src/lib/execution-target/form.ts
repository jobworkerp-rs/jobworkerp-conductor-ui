import type {
  WorkerExecution,
  WorkflowExecution,
} from "@/lib/grpc/jobworkerp_conductor/data/common"

export type ConfigKind = "schedule" | "slackHandler" | "resultHandler"

/**
 * - worker:         a worker already registered in jobworkerp, any runner
 * - workflowUrl:    a workflow definition at a URL or a path conductor can read
 * - workflowInline: a definition written here, stored as a managed WORKFLOW worker
 */
export type TargetMethod = "worker" | "workflowUrl" | "workflowInline"

export interface ExecutionTargetForm {
  serverId: string
  method: TargetMethod
  workerName: string
  using: string
  workflowUrl: string
  /** Job channel of both workflow methods; stored on the managed worker for inline ones. */
  channel: string
  definition: string
  managedWorkerName: string
  args: string
}

export const EXECUTION_TARGET_DEFAULTS: ExecutionTargetForm = {
  serverId: "",
  method: "worker",
  workerName: "",
  using: "",
  workflowUrl: "",
  channel: "",
  definition: "",
  managedWorkerName: "",
  args: "",
}

/** The execution fields shared by schedules, Slack handlers and result handlers. */
export interface StoredTarget {
  /** Deprecated: read for old data, never written. */
  workflowUrl: string
  /** Deprecated: read for old data, never written. */
  channel?: string | undefined
  workflow?: WorkflowExecution | undefined
  worker?: WorkerExecution | undefined
  args?: string | undefined
}

/** Trimmed, or undefined when blank: how optional strings are sent. */
export const optional = (value: string) => {
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

/** Only the selected method is sent; values typed for the others stay on screen only. */
export function toStoredTarget(form: ExecutionTargetForm): StoredTarget {
  const stored: StoredTarget = {
    workflowUrl: "",
    channel: undefined,
    workflow: undefined,
    worker: undefined,
    args: optional(form.args),
  }
  switch (form.method) {
    case "worker":
      stored.worker = { workerName: form.workerName.trim(), using: optional(form.using) }
      break
    case "workflowUrl":
      stored.workflow = { workflowUrl: form.workflowUrl.trim(), channel: optional(form.channel) }
      break
    case "workflowInline":
      stored.worker = { workerName: form.managedWorkerName.trim(), using: "run" }
      break
  }
  return stored
}

/**
 * Reads a stored target. Whether a worker target is an inline definition
 * depends on the worker in jobworkerp, so the caller passes what it found.
 */
export function fromStoredTarget({
  serverId,
  stored,
  managed,
}: {
  serverId: string
  stored: StoredTarget
  managed?: { definition: string; channel: string }
}): ExecutionTargetForm {
  const form = { ...EXECUTION_TARGET_DEFAULTS, serverId, args: stored.args ?? "" }
  if (stored.worker) {
    return managed
      ? {
          ...form,
          method: "workflowInline",
          managedWorkerName: stored.worker.workerName,
          definition: managed.definition,
          channel: managed.channel,
        }
      : {
          ...form,
          method: "worker",
          workerName: stored.worker.workerName,
          using: stored.worker.using ?? "",
        }
  }
  const workflow = stored.workflow ?? { workflowUrl: stored.workflowUrl, channel: stored.channel }
  return {
    ...form,
    method: "workflowUrl",
    workflowUrl: workflow.workflowUrl,
    channel: workflow.channel ?? "",
  }
}

/**
 * Whether the target ends up running a workflow, whose input then receives
 * what conductor passes (spec §4.6.3).
 */
export function runsWorkflow(method: TargetMethod, workflowRunner: boolean): boolean {
  return method !== "worker" || workflowRunner
}
