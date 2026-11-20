import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { MessageList } from "@/components/common/message-list"
import { useServers } from "@/hooks/use-config"
import { workerOptions } from "@/hooks/use-jobworkerp"
import { useNotify } from "@/hooks/use-notify"
import { useRuntime } from "@/hooks/use-runtime"
import type { JobworkerpClients } from "@/lib/clients"
import { downloadText } from "@/lib/download"
import { findEntity } from "@/lib/entities"
import { isManagedWorker } from "@/lib/execution-target/managed-worker"
import {
  clearAllSettings,
  exportConfig,
  importConfig,
  type WorkerToDelete,
} from "@/lib/services/config-management"
import type { ConfigSnapshot } from "@/lib/servers/references"
import {
  classifyWorkerTargets,
  exportFileName,
  uniqueWorkers,
  workerTargets,
  type WorkerTarget,
} from "@/lib/settings-io"

/** A setting whose worker the UI manages, with the jobworkerp that holds it. */
export interface ManagedInUse extends WorkerTarget {
  serverName: string
  clients: JobworkerpClients
}

/**
 * Settings keeping a workflow definition in a managed worker (spec §6.7).
 * `unverified` are those whose jobworkerp cannot be asked (no browser link,
 * or unreachable) but whose worker is named like a managed one.
 */
export interface ManagedWorkers {
  managed: ManagedInUse[]
  unverified: WorkerTarget[]
  pending: boolean
}

const workerKey = (target: { serverId: string; workerName: string }) =>
  JSON.stringify([target.serverId, target.workerName])

export function useManagedWorkers(snapshot: ConfigSnapshot | undefined): ManagedWorkers {
  const { jobworkerp } = useRuntime()
  const servers = useServers({ poll: false })
  const targets = useMemo(() => (snapshot ? workerTargets(snapshot) : []), [snapshot])
  const linked = useMemo(() => {
    const byTarget = new Map<WorkerTarget, ManagedInUse>()
    for (const target of targets) {
      const serverName = servers.data && findEntity(servers.data, target.serverId)?.data.name
      const clients = serverName ? jobworkerp.get(serverName) : undefined
      if (serverName && clients) byTarget.set(target, { ...target, serverName, clients })
    }
    return byTarget
  }, [targets, servers.data, jobworkerp])
  // One lookup per worker, however many settings share it.
  const lookups = useMemo(() => uniqueWorkers([...linked.values()]), [linked])
  return useQueries({
    queries: lookups.map((w) => ({
      ...workerOptions(w.serverName, w.clients, w.workerName),
      // An unreachable jobworkerp only makes its settings unverified.
      retry: false,
    })),
    combine: (results) => {
      const verdicts = new Map(
        lookups.map((w, i) => {
          const result = results[i]
          const worker = result?.data?.data
          return [workerKey(w), result?.isSuccess ? !!worker && isManagedWorker(worker) : undefined]
        }),
      )
      const { managed, unverified } = classifyWorkerTargets(targets, (target) =>
        linked.has(target) ? verdicts.get(workerKey(target)) : undefined,
      )
      return {
        managed: managed.flatMap((target) => linked.get(target) ?? []),
        unverified,
        pending: snapshot === undefined || servers.isPending || results.some((r) => r.isPending),
      }
    },
  })
}

/** Setting lists change wholesale after an import or clear; the rest follows from them. */
function useRefreshSettings() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["config"] })
}

/** Downloads the settings as a TOML file, saying which settings it could not hold. */
export function useExportDownload() {
  const { t } = useTranslation()
  const { conductor } = useRuntime()
  const notify = useNotify()
  return useMutation({
    mutationFn: (enabledOnly: boolean) => exportConfig(conductor, enabledOnly),
    onSuccess: ({ toml, leftOut }) => {
      downloadText(exportFileName(new Date()), toml)
      if (leftOut.length > 0) {
        notify.failure(
          t("settingsPage.export.leftOut", { count: leftOut.length }),
          <MessageList messages={leftOut} />,
        )
      }
    },
    onError: (err) => notify.error(err),
  })
}

/**
 * Imports a file; the lists are refetched even when the call fails, since
 * conductor may have written before the failure came back.
 */
export function useImportSettings() {
  const { conductor } = useRuntime()
  const refresh = useRefreshSettings()
  return async (toml: string, overwrite: boolean) => {
    try {
      return await importConfig(conductor, toml, overwrite)
    } finally {
      await refresh()
    }
  }
}

/** Deletes every setting and the given managed workers, then refetches the lists. */
export function useClearAllSettings() {
  const { conductor } = useRuntime()
  const refresh = useRefreshSettings()
  return async (workers: readonly WorkerToDelete[]) => {
    try {
      return await clearAllSettings(conductor, workers)
    } finally {
      await refresh()
    }
  }
}
