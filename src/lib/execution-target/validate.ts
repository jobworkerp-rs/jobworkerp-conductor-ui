import { compactErrors, requiredFieldError } from "@/lib/validation"
import { validateArgs } from "./args"
import { checkDefinitionSyntax } from "./definition"
import type { FieldError } from "@/lib/field-error"
import type { ConfigKind, ExecutionTargetForm } from "./form"
import { MANAGED_WORKER_NAME_MAX, validateManagedWorkerName } from "./managed-worker"

/** conductor's limit for Slack handler workflow URLs. */
export const SLACK_WORKFLOW_URL_MAX = 2048
const SLACK_URL_SCHEMES = ["http://", "https://", "file://"]

export type ExecutionTargetErrors = Partial<Record<keyof ExecutionTargetForm, FieldError>>

export interface ExecutionTargetContext {
  kind: ConfigKind
  /** The selected registered worker runs the WORKFLOW runner. */
  workflowRunner: boolean
  /** The server has a browser link to its jobworkerp, needed to store a definition. */
  inlineAvailable: boolean
}

function slackWorkflowUrl(url: string): FieldError | undefined {
  const valid =
    SLACK_URL_SCHEMES.some((scheme) => url.startsWith(scheme)) &&
    !url.includes("..") &&
    url.length <= SLACK_WORKFLOW_URL_MAX
  return valid
    ? undefined
    : { key: "executionTarget.errors.slackWorkflowUrl", values: { max: SLACK_WORKFLOW_URL_MAX } }
}

/** Checks only the fields of the selected method (spec §4.6.2). */
export function validateExecutionTarget(
  form: ExecutionTargetForm,
  context: ExecutionTargetContext,
): { errors: ExecutionTargetErrors; argsWarnings: string[] } {
  const errors: ExecutionTargetErrors = { serverId: requiredFieldError(form.serverId) }
  switch (form.method) {
    case "worker":
      errors.workerName = requiredFieldError(form.workerName)
      break
    case "workflowUrl": {
      const url = form.workflowUrl.trim()
      errors.workflowUrl =
        requiredFieldError(url) ??
        (context.kind === "slackHandler" ? slackWorkflowUrl(url) : undefined)
      break
    }
    case "workflowInline": {
      if (!context.inlineAvailable) {
        errors.method = { key: "executionTarget.errors.inlineUnavailable" }
      }
      errors.definition = checkDefinitionSyntax(form.definition)
      const nameError = validateManagedWorkerName(form.managedWorkerName.trim())
      errors.managedWorkerName = nameError
        ? { key: nameError, values: { max: MANAGED_WORKER_NAME_MAX } }
        : undefined
      break
    }
  }
  const args = validateArgs(form.args, {
    kind: context.kind,
    method: form.method,
    workflowRunner: context.workflowRunner,
  })
  errors.args = args.error
  return { errors: compactErrors(errors), argsWarnings: args.warnings }
}
