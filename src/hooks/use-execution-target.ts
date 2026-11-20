import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { configKey, useServer } from "@/hooks/use-config"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useJobworkerpServer, workerOptions } from "@/hooks/use-jobworkerp"
import { useNotify } from "@/hooks/use-notify"
import { useRuntime } from "@/hooks/use-runtime"
import { classifyError } from "@/lib/errors"
import { findEntity } from "@/lib/entities"
import {
  managedWorkerOf,
  obsoleteManagedWorker,
  type ManagedWorkerRef,
} from "@/lib/execution-target/cleanup"
import type { ConfigKind, ExecutionTargetForm, StoredTarget } from "@/lib/execution-target/form"
import { interpretStoredTarget } from "@/lib/execution-target/stored"
import type { ExecutionTargetContext } from "@/lib/execution-target/validate"
import { isWorkflowRunner } from "@/lib/execution-target/workflow-settings"
import { STALE_MS } from "@/lib/refresh"
import {
  fetchWorkerCandidates,
  findRunner,
  listChannels,
  narrowWorkers,
  planWorkerSearch,
} from "@/lib/services/jobworkerp"
import { listConfig } from "@/lib/services/config"
import {
  deleteSettingWithTarget,
  saveSettingWithTarget,
  type CleanupResult,
  type DeleteSettingInput,
  type SaveSettingInput,
} from "@/lib/services/execution-target"
import { isWorkerSaveError, loadManagedWorkflow } from "@/lib/services/managed-workflows"
import { TARGET_KIND, type TargetSettingKind } from "@/lib/settings"

const SEARCH_DEBOUNCE_MS = 250

/** The conductor server chosen in the form and its browser-side jobworkerp, if linked. */
export function useTargetServer(serverId: string) {
  const { query, server } = useServer(serverId, { poll: false })
  const serverName = server?.data.name
  const { link, clients } = useJobworkerpServer(serverName ?? "")
  return { servers: query, server, serverName, link, clients }
}

export function useWorkerSearch(serverId: string, prefix: string) {
  const { clients, serverName } = useTargetServer(serverId)
  const typed = useDebouncedValue(prefix.trim(), SEARCH_DEBOUNCE_MS)
  const plan = planWorkerSearch(typed)
  return useQuery({
    // Keyed by what the server is asked, so narrowing further reuses the result.
    queryKey: ["jobworkerp", serverName, "workers", plan.serverPrefix, plan.widened],
    queryFn: ({ signal }) => fetchWorkerCandidates(clients!, plan, { signal }),
    select: (workers) => (plan.widened ? narrowWorkers(workers, typed) : workers),
    enabled: clients !== undefined,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  })
}

/** The named worker; `null` when it does not exist. */
export function useWorker(serverId: string, workerName: string) {
  const { clients, serverName } = useTargetServer(serverId)
  const name = useDebouncedValue(workerName.trim(), SEARCH_DEBOUNCE_MS)
  return useQuery(workerOptions(serverName, clients, name))
}

/** A runner by id, shared by every worker that uses it. */
export function useRunner(serverId: string, runnerId: string | undefined) {
  const { clients, serverName } = useTargetServer(serverId)
  return useQuery({
    queryKey: ["jobworkerp", serverName, "runner", runnerId],
    queryFn: ({ signal }) => findRunner(clients!, runnerId!, signal),
    enabled: clients !== undefined && runnerId !== undefined,
    staleTime: STALE_MS,
  })
}

/** The named worker and its runner. */
export function useWorkerDetails(serverId: string, workerName: string) {
  const worker = useWorker(serverId, workerName)
  const runner = useRunner(serverId, worker.data?.data?.runnerId?.value)
  return { worker: worker.data, runner: runner.data }
}

export function useChannels(serverId: string) {
  const { clients, serverName } = useTargetServer(serverId)
  return useQuery({
    queryKey: ["jobworkerp", serverName, "channels"],
    queryFn: ({ signal }) => listChannels(clients!, signal),
    enabled: clients !== undefined,
    staleTime: STALE_MS,
  })
}

/** Reads an inline definition back for an edit page (spec §4.6.4). */
export function useManagedWorkflow(serverId: string, workerName: string | undefined) {
  const { clients, serverName } = useTargetServer(serverId)
  return useQuery({
    queryKey: ["jobworkerp", serverName, "managed-workflow", workerName],
    queryFn: ({ signal }) => loadManagedWorkflow(clients!, workerName!, signal),
    enabled: clients !== undefined && workerName !== undefined,
    staleTime: STALE_MS,
  })
}

/** What validation and the argument checks need to know about the current target. */
export function useExecutionTargetContext(
  kind: ConfigKind,
  form: ExecutionTargetForm,
): ExecutionTargetContext {
  const { link } = useTargetServer(form.serverId)
  const { runner } = useWorkerDetails(
    form.serverId,
    form.method === "worker" ? form.workerName : "",
  )
  return {
    kind,
    workflowRunner: isWorkflowRunner(runner),
    inlineAvailable: link?.grpcWebUrl !== undefined,
  }
}

/** How an edit page reads a stored target back; see interpretStoredTarget. */
export function useStoredTarget(serverId: string, stored: StoredTarget | undefined) {
  const { clients, link } = useTargetServer(serverId)
  const workerName = stored?.worker?.workerName
  const lookup = useManagedWorkflow(serverId, clients && workerName ? workerName : undefined)
  return interpretStoredTarget({
    serverId,
    link,
    linked: clients !== undefined,
    workerName,
    lookup: lookup.data,
  })
}

/**
 * Saves and deletes settings with their execution target. Servers are read
 * when an action runs, so the page does not re-render on every list refresh.
 */
export function useTargetActions() {
  const { config, jobworkerp, conductor } = useRuntime()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const notify = useNotify()
  return useMemo(() => {
    const resolvers = async () => {
      const servers = await queryClient.ensureQueryData({
        queryKey: configKey("servers"),
        queryFn: () => listConfig(conductor, "servers"),
      })
      const nameOf = (serverId: string) => findEntity(servers, serverId)?.data.name
      return {
        clientsFor: (serverId: string) => {
          const name = nameOf(serverId)
          return name === undefined ? undefined : jobworkerp.get(name)
        },
        linkFor: (serverId: string) =>
          config.jobworkerpServers.find((server) => server.name === nameOf(serverId)),
      }
    }
    // The setting itself is saved or deleted by then; a leftover worker is
    // reported, not undone.
    const reportCleanup = (result: CleanupResult) => {
      if (result.cleanup === "failed") {
        notify.error(
          result.cleanupError,
          t("settings.delete.cleanupFailed", { worker: result.obsolete?.workerName }),
        )
      }
    }
    return {
      async save<T>(input: Omit<SaveSettingInput<T>, "clientsFor" | "linkFor">) {
        const result = await saveSettingWithTarget({ ...input, ...(await resolvers()) })
        reportCleanup(result)
        return result.saved
      },
      async remove(input: Omit<DeleteSettingInput, "clientsFor">) {
        const { clientsFor } = await resolvers()
        reportCleanup(await deleteSettingWithTarget({ ...input, clientsFor }))
      },
    }
  }, [config, jobworkerp, conductor, queryClient, notify, t])
}

/**
 * The save of a setting edit page: stores the target, reports failures (a
 * jobworkerp refusal of the definition's worker also under the definition),
 * and resolves to whether it succeeded.
 */
export function useSaveSettingWithTarget(kind: TargetSettingKind) {
  const notify = useNotify()
  const target = useTargetActions()
  const [definitionServerError, setDefinitionServerError] = useState<string>()
  const save = async (input: {
    form: ExecutionTargetForm
    settingName: string
    previous: ManagedWorkerRef | undefined
    keepObsolete: boolean
    persist: () => Promise<unknown>
  }): Promise<boolean> => {
    setDefinitionServerError(undefined)
    try {
      await target.save({
        form: input.form,
        kind: TARGET_KIND[kind],
        settingName: input.settingName,
        previous: input.previous,
        keepObsolete: input.keepObsolete,
        save: input.persist,
      })
      return true
    } catch (err) {
      if (isWorkerSaveError(err)) setDefinitionServerError(classifyError(err).serverMessage)
      notify.error(err)
      return false
    }
  }
  return { save, definitionServerError }
}

/** The managed worker a save would leave unused, for the "delete it too" choice. */
export function useObsoleteManagedWorker(
  previous: ManagedWorkerRef | undefined,
  form: ExecutionTargetForm,
) {
  const { link } = useTargetServer(form.serverId)
  return obsoleteManagedWorker(previous, managedWorkerOf(form, link))
}
