import * as protobuf from "protobufjs"
import type { Runner } from "@/lib/grpc/jobworkerp/data/runner"

/** jobworkerp's built-in runner for workflows. */
export const WORKFLOW_RUNNER_NAME = "WORKFLOW"

export function isWorkflowRunner(runner: Runner | undefined): boolean {
  return runner?.data?.name === WORKFLOW_RUNNER_NAME
}

export interface WorkflowSettings {
  workflowData?: string
  workflowUrl?: string
}

/** The first message type in a schema, or the one with `name`, at any depth. */
export function findMessageType(
  namespace: protobuf.NamespaceBase,
  name?: string,
): protobuf.Type | undefined {
  for (const nested of namespace.nestedArray) {
    if (nested instanceof protobuf.Type && (name === undefined || nested.name === name)) {
      return nested
    }
    if (nested instanceof protobuf.Namespace) {
      const found = findMessageType(nested, name)
      if (found) return found
    }
  }
  return undefined
}

// A runner reports the same schema text every time; parse it once.
const parsedTypes = new Map<string, protobuf.Type>()

/**
 * The settings schema comes from the runner itself (runner_settings_proto),
 * so a jobworkerp that renames or extends the message keeps working as long
 * as the field names stay.
 */
function settingsType(settingsProto: string): protobuf.Type {
  let type = parsedTypes.get(settingsProto)
  if (!type) {
    type = findMessageType(protobuf.parse(settingsProto, { keepCase: false }).root)
    if (!type) throw new Error("the WORKFLOW runner reports no settings message")
    parsedTypes.set(settingsProto, type)
  }
  return type
}

export function encodeWorkflowSettings(settingsProto: string, definition: string): Uint8Array {
  const type = settingsType(settingsProto)
  return type.encode(type.create({ workflowData: definition })).finish()
}

export function decodeWorkflowSettings(settingsProto: string, bytes: Uint8Array): WorkflowSettings {
  const type = settingsType(settingsProto)
  const decoded = type.toObject(type.decode(bytes)) as WorkflowSettings
  const settings: WorkflowSettings = {}
  if (decoded.workflowData !== undefined) settings.workflowData = decoded.workflowData
  if (decoded.workflowUrl !== undefined) settings.workflowUrl = decoded.workflowUrl
  return settings
}
