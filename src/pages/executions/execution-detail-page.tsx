import { Copy } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router"
import { DateTime } from "@/components/common/date-time"
import { DetailField } from "@/components/common/detail-field"
import { ExternalLinkButton } from "@/components/common/external-link-button"
import { QueryGate } from "@/components/common/query-gate"
import { ExecutionActionsMenu } from "@/components/executions/execution-actions-menu"
import { SourceCell, StatusCell } from "@/components/executions/execution-cells"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useServerName } from "@/hooks/use-config"
import { useExecutionJobResult, useRuntimeStatus } from "@/hooks/use-executions"
import { useLanguage } from "@/hooks/use-language"
import { useNotify } from "@/hooks/use-notify"
import { adminUiUrl } from "@/lib/admin-ui"
import {
  OUTPUT_PREVIEW_BYTES,
  summarizeJobResult,
  type JobResultSummary,
} from "@/lib/executions/job-result"
import { statusSourceKey } from "@/lib/executions/status"
import { formatDuration } from "@/lib/format"
import { ResultStatus } from "@/lib/grpc/jobworkerp/data/common"
import type {
  ExecutionRef,
  ExecutionRuntimeStatus,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { prettyJson } from "@/lib/json"
import type { Language } from "@/lib/languages"
import { navPath } from "@/lib/navigation"

/** `/executions/:refId` (spec §6.6). */
export function ExecutionDetailPage() {
  const { t } = useTranslation()
  const { refId } = useParams()
  const navigate = useNavigate()
  // The status comes with the execution, so one request reads both.
  const query = useRuntimeStatus(refId)
  const status = query.data ?? undefined
  const ref = status?.executionRef

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.executionDetail.title")}
        description={t("pages.executionDetail.description", { id: refId })}
        actions={
          ref && (
            <ExecutionActionsMenu
              execution={ref}
              status={status?.resolvedStatus}
              showDetails={false}
              onDeleted={() => navigate(navPath("executions"))}
            />
          )
        }
      />
      <QueryGate
        query={query}
        notFoundMessage={!ref && t("executions.detail.notFound", { id: refId })}
      >
        {() => (
          <div className="grid gap-6">
            <ExecutionCard execution={ref!} status={status} />
            <JobResultCard execution={ref!} status={status} />
          </div>
        )}
      </QueryGate>
    </div>
  )
}

function ExecutionCard({
  execution,
  status,
}: {
  execution: ExecutionRef
  status: ExecutionRuntimeStatus | undefined
}) {
  const { t } = useTranslation()
  const serverName = useServerName()
  return (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <DetailField label={t("executions.detail.status")}>
            <StatusCell status={status} />
          </DetailField>
          {status && (
            <>
              <DetailField label={t("executions.detail.statusSource")}>
                {t(statusSourceKey(status.statusSource))}
              </DetailField>
              <DetailField label={t("executions.detail.observedAt")}>
                <DateTime seconds={status.observedAt} />
              </DetailField>
              {status.detail && (
                <DetailField label={t("executions.detail.statusDetail")}>
                  {status.detail}
                </DetailField>
              )}
            </>
          )}
          <DetailField label={t("executions.detail.source")}>
            <SourceCell execution={execution} />
          </DetailField>
          <DetailField label={t("executions.detail.server")}>
            {serverName(execution.jobworkerpServerId?.value)}
          </DetailField>
          <DetailField label={t("executions.detail.jobId")}>
            <code>{execution.jobId ?? "—"}</code>
          </DetailField>
          <DetailField label={t("executions.detail.triggeredAt")}>
            <DateTime seconds={execution.triggeredAt} />
          </DetailField>
          <DetailField label={t("executions.detail.createdAt")}>
            <DateTime seconds={execution.createdAt} />
          </DetailField>
          {execution.resultStatus !== undefined && (
            <DetailField label={t("executions.detail.resultStatus")}>
              <code>{ResultStatus[execution.resultStatus] ?? execution.resultStatus}</code>
            </DetailField>
          )}
        </dl>
        {execution.enqueueError && (
          <div
            role="alert"
            className="border-destructive text-destructive rounded-md border p-3 text-sm"
          >
            <p className="font-medium">{t("executions.detail.enqueueError")}</p>
            <p className="break-all whitespace-pre-wrap">{execution.enqueueError}</p>
          </div>
        )}
        {execution.triggerContextJson && <TriggerContext json={execution.triggerContextJson} />}
      </CardContent>
    </Card>
  )
}

function TriggerContext({ json }: { json: string }) {
  const { t } = useTranslation()
  const notify = useNotify()
  const pretty = prettyJson(json)
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">{t("executions.detail.context")}</summary>
      <div className="mt-2 grid gap-2">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(pretty)
              notify.success(t("executions.detail.copied"))
            }}
          >
            <Copy className="h-4 w-4" />
            {t("executions.detail.copy")}
          </Button>
        </div>
        <pre className="bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs">{pretty}</pre>
      </div>
    </details>
  )
}

/** jobworkerp's stored result of the job, where the browser can reach jobworkerp. */
function JobResultCard({
  execution,
  status,
}: {
  execution: ExecutionRef
  status: ExecutionRuntimeStatus | undefined
}) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { link, linked, query, finished } = useExecutionJobResult(execution, status)
  if (!execution.jobId) return null
  const summary = query.data ? summarizeJobResult(query.data) : undefined
  // Why there is no result to show, if there is none.
  const absent = !linked
    ? "executions.detail.notLinked"
    : !finished
      ? "executions.detail.notFinished"
      : query.isPending
        ? "common.loading"
        : !summary
          ? "executions.detail.noResult"
          : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t("executions.detail.jobResult")}</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {absent || !summary ? (
          <p className="text-muted-foreground">{t(absent ?? "executions.detail.noResult")}</p>
        ) : (
          <JobResultSummaryView summary={summary} language={language} />
        )}
        {link?.adminUiUrl && (
          <div className="flex flex-wrap gap-2">
            <ExternalLinkButton
              href={adminUiUrl(link.adminUiUrl, { page: "job", id: execution.jobId })}
              label={t("executions.detail.openJob")}
            />
            {summary?.resultId && (
              <ExternalLinkButton
                href={adminUiUrl(link.adminUiUrl, { page: "result", id: summary.resultId })}
                label={t("executions.detail.openResult")}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function JobResultSummaryView({
  summary,
  language,
}: {
  summary: JobResultSummary
  language: Language
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <DetailField label={t("executions.detail.jobStatus")}>
          <code>{summary.status}</code>
        </DetailField>
        {summary.startedAt !== undefined && (
          <DetailField label={t("executions.detail.startedAt")}>
            <DateTime seconds={summary.startedAt} />
          </DetailField>
        )}
        {summary.endedAt !== undefined && (
          <DetailField label={t("executions.detail.endedAt")}>
            <DateTime seconds={summary.endedAt} />
          </DetailField>
        )}
        {summary.durationMs !== undefined && (
          <DetailField label={t("executions.detail.duration")}>
            {formatDuration(summary.durationMs, language)}
          </DetailField>
        )}
      </dl>
      {summary.output && (
        <div className="grid gap-1">
          <p className="font-medium">{t("executions.detail.output")}</p>
          <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
            {summary.output.text}
          </pre>
          {summary.output.truncated && (
            <p className="text-muted-foreground text-xs">
              {t("executions.detail.outputTruncated", { bytes: OUTPUT_PREVIEW_BYTES })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
