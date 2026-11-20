import type { ConfigKind } from "@/lib/execution-target/form"
import type { ConfigEntity } from "@/lib/services/config"

export interface ConfigSnapshot {
  schedules: readonly ConfigEntity<"schedules">[]
  slackHandlers: readonly ConfigEntity<"slackHandlers">[]
  resultHandlers: readonly ConfigEntity<"resultHandlers">[]
}

/** The settings that can use a server: those with an execution target. */
export type ReferenceKind = ConfigKind
/** target: runs there; listen: result handler watches it; process: result handler runs there. */
export type ReferenceRole = "target" | "listen" | "process"

export interface ServerReference {
  kind: ReferenceKind
  id: string
  name: string
  roles: ReferenceRole[]
  enabled: boolean
}

interface Candidate {
  kind: ReferenceKind
  id: string
  name: string
  enabled: boolean
  servers: [ReferenceRole, string | undefined][]
}

function candidates(snapshot: ConfigSnapshot): Candidate[] {
  const list: Candidate[] = []
  for (const { id, data } of snapshot.schedules) {
    list.push({
      kind: "schedule",
      id,
      name: data.name,
      enabled: data.enabled,
      servers: [["target", data.jobworkerpServerId?.value]],
    })
  }
  for (const { id, data } of snapshot.slackHandlers) {
    list.push({
      kind: "slackHandler",
      id,
      name: data.name,
      enabled: data.enabled,
      servers: [["target", data.jobworkerpServerId?.value]],
    })
  }
  for (const { id, data } of snapshot.resultHandlers) {
    list.push({
      kind: "resultHandler",
      id,
      name: data.name,
      enabled: data.enabled,
      servers: [
        ["listen", data.listenJobworkerpServerId?.value],
        ["process", data.processJobworkerpServerId?.value],
      ],
    })
  }
  return list
}

/** Configurations that use the server; conductor does not prevent deleting it (spec §6.2). */
export function findServerReferences(
  serverId: string,
  snapshot: ConfigSnapshot,
): ServerReference[] {
  return candidates(snapshot).flatMap(({ servers, ...entry }) => {
    const roles = servers.filter(([, server]) => server === serverId).map(([role]) => role)
    return roles.length > 0 ? [{ ...entry, roles }] : []
  })
}

/** Number of configurations using each server id; each configuration counts once. */
export function countReferencesByServer(snapshot: ConfigSnapshot): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { servers } of candidates(snapshot)) {
    for (const server of new Set(servers.map(([, s]) => s))) {
      if (server !== undefined) counts.set(server, (counts.get(server) ?? 0) + 1)
    }
  }
  return counts
}

const KIND_ORDER: ReferenceKind[] = ["schedule", "slackHandler", "resultHandler"]

export function countReferencesByKind(
  references: readonly ServerReference[],
): Record<ReferenceKind, number> {
  return Object.fromEntries(
    KIND_ORDER.map((kind) => [kind, references.filter((r) => r.kind === kind).length]),
  ) as Record<ReferenceKind, number>
}

export function groupReferencesByKind(
  references: readonly ServerReference[],
): { kind: ReferenceKind; names: string[] }[] {
  return KIND_ORDER.map((kind) => ({
    kind,
    names: references.filter((r) => r.kind === kind).map((r) => r.name),
  })).filter((group) => group.names.length > 0)
}
