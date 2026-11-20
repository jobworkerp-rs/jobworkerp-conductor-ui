import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import type { SettingFormProps } from "@/components/settings/setting-edit-page"
import { SettingFormShell } from "@/components/settings/setting-form-shell"
import { Input } from "@/components/ui/input"
import { useNow } from "@/hooks/use-now"
import { useCronTimeZone, useRustCron } from "@/hooks/use-rust-cron"
import { useSettingForm } from "@/hooks/use-setting-form"
import {
  JOB_TIMEOUT_DEFAULT_SEC,
  validateScheduleForm,
  type ScheduleFormValues,
} from "@/lib/schedules/form"
import { CrontabField } from "./crontab-field"

const PREVIEW_CLOCK_MS = 60_000

export function ScheduleForm({
  initial,
  existing,
  selfId,
  previous,
  managedWorkerMissing,
  definitionServerError,
  onSubmit,
  onCancel,
}: SettingFormProps<ScheduleFormValues>) {
  const { t } = useTranslation()
  const cron = useRustCron()
  const timeZone = useCronTimeZone(cron)
  const now = useNow(PREVIEW_CLOCK_MS)
  const form = useSettingForm({
    kind: "schedule",
    initial,
    previous,
    validate: (values, targetContext) => validateScheduleForm(values, targetContext, cron.module),
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
      <CrontabField
        value={values.crontab}
        onChange={(crontab) => set({ crontab })}
        cron={cron}
        timeZone={timeZone}
        now={now}
        error={message(errors.crontab)}
      />
      <FormField
        label={t("schedules.form.jobTimeout")}
        help={t("schedules.form.jobTimeoutHelp", { default: JOB_TIMEOUT_DEFAULT_SEC })}
        error={message(errors.jobTimeoutSec)}
      >
        {(control) => (
          <Input
            {...control}
            className="max-w-48"
            inputMode="numeric"
            value={values.jobTimeoutSec}
            onChange={(e) => set({ jobTimeoutSec: e.target.value })}
            autoComplete="off"
          />
        )}
      </FormField>
    </SettingFormShell>
  )
}
