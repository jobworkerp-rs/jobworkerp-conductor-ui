import { useTranslation } from "react-i18next"
import { useLanguage } from "@/hooks/use-language"
import { formatNumber } from "@/lib/format"
import type { JobworkerpInfo } from "@/lib/services/jobworkerp"

/** A jobworkerp's worker count and running and pending jobs (spec §6.1, §6.2). */
export function JobworkerpStats({ info }: { info: JobworkerpInfo }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const entries = [
    ["workers", info.workerCount],
    ["running", info.jobs.running],
    ["pending", info.jobs.pending],
  ] as const
  return (
    <dl className="grid grid-cols-3 gap-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md border p-3">
          <dt className="text-muted-foreground text-xs">{t(`servers.stats.${key}`)}</dt>
          <dd className="text-2xl font-bold">{formatNumber(value, language)}</dd>
        </div>
      ))}
    </dl>
  )
}
