import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { useLatestExecution } from "@/hooks/use-executions"
import { useLanguage } from "@/hooks/use-language"
import { executionPath, type SourceKind } from "@/lib/executions/source"
import { formatRelative } from "@/lib/format"
import { ExecutionStatusBadge } from "./execution-status-badge"

/**
 * A setting's latest execution in its list (spec §6.3–6.5): status and how
 * long ago, linking to the execution. Only rows on screen ask for it.
 */
export function LatestExecutionCell({ kind, sourceId }: { kind: SourceKind; sourceId: string }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const latest = useLatestExecution(kind, sourceId)
  if (latest.isPending) return <span className="text-muted-foreground">{t("common.loading")}</span>
  const ref = latest.data?.executionRef
  if (!latest.data || !ref?.id) return "—"
  return (
    <Link to={executionPath(ref.id.value)} className="inline-flex flex-col gap-0.5 hover:underline">
      <ExecutionStatusBadge status={latest.data.resolvedStatus} detail={latest.data.detail} />
      <span className="text-muted-foreground text-xs">
        {formatRelative(Number(ref.triggeredAt), language)}
      </span>
    </Link>
  )
}

export function LatestExecutionHeader() {
  const { t } = useTranslation()
  return t("executions.columns.latest")
}
