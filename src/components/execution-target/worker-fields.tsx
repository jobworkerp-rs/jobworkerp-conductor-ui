import { useId } from "react"
import { useTranslation } from "react-i18next"
import { ExternalTextLink } from "@/components/common/external-text-link"
import { FormField } from "@/components/common/form-field"
import { Input } from "@/components/ui/input"
import { useWorker, useWorkerDetails, useWorkerSearch } from "@/hooks/use-execution-target"
import { adminUiUrl } from "@/lib/admin-ui"
import type { ExecutionTargetForm } from "@/lib/execution-target/form"

interface SectionProps {
  value: ExecutionTargetForm
  set: (patch: Partial<ExecutionTargetForm>) => void
  error?: string
  adminUi: string | undefined
}

/** Registered worker: name with suggestions from the server, and its method. */
export function WorkerFields({ value, set, error, adminUi }: SectionProps) {
  const { t } = useTranslation()
  const ids = useId()
  const search = useWorkerSearch(value.serverId, value.workerName)
  const { worker, runner } = useWorkerDetails(value.serverId, value.workerName)
  // Sorted: the method map comes back in no particular order.
  const methods = Object.keys(runner?.data?.methodProtoMap?.schemas ?? {}).sort()
  const notFound = value.workerName.trim() !== "" && worker === null
  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <FormField
        label={t("executionTarget.workerName")}
        required
        help={t("executionTarget.workerNameHelp")}
        error={error}
        warning={notFound ? t("executionTarget.workerNotFound") : undefined}
      >
        {(control) => (
          <div className="grid gap-1">
            <Input
              {...control}
              className="font-mono"
              list={`${ids}-workers`}
              value={value.workerName}
              onChange={(e) => set({ workerName: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
            <datalist id={`${ids}-workers`}>
              {(search.data ?? []).map((w) => (
                <option key={w.id?.value} value={w.data?.name} />
              ))}
            </datalist>
            {runner?.data && (
              <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                {t("executionTarget.workerRunner", { runner: runner.data.name })}
                {adminUi && worker?.id && (
                  <ExternalTextLink
                    href={adminUiUrl(adminUi, { page: "worker", id: worker.id.value })}
                    label={t("executionTarget.openWorker")}
                  />
                )}
              </p>
            )}
          </div>
        )}
      </FormField>
      <FormField
        label={t("executionTarget.using")}
        help={
          methods.length > 0
            ? t("executionTarget.usingCandidates", { methods: methods.join(", ") })
            : t("executionTarget.usingHelp")
        }
      >
        {(control) => (
          <>
            <Input
              {...control}
              className="font-mono"
              list={`${ids}-methods`}
              value={value.using}
              onChange={(e) => set({ using: e.target.value })}
              autoComplete="off"
            />
            <datalist id={`${ids}-methods`}>
              {methods.map((method) => (
                <option key={method} value={method} />
              ))}
            </datalist>
          </>
        )}
      </FormField>
    </div>
  )
}

/** Name of the worker storing an inline definition, with a link to it once it exists. */
export function ManagedWorkerNameField({ value, set, error, adminUi }: SectionProps) {
  const { t } = useTranslation()
  const worker = useWorker(value.serverId, value.managedWorkerName).data
  return (
    <FormField
      label={t("executionTarget.managedWorkerName")}
      required
      help={t("executionTarget.managedWorkerNameHelp")}
      error={error}
    >
      {(control) => (
        <div className="grid gap-1">
          <Input
            {...control}
            className="max-w-md font-mono"
            value={value.managedWorkerName}
            onChange={(e) => set({ managedWorkerName: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
          {adminUi && worker?.id && (
            <ExternalTextLink
              href={adminUiUrl(adminUi, { page: "worker", id: worker.id.value })}
              label={t("executionTarget.openWorker")}
              className="text-muted-foreground text-sm"
            />
          )}
        </div>
      )}
    </FormField>
  )
}
