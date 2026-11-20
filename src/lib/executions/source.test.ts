import { describe, expect, it } from "vitest"
import { ExecutionSourceType as T } from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { executionHistoryPath, executionPath, sourceKindOf, sourceTypeOf } from "./source"

describe("execution sources", () => {
  it("maps the URL's source kinds to conductor's source types and back", () => {
    expect(sourceTypeOf("schedule")).toBe(T.EXECUTION_SOURCE_TYPE_CRON_SCHEDULER)
    expect(sourceTypeOf("slackHandler")).toBe(T.EXECUTION_SOURCE_TYPE_SLACK_EVENT_HANDLER)
    expect(sourceTypeOf("resultHandler")).toBe(T.EXECUTION_SOURCE_TYPE_WORKER_RESULT_HANDLER)
    for (const kind of ["schedule", "slackHandler", "resultHandler"] as const) {
      expect(sourceKindOf(sourceTypeOf(kind))).toBe(kind)
    }
    expect(sourceKindOf(T.EXECUTION_SOURCE_TYPE_UNSPECIFIED)).toBeUndefined()
  })

  it("links to an execution", () => {
    expect(executionPath("70")).toBe("/executions/70")
  })

  it("links to a setting's execution history", () => {
    expect(executionHistoryPath("slackHandler", "8")).toBe(
      "/executions?sourceType=slackHandler&sourceId=8",
    )
  })
})
