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
import {
  ReactionOperation,
  type SlackEventHandlerData,
} from "@/lib/grpc/jobworkerp_conductor/data/slack_event_handler"
import {
  byteLength,
  compactErrors,
  descriptionFieldError,
  hasErrors,
  nameFieldError,
} from "@/lib/validation"
import type { RustRegex } from "./rust-regex"

export type SlackEventKind = "message" | "reaction"

// conductor's limits (its validation counts bytes, as Rust's str::len does).
export const PATTERN_MAX_BYTES = 500
export const REACTION_NAMES_MAX = 50
const REACTION_NAME_MAX_BYTES = 100
/**
 * conductor requires timeout_sec but does not use it when running
 * (conductor #81), so the UI sends its documented default.
 */
export const SLACK_TIMEOUT_SEC = 3600

/** The reaction events a handler can wait for, with their catalog key. */
export const REACTION_OPERATIONS = [
  [ReactionOperation.REACTION_OPERATION_ADDED, "added"],
  [ReactionOperation.REACTION_OPERATION_REMOVED, "removed"],
  [ReactionOperation.REACTION_OPERATION_BOTH, "both"],
] as const

export interface SlackHandlerFormValues {
  name: string
  description: string
  kind: SlackEventKind
  channelId: string
  messagePattern: string
  mentionRequired: boolean
  reactionNames: string[]
  reactionOperation: ReactionOperation
  reactionUserFilter: string
  enabled: boolean
  target: ExecutionTargetForm
}

export const SLACK_HANDLER_FORM_DEFAULTS: SlackHandlerFormValues = {
  name: "",
  description: "",
  kind: "message",
  channelId: "",
  messagePattern: "",
  mentionRequired: false,
  reactionNames: [],
  reactionOperation: ReactionOperation.REACTION_OPERATION_ADDED,
  reactionUserFilter: "",
  enabled: true,
  target: EXECUTION_TARGET_DEFAULTS,
}

export type SlackHandlerFormErrors = Partial<
  Record<Exclude<keyof SlackHandlerFormValues, "target">, FieldError>
> & { target?: ExecutionTargetErrors }

// Patterns are significant to the character, so only an empty one is "none".
const pattern = (text: string) => (text === "" ? undefined : text)

/** Splits typed text into reaction names: ":+1:, eyes" → ["+1", "eyes"], without duplicates. */
export function addReactionNames(current: readonly string[], input: string): string[] {
  const added = input
    .split(/[\s,]+/)
    .map((name) => name.replaceAll(":", ""))
    .filter((name) => name !== "")
  return [...new Set([...current, ...added])]
}

/** Slack public (C…) and private (G…) channel IDs. */
export function isValidChannelId(id: string): boolean {
  return /^[CG][A-Z0-9]{2,}$/.test(id)
}

// Rust's char::is_alphanumeric: the Alphabetic property or a numeric category.
const REACTION_NAME = /^[\p{Alphabetic}\p{N}_+-]*$/u

function reactionNamesError(names: readonly string[]): FieldError | undefined {
  if (names.length > REACTION_NAMES_MAX) {
    return {
      key: "slackHandlers.form.errors.tooManyReactions",
      values: { max: REACTION_NAMES_MAX },
    }
  }
  const invalid = names.find(
    (name) => byteLength(name) > REACTION_NAME_MAX_BYTES || !REACTION_NAME.test(name),
  )
  return invalid === undefined
    ? undefined
    : { key: "slackHandlers.form.errors.invalidReaction", values: { name: invalid } }
}

function patternError(value: string, regex: RustRegex | undefined): FieldError | undefined {
  if (value === "") return undefined
  if (byteLength(value) > PATTERN_MAX_BYTES) {
    return { key: "slackHandlers.form.errors.patternTooLong", values: { max: PATTERN_MAX_BYTES } }
  }
  // Without the regex module, conductor's own check on save decides.
  const message = regex?.check(value)
  return message === undefined
    ? undefined
    : { key: "slackHandlers.form.errors.regex", detail: message }
}

export function validateSlackHandlerForm(
  values: SlackHandlerFormValues,
  targetContext: ExecutionTargetContext,
  regex: RustRegex | undefined,
): SlackHandlerFormErrors {
  const target = validateExecutionTarget(values.target, targetContext).errors
  const channelId = values.channelId.trim()
  const errors: SlackHandlerFormErrors = {
    name: nameFieldError(values.name),
    description: descriptionFieldError(values.description),
    channelId:
      channelId === "" || isValidChannelId(channelId)
        ? undefined
        : { key: "slackHandlers.form.errors.channelId" },
    target: hasErrors(target) ? target : undefined,
  }
  if (values.kind === "message") {
    // conductor needs at least one condition to tell the kind apart.
    errors.messagePattern =
      values.messagePattern === "" && !values.mentionRequired
        ? { key: "slackHandlers.form.errors.needCondition" }
        : patternError(values.messagePattern, regex)
  } else {
    errors.reactionNames = reactionNamesError(values.reactionNames)
    errors.reactionUserFilter = patternError(values.reactionUserFilter, regex)
  }
  return compactErrors(errors)
}

/**
 * conductor keeps message and reaction conditions mutually exclusive, so only
 * the chosen kind's conditions are sent; the kind can then be read back from
 * the data (spec §6.5).
 */
export function toSlackHandlerData(
  values: SlackHandlerFormValues,
  nowSeconds: number,
  createdAt?: string,
): SlackEventHandlerData {
  const now = toEpochSeconds(nowSeconds)
  const isMessage = values.kind === "message"
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    enabled: values.enabled,
    slackChannelId: optional(values.channelId),
    messagePattern: isMessage ? pattern(values.messagePattern) : undefined,
    mentionRequired: isMessage && values.mentionRequired,
    reactionNames:
      !isMessage && values.reactionNames.length > 0 ? values.reactionNames.join(",") : undefined,
    reactionOperation: isMessage
      ? ReactionOperation.REACTION_OPERATION_UNSPECIFIED
      : values.reactionOperation,
    reactionUserFilter: isMessage ? undefined : pattern(values.reactionUserFilter),
    jobworkerpServerId: { value: values.target.serverId },
    timeoutSec: SLACK_TIMEOUT_SEC,
    ...toStoredTarget(values.target),
    // A required string field in this message, unlike the other settings.
    channel: "",
    createdAt: createdAt ?? now,
    updatedAt: now,
  }
}

export function eventKindOf(data: SlackEventHandlerData): SlackEventKind {
  const reactionCondition =
    data.reactionNames !== undefined ||
    data.reactionOperation !== ReactionOperation.REACTION_OPERATION_UNSPECIFIED
  return reactionCondition ? "reaction" : "message"
}

export function toSlackHandlerForm(
  data: SlackEventHandlerData,
  managed?: { definition: string; channel: string },
): SlackHandlerFormValues {
  const kind = eventKindOf(data)
  return {
    name: data.name,
    description: data.description,
    kind,
    channelId: data.slackChannelId ?? "",
    messagePattern: data.messagePattern ?? "",
    mentionRequired: data.mentionRequired,
    reactionNames: addReactionNames([], data.reactionNames ?? ""),
    reactionOperation:
      kind === "reaction" ? data.reactionOperation : SLACK_HANDLER_FORM_DEFAULTS.reactionOperation,
    reactionUserFilter: data.reactionUserFilter ?? "",
    enabled: data.enabled,
    target: fromStoredTarget({
      serverId: data.jobworkerpServerId?.value ?? "",
      stored: { ...data, channel: data.channel || undefined },
      managed,
    }),
  }
}
