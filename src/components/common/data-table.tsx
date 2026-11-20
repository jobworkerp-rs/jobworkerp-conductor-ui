import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DEFAULT_PAGE_SIZE,
  PAGE_PARAM,
  paginate,
  parsePageParam,
  type Page,
} from "@/lib/pagination"

export interface Column<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
}

/** A page the server already cut: its number, and what is known of the rest. */
export interface ServerPage {
  page: number
  hasNext: boolean
  /** Unknown where the API has no count; the pager then only steps. */
  total?: number
  /** Rows the server returned, which `rows` may show only some of. */
  size: number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  /** The full list, paged here (spec §4.3); or the page itself with `serverPage`. */
  rows: readonly T[]
  getRowId: (row: T) => string
  pageSize?: number
  /** URL query parameter holding the page, so the view survives reloads (spec §4.5). */
  pageParam?: string
  isLoading?: boolean
  serverPage?: ServerPage
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  pageSize = DEFAULT_PAGE_SIZE,
  pageParam = PAGE_PARAM,
  isLoading = false,
  serverPage,
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const page: ShownPage<T> = serverPage
    ? fromServer(rows, serverPage, pageSize)
    : paginate(rows, parsePageParam(params.get(pageParam)), pageSize)

  const goTo = (target: number) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set(pageParam, String(target))
      return next
    })

  const placeholder = isLoading
    ? t("common.loading")
    : page.items.length === 0
      ? t("common.empty")
      : null

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {placeholder !== null ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  {placeholder}
                </TableCell>
              </TableRow>
            ) : (
              page.items.map((row) => (
                <TableRow key={getRowId(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-muted-foreground flex items-center justify-between text-sm">
        <span>
          {page.to > 0 &&
            (page.total === undefined
              ? t("common.pageRangeOpen", { from: page.from, to: page.to })
              : t("common.pageRange", { from: page.from, to: page.to, total: page.total }))}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page.page <= 1}
            onClick={() => goTo(page.page - 1)}
          >
            {t("common.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!page.hasNext}
            onClick={() => goTo(page.page + 1)}
          >
            {t("common.next")}
          </Button>
        </div>
      </div>
    </div>
  )
}

type ShownPage<T> = Omit<Page<T>, "items" | "total" | "totalPages"> & {
  items: readonly T[]
  total?: number
}

function fromServer<T>(rows: readonly T[], server: ServerPage, pageSize: number): ShownPage<T> {
  const start = (server.page - 1) * pageSize
  return { ...server, items: rows, from: start + 1, to: start + server.size }
}
