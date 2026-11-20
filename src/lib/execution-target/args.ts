import { isPlainObject, prettyJson } from "@/lib/json"
import { byteLength } from "@/lib/validation"
import type { FieldError } from "@/lib/field-error"
import { runsWorkflow, type ConfigKind, type TargetMethod } from "./form"

export const ARGS_MAX_KB = 64
export const ARGS_MAX_BYTES = ARGS_MAX_KB * 1024

export interface ArgsContext {
  kind: ConfigKind
  method: TargetMethod
  /** The selected registered worker runs the WORKFLOW runner. */
  workflowRunner: boolean
}

export interface ArgsCheck {
  /** Saving is refused. */
  error?: FieldError
  /** Top-level names that the WORKFLOW runner takes as its own arguments. */
  warnings: string[]
}

// conductor sends args that look like WorkflowRunArgs to the WORKFLOW runner
// as they are, instead of wrapping them as the workflow input; these are the
// fields (and their JSON camelCase forms) that trigger it.
const RESERVED_STRING_FIELDS = [
  "input",
  "workflow_url",
  "workflowUrl",
  "workflow_data",
  "workflowData",
  "workflow_context",
  "workflowContext",
  "execution_id",
  "executionId",
]
const RESERVED_OBJECT_FIELDS = [
  "workflow_source",
  "workflowSource",
  "from_checkpoint",
  "fromCheckpoint",
]

/**
 * Result handlers put the args under "args", so only schedules and Slack
 * events that end up running a workflow through a worker are affected.
 */
function reservedNamesApply({ kind, method, workflowRunner }: ArgsContext): boolean {
  // A URL target is always sent as workflow_url + input, whatever the args hold.
  return (
    kind !== "resultHandler" && method !== "workflowUrl" && runsWorkflow(method, workflowRunner)
  )
}

export function validateArgs(text: string, context: ArgsContext): ArgsCheck {
  if (text.trim() === "") return { warnings: [] }
  if (byteLength(text) > ARGS_MAX_BYTES) {
    return {
      error: { key: "executionTarget.args.errors.tooLarge", values: { kb: ARGS_MAX_KB } },
      warnings: [],
    }
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (err) {
    return {
      error: { key: "executionTarget.args.errors.invalidJson", detail: (err as Error).message },
      warnings: [],
    }
  }
  if (context.kind === "slackHandler") {
    // conductor drops non-object args and merges the event under slack_event.
    if (!isPlainObject(value))
      return { error: { key: "executionTarget.args.errors.slackObject" }, warnings: [] }
    if ("slack_event" in value) {
      return { error: { key: "executionTarget.args.errors.slackEvent" }, warnings: [] }
    }
  }
  if (!isPlainObject(value) || !reservedNamesApply(context)) return { warnings: [] }
  const warnings = Object.keys(value).filter(
    (key) =>
      (RESERVED_STRING_FIELDS.includes(key) && typeof value[key] === "string") ||
      (RESERVED_OBJECT_FIELDS.includes(key) && isPlainObject(value[key])),
  )
  return { warnings }
}

/**
 * What keeps args from being saved or sent. Unlike the warnings, it does not
 * depend on the target, so callers without one (a one-off run) can check.
 */
export function argsError(text: string, kind: ConfigKind): FieldError | undefined {
  return validateArgs(text, { kind, method: "worker", workflowRunner: false }).error
}

/** Args indented for reading; text that is not JSON is left as it is. */
export const formatArgs = prettyJson
