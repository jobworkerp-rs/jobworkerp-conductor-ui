import type { ConfigKind } from "@/lib/execution-target/form"
import { navPath } from "@/lib/navigation"
import type { ConfigDataByKind, ConfigEntityKind } from "@/lib/services/config"

/** Settings that run something through the execution target (all but servers). */
export type TargetSettingKind = Exclude<ConfigEntityKind, "servers">

/** The execution target's name for each kind of setting. */
export const TARGET_KIND: Record<TargetSettingKind, ConfigKind> = {
  schedules: "schedule",
  slackHandlers: "slackHandler",
  resultHandlers: "resultHandler",
}

/** Every kind of setting with an execution target, in display order. */
export const TARGET_SETTING_KINDS = Object.keys(TARGET_KIND) as TargetSettingKind[]

/** The configuration list of each kind of setting (TARGET_KIND the other way round). */
export const SETTING_ENTITY = Object.fromEntries(
  Object.entries(TARGET_KIND).map(([entity, kind]) => [kind, entity]),
) as Record<ConfigKind, TargetSettingKind>

export const settingEditPath = (kind: ConfigKind, id: string) =>
  `${navPath(SETTING_ENTITY[kind])}/${id}/edit`

/** The server a setting's execution target runs on. */
export function targetServerIdOf<K extends TargetSettingKind>(
  kind: K,
  data: ConfigDataByKind[K],
): string {
  const id =
    kind === "resultHandlers"
      ? (data as ConfigDataByKind["resultHandlers"]).processJobworkerpServerId
      : (data as ConfigDataByKind["schedules" | "slackHandlers"]).jobworkerpServerId
  return id?.value ?? ""
}
