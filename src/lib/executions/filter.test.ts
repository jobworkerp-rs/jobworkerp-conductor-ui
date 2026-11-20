import { describe, expect, it } from "vitest"
import {
  ExecutionSourceType as T,
  ResolvedExecutionStatus as S,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import {
  filterByStatus,
  parseExecutionFilter,
  periodRange,
  singleSource,
  toListQuery,
} from "./filter"

const NOW = 1_800_000_000
const parse = (query: string) => parseExecutionFilter(new URLSearchParams(query))
const local = (y: number, mo: number, d: number, h: number, mi: number, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s).getTime() / 1000

describe("parseExecutionFilter", () => {
  it("reads the history links of the setting lists", () => {
    expect(parse("sourceType=schedule&sourceId=7")).toEqual({
      sourceType: "schedule",
      sourceId: "7",
      period: "all",
    })
  })

  it("ignores unknown values and a source id without its kind", () => {
    expect(parse("sourceType=cron&sourceId=7&period=1y&status=done")).toEqual({ period: "all" })
    expect(parse("sourceId=7")).toEqual({ period: "all" })
  })

  it("keeps server, period, custom bounds and status", () => {
    expect(
      parse("server=2&period=custom&from=2026-01-01T09:00&to=2026-01-02T18:30&status=failed"),
    ).toEqual({
      server: "2",
      period: "custom",
      from: "2026-01-01T09:00",
      to: "2026-01-02T18:30",
      status: "failed",
    })
  })
})

describe("singleSource", () => {
  it("is the source when both its kind and id are chosen", () => {
    expect(singleSource({ sourceType: "schedule", sourceId: "7", period: "all" })).toEqual({
      kind: "schedule",
      id: "7",
    })
    expect(singleSource({ sourceType: "schedule", period: "all" })).toBeUndefined()
  })
})

describe("periodRange", () => {
  it("counts back from now, both ends included", () => {
    expect(periodRange({ period: "1h" }, NOW)).toEqual({ after: NOW - 3600, before: NOW })
    expect(periodRange({ period: "24h" }, NOW)).toEqual({ after: NOW - 86_400, before: NOW })
    expect(periodRange({ period: "7d" }, NOW)).toEqual({ after: NOW - 604_800, before: NOW })
    expect(periodRange({ period: "all" }, NOW)).toEqual({})
  })

  it("includes the whole last minute of a custom range, in local time", () => {
    expect(
      periodRange({ period: "custom", from: "2026-01-01T09:00", to: "2026-01-02T18:30" }, NOW),
    ).toEqual({ after: local(2026, 1, 1, 9, 0), before: local(2026, 1, 2, 18, 30, 59) })
  })

  it("leaves an open or unreadable end unbounded", () => {
    expect(periodRange({ period: "custom", from: "2026-01-01T09:00" }, NOW)).toEqual({
      after: local(2026, 1, 1, 9, 0),
    })
    expect(periodRange({ period: "custom", to: "garbage" }, NOW)).toEqual({})
  })
})

describe("toListQuery", () => {
  it("filters by kind, server and period on the server, a page at a time", () => {
    expect(
      toListQuery({ sourceType: "slackHandler", server: "2", period: "1h" }, NOW, 3, 20),
    ).toEqual({
      kind: "list",
      request: {
        sourceType: T.EXECUTION_SOURCE_TYPE_SLACK_EVENT_HANDLER,
        jobworkerpServerId: { value: "2" },
        triggeredAfter: String(NOW - 3600),
        triggeredBefore: String(NOW),
        limit: 20,
        offset: "40",
      },
    })
  })

  it("switches to the per-source list, without period or server", () => {
    expect(
      toListQuery({ sourceType: "schedule", sourceId: "7", server: "2", period: "1h" }, NOW, 2, 20),
    ).toEqual({
      kind: "bySource",
      request: {
        sourceType: T.EXECUTION_SOURCE_TYPE_CRON_SCHEDULER,
        sourceId: "7",
        limit: 20,
        offset: "20",
      },
    })
  })
})

describe("filterByStatus", () => {
  const rows = [
    { id: "1", status: S.RESOLVED_EXECUTION_STATUS_FAILED },
    { id: "2", status: S.RESOLVED_EXECUTION_STATUS_SUCCEEDED },
    { id: "3", status: undefined },
  ]
  it("keeps the rows of the status, and all rows without a status filter", () => {
    const statusOf = (row: (typeof rows)[number]) => row.status
    expect(filterByStatus(rows, "failed", statusOf).map((r) => r.id)).toEqual(["1"])
    expect(filterByStatus(rows, undefined, statusOf)).toEqual(rows)
  })
})
