import { describe, expect, it } from "vitest"
import { ResultStatus } from "@/lib/grpc/jobworkerp/data/common"
import { JobResultData, type JobResult } from "@/lib/grpc/jobworkerp/data/job_result"
import { OUTPUT_PREVIEW_BYTES, summarizeJobResult } from "./job-result"

const encode = (text: string) => new TextEncoder().encode(text)

function result(data: Partial<JobResultData>): JobResult {
  return {
    id: { value: "9" },
    data: { ...JobResultData.fromPartial({}), ...data },
    metadata: {},
  }
}

describe("summarizeJobResult", () => {
  it("reads status, times and the output of a finished job", () => {
    expect(
      summarizeJobResult(
        result({
          status: ResultStatus.SUCCESS,
          startTime: "1700000000000",
          endTime: "1700000002500",
          output: { items: encode("hello") },
        }),
      ),
    ).toEqual({
      resultId: "9",
      status: "SUCCESS",
      startedAt: 1_700_000_000,
      endedAt: 1_700_000_002.5,
      durationMs: 2500,
      output: { text: "hello", truncated: false },
    })
  })

  it("shows only the head of a long output", () => {
    const summary = summarizeJobResult(
      result({ output: { items: encode("x".repeat(OUTPUT_PREVIEW_BYTES + 10)) } }),
    )
    expect(summary.output).toEqual({ text: "x".repeat(OUTPUT_PREVIEW_BYTES), truncated: true })
  })

  it("has no duration when the stored times do not span one", () => {
    // jobworkerp has been seen storing the same start and end for a job that ran seconds.
    const summary = summarizeJobResult(
      result({ startTime: "1700000000000", endTime: "1700000000000" }),
    )
    expect(summary.durationMs).toBeUndefined()
    expect(summary.startedAt).toBe(1_700_000_000)
  })

  it("leaves out times and output it does not have", () => {
    const summary = summarizeJobResult(result({ status: ResultStatus.CANCELLED }))
    expect(summary).toEqual({ resultId: "9", status: "CANCELLED" })
  })
})
