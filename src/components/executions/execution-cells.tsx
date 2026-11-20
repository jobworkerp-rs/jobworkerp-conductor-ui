import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { useExecutionJobResult } from "@/hooks/use-executions"
import { useLanguage } from "@/hooks/use-language"
import { formatDuration } from "@/lib/format"
import { summarizeJobResult } from "@/lib/executions/job-result"
import { sourceKindOf } from "@/lib/executions/source"
import { settingEditPath } from "@/lib/settings"
import type {
  ExecutionRef,
  ExecutionRuntimeStatus,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { ExecutionStatusBadge } from "./execution-status-badge"

/** An execution's status; undefined while it loads, null once the execution is gone. */
export function StatusCell({ status }: { status: ExecutionRuntimeStatus | null | undefined }) {
  const { t } = useTranslation()
  if (status === null) return "—"
  if (!status) return <span className="text-muted-foreground">{t("common.loading")}</span>
  return <ExecutionStatusBadge status={status.resolvedStatus} detail={status.detail} />
}

/** The setting that started an execution, by the name it had then, linking to it. */
export function SourceCell({ execution }: { execution: ExecutionRef }) {
  const { t } = useTranslation()
  const kind = sourceKindOf(execution.sourceType)
  return (
    <div>
      {kind ? (
        <Link to={settingEditPath(kind, execution.sourceId)} className="hover:underline">
          {execution.sourceName}
        </Link>
      ) : (
        execution.sourceName
      )}
      {kind && (
        <div className="text-muted-foreground text-xs">{t(`executions.sourceKinds.${kind}`)}</div>
      )}
    </div>
  )
}

/**
 * How long the job ran, from jobworkerp's stored result; only for finished
 * jobs on linked servers (spec §6.6: where it can be had).
 */
export function DurationCell({
  execution,
  status,
}: {
  execution: ExecutionRef
  status: ExecutionRuntimeStatus | null | undefined
}) {
  const { language } = useLanguage()
  const { query } = useExecutionJobResult(execution, status)
  const ms = query.data ? summarizeJobResult(query.data).durationMs : undefined
  return ms === undefined ? "—" : formatDuration(ms, language)
}
