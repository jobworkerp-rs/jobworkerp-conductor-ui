import { X } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import { NativeSelect } from "@/components/common/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useServers } from "@/hooks/use-config"
import { PERIODS, singleSource, type ExecutionFilter } from "@/lib/executions/filter"
import { SOURCE_KINDS } from "@/lib/executions/source"
import { STATUS_NAMES, statusNameKey } from "@/lib/executions/status"

/**
 * The execution list's filters (spec §6.6). With one source chosen, conductor
 * cannot also filter by period or server, so those are disabled.
 */
export function ExecutionFilters({
  filter,
  sourceName,
  onChange,
}: {
  filter: ExecutionFilter
  sourceName: string | undefined
  onChange: (patch: Partial<Record<keyof ExecutionFilter, string>>) => void
}) {
  const { t } = useTranslation()
  const ids = useId()
  const servers = useServers({ poll: false })
  const bySource = singleSource(filter) !== undefined

  return (
    <div className="space-y-2">
      {bySource && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="bg-muted rounded-md px-2 py-1">
            {t("executions.filters.source", {
              name: sourceName ?? filter.sourceId,
              kind: t(`executions.sourceKinds.${filter.sourceType}`),
            })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ sourceType: "", sourceId: "" })}
          >
            <X className="h-4 w-4" />
            {t("executions.filters.clearSource")}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        {!bySource && (
          <NativeSelect
            className="w-48"
            aria-label={t("executions.filters.sourceType")}
            value={filter.sourceType ?? ""}
            onChange={(e) => onChange({ sourceType: e.target.value })}
          >
            <option value="">{t("executions.filters.allSourceTypes")}</option>
            {SOURCE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`executions.sourceKinds.${kind}`)}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          className="w-44"
          aria-label={t("executions.filters.server")}
          disabled={bySource}
          value={filter.server ?? ""}
          onChange={(e) => onChange({ server: e.target.value })}
        >
          <option value="">{t("executions.filters.allServers")}</option>
          {(servers.data ?? []).map((server) => (
            <option key={server.id} value={server.id}>
              {server.data.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="w-44"
          aria-label={t("executions.filters.period")}
          disabled={bySource}
          value={filter.period}
          onChange={(e) => onChange({ period: e.target.value })}
        >
          {PERIODS.map((period) => (
            <option key={period} value={period}>
              {t(`executions.filters.periods.${period}`)}
            </option>
          ))}
        </NativeSelect>
        {filter.period === "custom" && !bySource && (
          <>
            <div className="grid gap-1">
              <Label htmlFor={`${ids}-from`} className="text-xs">
                {t("executions.filters.from")}
              </Label>
              <Input
                id={`${ids}-from`}
                type="datetime-local"
                className="w-52"
                value={filter.from ?? ""}
                onChange={(e) => onChange({ from: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`${ids}-to`} className="text-xs">
                {t("executions.filters.to")}
              </Label>
              <Input
                id={`${ids}-to`}
                type="datetime-local"
                className="w-52"
                value={filter.to ?? ""}
                onChange={(e) => onChange({ to: e.target.value })}
              />
            </div>
          </>
        )}
        <NativeSelect
          className="w-44"
          aria-label={t("executions.filters.status")}
          aria-describedby={`${ids}-status-note`}
          value={filter.status ?? ""}
          onChange={(e) => onChange({ status: e.target.value })}
        >
          <option value="">{t("executions.filters.allStatuses")}</option>
          {STATUS_NAMES.filter((name) => name !== "unspecified").map((name) => (
            <option key={name} value={name}>
              {t(statusNameKey(name))}
            </option>
          ))}
        </NativeSelect>
      </div>
      <p id={`${ids}-status-note`} className="text-muted-foreground text-xs">
        {t("executions.filters.statusPageOnly")}
        {bySource && ` ${t("executions.filters.sourceLimits")}`}
      </p>
    </div>
  )
}
