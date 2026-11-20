import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckboxField } from "@/components/common/checkbox-field"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DetailField } from "@/components/common/detail-field"
import { FormField } from "@/components/common/form-field"
import { WarningText } from "@/components/common/warning-text"
import { TargetSummary } from "@/components/execution-target/target-summary"
import { useTriggerNotice } from "@/hooks/use-trigger-notice"
import { Textarea } from "@/components/ui/textarea"
import { useServer, useServerName } from "@/hooks/use-config"
import { useExecutionOperations } from "@/hooks/use-executions"
import { ARGS_MAX_KB, argsError } from "@/lib/execution-target/args"
import { fieldErrorText } from "@/lib/field-error"
import type { ConfigEntity } from "@/lib/services/config"
import { requiredFieldError } from "@/lib/validation"

/**
 * Runs a schedule once (spec §6.3). conductor runs disabled schedules and
 * schedules on disabled servers too, so those are noted, not refused.
 */
export function RunScheduleDialog({
  schedule,
  onClose,
}: {
  schedule: ConfigEntity<"schedules">
  onClose: () => void
}) {
  const { t } = useTranslation()
  const operations = useExecutionOperations()
  const notice = useTriggerNotice()
  const serverId = schedule.data.jobworkerpServerId?.value
  const serverName = useServerName()
  const { server } = useServer(serverId, { poll: false })
  const [override, setOverride] = useState(false)
  const [args, setArgs] = useState(schedule.data.args ?? "")
  const name = schedule.data.name
  // conductor sends the replacement as is; an empty one is not "no args" but
  // a value it cannot parse, so replacing needs JSON ({} for no args).
  const overrideError = override
    ? (requiredFieldError(args) ?? argsError(args, "schedule"))
    : undefined

  const run = async () => {
    notice(await operations.triggerSchedule(schedule.id, override ? args : undefined), name)
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("schedules.run.title", { name })}
      description={t("schedules.run.description")}
      confirmLabel={t("schedules.run.confirm")}
      confirmDisabled={overrideError !== undefined}
      onConfirm={run}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <DetailField label={t("schedules.run.target")}>
          <TargetSummary stored={schedule.data} />
        </DetailField>
        <DetailField label={t("schedules.run.server")}>{serverName(serverId)}</DetailField>
        {!override && (
          <DetailField label={t("schedules.run.args")}>
            <pre className="max-h-40 overflow-auto font-mono text-xs break-all whitespace-pre-wrap">
              {schedule.data.args || t("schedules.run.noArgs")}
            </pre>
          </DetailField>
        )}
      </dl>
      {!schedule.data.enabled && (
        <WarningText className="text-sm">{t("schedules.run.scheduleDisabled")}</WarningText>
      )}
      {server && !server.data.enabled && (
        <WarningText className="text-sm">
          {t("schedules.run.serverDisabled", { name: server.data.name })}
        </WarningText>
      )}
      <CheckboxField
        label={t("schedules.run.override")}
        checked={override}
        onChange={setOverride}
      />
      {override && (
        <FormField
          label={t("schedules.run.overrideLabel")}
          help={t("schedules.run.overrideHelp", { kb: ARGS_MAX_KB })}
          error={overrideError && fieldErrorText(t, overrideError)}
        >
          {(control) => (
            <Textarea
              {...control}
              className="min-h-32 font-mono"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              spellCheck={false}
            />
          )}
        </FormField>
      )}
    </ConfirmDialog>
  )
}
