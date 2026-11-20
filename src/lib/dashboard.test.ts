import { describe, expect, it } from "vitest"
import { ResolvedExecutionStatus as S } from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { NEXT_RUNS_SHOWN, nextRunsView, pickRecentExecutions, RECENT_SHOWN } from "./dashboard"

describe("pickRecentExecutions", () => {
  const rows = (statuses: (S | undefined)[]) =>
    statuses.map((status, i) => ({ id: String(i), status }))
  const statusOf = (row: { status?: S }) => row.status

  it("keeps the running and the failed, newest first as given", () => {
    const picked = pickRecentExecutions(
      rows([
        S.RESOLVED_EXECUTION_STATUS_SUCCEEDED,
        S.RESOLVED_EXECUTION_STATUS_RUNNING,
        S.RESOLVED_EXECUTION_STATUS_FAILED,
        S.RESOLVED_EXECUTION_STATUS_ENQUEUE_FAILED,
        S.RESOLVED_EXECUTION_STATUS_PENDING,
        S.RESOLVED_EXECUTION_STATUS_CANCELLED,
        undefined,
        S.RESOLVED_EXECUTION_STATUS_UNAVAILABLE,
      ]),
      statusOf,
    )
    expect(picked.rows.map((r) => r.id)).toEqual(["1", "2", "3", "4"])
  })

  it("shows at most ten", () => {
    const many = rows(Array.from({ length: 15 }, () => S.RESOLVED_EXECUTION_STATUS_FAILED))
    expect(pickRecentExecutions(many, statusOf).rows).toHaveLength(RECENT_SHOWN)
    expect(RECENT_SHOWN).toBe(10)
  })
})

describe("pickRecentExecutions while statuses load", () => {
  type Row = { id: string; status: S | null | undefined }
  const statusOf = (row: Row) => row.status

  it("is still pending while a status it may need has not loaded", () => {
    const rows: Row[] = [
      { id: "1", status: S.RESOLVED_EXECUTION_STATUS_SUCCEEDED },
      { id: "2", status: undefined },
    ]
    expect(pickRecentExecutions(rows, statusOf)).toEqual({ rows: [], pending: true })
  })

  it("is settled once every status has loaded or the execution is gone", () => {
    const rows: Row[] = [
      { id: "1", status: S.RESOLVED_EXECUTION_STATUS_SUCCEEDED },
      { id: "2", status: null },
    ]
    expect(pickRecentExecutions(rows, statusOf)).toEqual({ rows: [], pending: false })
  })

  it("is settled once enough have been found, whatever is still loading", () => {
    const rows: Row[] = [
      ...Array.from({ length: RECENT_SHOWN }, (_, i) => ({
        id: String(i),
        status: S.RESOLVED_EXECUTION_STATUS_FAILED,
      })),
      { id: "x", status: undefined },
    ]
    expect(pickRecentExecutions(rows, statusOf).pending).toBe(false)
  })
})

describe("nextRunsView", () => {
  const schedules = [
    { id: "1", data: { name: "a" } },
    { id: "2", data: { name: "b" } },
  ]
  const nextRuns = new Map([
    ["1", 200],
    ["2", 100],
  ])

  it("says the rules failed whatever else is known", () => {
    expect(nextRunsView("failed", schedules, nextRuns)).toBe("failed")
    expect(nextRunsView("failed", undefined, nextRuns)).toBe("failed")
  })

  it("is loading until both the rules and the schedules are in", () => {
    expect(nextRunsView("loading", schedules, nextRuns)).toBe("loading")
    expect(nextRunsView("ready", undefined, nextRuns)).toBe("loading")
  })

  it("lists the soonest runs once both are in", () => {
    expect(nextRunsView("ready", schedules, nextRuns)).toEqual([
      { id: "2", name: "b", at: 100 },
      { id: "1", name: "a", at: 200 },
    ])
    expect(nextRunsView("ready", [], new Map())).toEqual([])
    expect(NEXT_RUNS_SHOWN).toBe(5)
  })
})
