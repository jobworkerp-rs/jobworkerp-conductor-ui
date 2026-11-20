import { describe, expect, it } from "vitest"
import { JobProcessingStatus } from "@/lib/grpc/jobworkerp/data/common"
import { summarizeJobStatuses } from "./jobworkerp-status"

describe("summarizeJobStatuses", () => {
  it("counts each processing state", () => {
    const S = JobProcessingStatus
    expect(
      summarizeJobStatuses([
        S.PENDING,
        S.RUNNING,
        S.RUNNING,
        S.WAIT_RESULT,
        S.CANCELLING,
        S.UNKNOWN,
      ]),
    ).toEqual({ pending: 1, running: 2, waitResult: 1, cancelling: 1, total: 6 })
  })

  it("is all zero for no jobs", () => {
    expect(summarizeJobStatuses([])).toEqual({
      pending: 0,
      running: 0,
      waitResult: 0,
      cancelling: 0,
      total: 0,
    })
  })
})
