import { Info } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import { NativeSelect } from "@/components/common/native-select"
import type { SettingFormProps } from "@/components/settings/setting-edit-page"
import { SettingFormShell } from "@/components/settings/setting-form-shell"
import { useServers } from "@/hooks/use-config"
import { useSettingForm } from "@/hooks/use-setting-form"
import {
  followListenServer,
  validateResultHandlerForm,
  type ResultHandlerFormValues,
} from "@/lib/result-handlers/form"
import { ListenWorkerField } from "./listen-worker-field"

export function ResultHandlerForm({
  initial,
  existing,
  selfId,
  previous,
  managedWorkerMissing,
  definitionServerError,
  onSubmit,
  onCancel,
}: SettingFormProps<ResultHandlerFormValues>) {
  const { t } = useTranslation()
  const conditionsId = useId()
  const servers = useServers({ poll: false })
  const form = useSettingForm({
    kind: "resultHandler",
    initial,
    previous,
    validate: validateResultHandlerForm,
    onSubmit,
  })
  const { values, set, errors, message } = form

  return (
    <SettingFormShell
      form={form}
      existing={existing}
      selfId={selfId}
      managedWorkerMissing={managedWorkerMissing}
      definitionServerError={definitionServerError}
      onCancel={onCancel}
    >
      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <FormField
          label={t("resultHandlers.form.listenServer")}
          required
          help={t("resultHandlers.form.listenServerHelp")}
          error={message(errors.listenServerId)}
        >
          {(control) => (
            <NativeSelect
              {...control}
              value={values.listenServerId}
              onChange={(e) => form.setValues((v) => followListenServer(v, e.target.value))}
            >
              <option value="">{t("executionTarget.serverPlaceholder")}</option>
              {(servers.data ?? []).map((server) => (
                <option key={server.id} value={server.id}>
                  {server.data.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <ListenWorkerField
          serverId={values.listenServerId}
          value={values.listenWorkerName}
          onChange={(listenWorkerName) => set({ listenWorkerName })}
          error={message(errors.listenWorkerName)}
        />
      </div>

      <section
        aria-labelledby={conditionsId}
        className="text-muted-foreground flex gap-2 rounded-md border p-3 text-sm"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <h3 id={conditionsId} className="text-foreground font-medium">
            {t("resultHandlers.form.conditionsTitle")}
          </h3>
          <ul className="list-disc pl-5">
            <li>{t("resultHandlers.form.conditionBroadcast")}</li>
            <li>{t("resultHandlers.form.conditionSuccess")}</li>
          </ul>
        </div>
      </section>
    </SettingFormShell>
  )
}
