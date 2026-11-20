import { ResultStatus } from "@/lib/grpc/jobworkerp/data/common"
import type { JobResult } from "@/lib/grpc/jobworkerp/data/job_result"

/** How much of a job's output the detail shows (spec §6.6: its head only). */
export const OUTPUT_PREVIEW_BYTES = 2048

export interface JobResultSummary {
  resultId?: string
  /** jobworkerp's own status name, shown as is. */
  status: string
  /** UNIX seconds. */
  startedAt?: number
  endedAt?: number
  durationMs?: number
  output?: { text: string; truncated: boolean }
}

// jobworkerp stores times as UNIX milliseconds, 0 when unset.
const millis = (value: string | undefined) => {
  const ms = Number(value)
  return Number.isFinite(ms) && ms > 0 ? ms : undefined
}

const decoder = new TextDecoder()

export function summarizeJobResult(result: JobResult): JobResultSummary {
  const data = result.data
  const summary: JobResultSummary = {
    resultId: result.id?.value,
    status: ResultStatus[data?.status ?? ResultStatus.UNRECOGNIZED] ?? "UNRECOGNIZED",
  }
  const start = millis(data?.startTime)
  const end = millis(data?.endTime)
  if (start !== undefined) summary.startedAt = start / 1000
  if (end !== undefined) summary.endedAt = end / 1000
  // Equal times measure nothing: jobworkerp has been seen storing them for jobs that ran.
  if (start !== undefined && end !== undefined && end > start) summary.durationMs = end - start
  const bytes = data?.output?.items
  if (bytes && bytes.length > 0) {
    summary.output = {
      // A cut through a multi-byte character decodes as a replacement character.
      text: decoder.decode(bytes.subarray(0, OUTPUT_PREVIEW_BYTES)),
      truncated: bytes.length > OUTPUT_PREVIEW_BYTES,
    }
  }
  return summary
}
