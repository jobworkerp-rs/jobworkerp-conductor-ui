import type { Column } from "@/components/common/data-table"
import type { SourceKind } from "@/lib/executions/source"
import { LatestExecutionCell, LatestExecutionHeader } from "./latest-execution-cell"

/** The "latest run" column of a setting list. */
export function latestExecutionColumn<T extends { id: string }>(kind: SourceKind): Column<T> {
  return {
    id: "latest",
    header: <LatestExecutionHeader />,
    className: "whitespace-nowrap",
    cell: (row) => <LatestExecutionCell kind={kind} sourceId={row.id} />,
  }
}
