import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { DateTime } from "@/components/common/date-time"
import { FormField } from "@/components/common/form-field"
import { WarningText } from "@/components/common/warning-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useLanguage } from "@/hooks/use-language"
import type { useRustCron } from "@/hooks/use-rust-cron"
import { CRON_PRESETS, normalizeCrontab, restrictsBothDays } from "@/lib/schedules/crontab"
import { describeCrontab } from "@/lib/schedules/describe"
import { hasDaylightSaving, type CronTimeZone } from "@/lib/schedules/time-zone"
import { CronRulesUnavailable } from "@/components/schedules/cron-rules-unavailable"
import { CronTimeZoneWarnings } from "@/components/schedules/cron-time-zone-warnings"

export const NEXT_RUNS_SHOWN = 5
// An expression that never fires makes croner search for a long while;
// compute only once typing pauses.
const PREVIEW_DELAY_MS = 200

export type CronModule = ReturnType<typeof useRustCron>

/**
 * The cron expression input with presets, a description, and the next runs
 * computed by conductor's own rules in its time zone (spec §6.3).
 */
export function CrontabField({
  value,
  onChange,
  cron,
  timeZone,
  now,
  error,
}: {
  value: string
  onChange: (value: string) => void
  cron: CronModule
  timeZone: CronTimeZone
  now: number
  error?: string
}) {
  const { t } = useTranslation()
  const zone = timeZone.timeZone
  const year = new Date(now * 1000).getUTCFullYear()
  const daylightSaving = useMemo(() => hasDaylightSaving(zone, year), [zone, year])

  return (
    <FormField
      label={t("schedules.cron.label")}
      required
      help={t("schedules.cron.help")}
      error={error}
    >
      {(control) => (
        <div className="grid gap-3">
          <Input
            {...control}
            className="max-w-xl font-mono"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("schedules.cron.presets")}</span>
            {CRON_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange(preset.expression)}
              >
                {t(`schedules.cron.preset.${preset.key}`)}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 rounded-md border p-3 text-sm">
            <CronPreview value={value} cron={cron} zone={zone} now={now} />
            <CronTimeZoneWarnings zone={timeZone} />
            {daylightSaving && (
              <WarningText>{t("schedules.cron.daylightSaving", { zone })}</WarningText>
            )}
          </div>
        </div>
      )}
    </FormField>
  )
}

function CronPreview({
  value,
  cron,
  zone,
  now,
}: {
  value: string
  cron: CronModule
  zone: string
  now: number
}) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { expression, secondsAdded } = normalizeCrontab(useDebouncedValue(value, PREVIEW_DELAY_MS))
  const module = cron.module
  const preview = useMemo(() => {
    if (!module || expression === "") return undefined
    const refused = module.check(expression)
    if (refused !== undefined) return { refused }
    return {
      description: describeCrontab(expression, language),
      bothDays: restrictsBothDays(expression),
      next: module.nextRuns(expression, zone, now, NEXT_RUNS_SHOWN),
    }
  }, [module, expression, language, zone, now])

  if (!module) {
    return (
      <div role="status">
        {cron.error === undefined ? (
          <p className="text-muted-foreground">{t("schedules.cron.loading")}</p>
        ) : (
          <CronRulesUnavailable message={t("schedules.cron.unavailable")} onRetry={cron.reload} />
        )}
      </div>
    )
  }
  const runs = preview && !("refused" in preview) && "runs" in preview.next ? preview.next.runs : []
  return (
    <>
      {/* Only what the input changes is announced; the runs are not read out
          on every pause in typing. */}
      <div role="status" className="grid gap-2">
        {!preview ? (
          <p className="text-muted-foreground">{t("schedules.cron.empty")}</p>
        ) : (
          <>
            {secondsAdded && <p>{t("schedules.cron.secondsAdded", { expression })}</p>}
            {"refused" in preview ? (
              <p className="text-destructive">
                {t("schedules.cron.invalid", { detail: preview.refused })}
              </p>
            ) : (
              <>
                {preview.description && <p className="font-medium">{preview.description}</p>}
                {preview.bothDays && <p>{t("schedules.cron.bothDays")}</p>}
                {"error" in preview.next && (
                  <WarningText>
                    {t("schedules.cron.noRun", { detail: preview.next.error })}
                  </WarningText>
                )}
              </>
            )}
          </>
        )}
      </div>
      {runs.length > 0 && (
        <div>
          <p className="text-muted-foreground">{t("schedules.cron.nextRuns", { zone })}</p>
          <ol className="font-mono">
            {runs.map((at) => (
              <li key={at}>
                <DateTime seconds={at} timeZone={zone} withZone />
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}
