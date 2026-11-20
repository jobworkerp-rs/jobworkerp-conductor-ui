import { useId } from "react"
import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import { Input } from "@/components/ui/input"
import { useWorker, useWorkerSearch } from "@/hooks/use-execution-target"

/**
 * The watched worker, with suggestions from the watched server. conductor
 * only sees results the worker broadcasts, so a worker that does not is
 * flagged (spec §6.4).
 */
export function ListenWorkerField({
  serverId,
  value,
  onChange,
  error,
}: {
  serverId: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const { t } = useTranslation()
  const listId = useId()
  const search = useWorkerSearch(serverId, value)
  const worker = useWorker(serverId, value).data
  const warning = (() => {
    if (value.trim() === "" || worker === undefined) return undefined
    if (worker === null) return t("resultHandlers.form.listenWorkerMissing")
    return worker.data?.broadcastResults ? undefined : t("resultHandlers.form.notBroadcasting")
  })()
  return (
    <FormField
      label={t("resultHandlers.form.listenWorker")}
      required
      help={t("resultHandlers.form.listenWorkerHelp")}
      error={error}
      warning={warning}
    >
      {(control) => (
        <>
          <Input
            {...control}
            className="font-mono"
            list={listId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <datalist id={listId}>
            {(search.data ?? []).map((w) => (
              <option key={w.id?.value} value={w.data?.name} />
            ))}
          </datalist>
        </>
      )}
    </FormField>
  )
}
