import type { ComponentType } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router"
import { QueryGate } from "@/components/common/query-gate"
import { PageHeader } from "@/components/layout/page-header"
import { useConfigActions, useConfigEntity } from "@/hooks/use-config"
import { useSaveSettingWithTarget, useStoredTarget } from "@/hooks/use-execution-target"
import { useNotify } from "@/hooks/use-notify"
import type { SettingFormValues } from "@/hooks/use-setting-form"
import { toNamed } from "@/lib/entities"
import type { ManagedWorkerRef } from "@/lib/execution-target/cleanup"
import { nowSeconds } from "@/lib/format"
import type { Named } from "@/lib/names"
import { navPath } from "@/lib/navigation"
import type { ConfigDataByKind } from "@/lib/services/config"
import { targetServerIdOf, type TargetSettingKind } from "@/lib/settings"

/** What a setting edit page hands its form. */
export interface SettingFormProps<V extends SettingFormValues> {
  initial: V
  creating: boolean
  existing: readonly Named[]
  selfId?: string
  previous?: ManagedWorkerRef
  managedWorkerMissing: boolean
  definitionServerError?: string
  onSubmit: (values: V, keepObsolete: boolean) => Promise<void>
  onCancel: () => void
}

/**
 * `/<kind>/new` and `/<kind>/:id/edit` for the settings with an execution
 * target: loads the entry and its stored target, saves through the managed
 * worker flow, and returns to the list. Texts come from `<kind>.form.*` and
 * `<kind>.notFound`.
 */
export function SettingEditPage<K extends TargetSettingKind, V extends SettingFormValues>({
  kind,
  defaults,
  toForm,
  toData,
  Form,
}: {
  kind: K
  defaults: V
  toForm: (data: ConfigDataByKind[K], managed?: { definition: string; channel: string }) => V
  toData: (values: V, nowSeconds: number, createdAt?: string) => ConfigDataByKind[K]
  Form: ComponentType<SettingFormProps<V>>
}) {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const listPath = navPath(kind)
  const { query, entity: current } = useConfigEntity(kind, id)
  const config = useConfigActions(kind)
  const stored = useStoredTarget(current ? targetServerIdOf(kind, current.data) : "", current?.data)
  const { save, definitionServerError } = useSaveSettingWithTarget(kind)

  const submit = async (values: V, keepObsolete: boolean) => {
    const saved = await save({
      form: values.target,
      settingName: values.name.trim(),
      previous: stored.previous,
      keepObsolete,
      persist: () =>
        current
          ? config.update(current.id, toData(values, nowSeconds(), current.data.createdAt))
          : config.create(toData(values, nowSeconds())),
    })
    if (!saved) return
    notify.success(t(current ? `${kind}.form.saved` : `${kind}.form.created`), values.name.trim())
    navigate(listPath)
  }

  return (
    <QueryGate
      query={query}
      pending={!stored.ready}
      notFoundMessage={id !== undefined && !current && t(`${kind}.notFound`, { id })}
    >
      {() => (
        <div className="space-y-6">
          <PageHeader
            title={t(current ? `${kind}.form.editTitle` : `${kind}.form.createTitle`)}
            description={
              current
                ? t(`${kind}.form.editDescription`, { name: current.data.name })
                : t(`${kind}.form.createDescription`)
            }
          />
          <Form
            // Background refetches must not reset what the user is typing.
            key={id ?? "new"}
            initial={current ? toForm(current.data, stored.managed) : defaults}
            creating={!current}
            existing={toNamed(query.data ?? [])}
            selfId={id}
            previous={stored.previous}
            managedWorkerMissing={stored.managedWorkerMissing}
            definitionServerError={definitionServerError}
            onSubmit={submit}
            onCancel={() => navigate(listPath)}
          />
        </div>
      )}
    </QueryGate>
  )
}
