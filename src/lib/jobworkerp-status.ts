import { JobProcessingStatus } from "@/lib/grpc/jobworkerp/data/common"

export interface JobStatusSummary {
  pending: number
  running: number
  waitResult: number
  cancelling: number
  total: number
}

export function summarizeJobStatuses(statuses: Iterable<JobProcessingStatus>): JobStatusSummary {
  const summary: JobStatusSummary = {
    pending: 0,
    running: 0,
    waitResult: 0,
    cancelling: 0,
    total: 0,
  }
  for (const status of statuses) {
    summary.total += 1
    if (status === JobProcessingStatus.PENDING) summary.pending += 1
    else if (status === JobProcessingStatus.RUNNING) summary.running += 1
    else if (status === JobProcessingStatus.WAIT_RESULT) summary.waitResult += 1
    else if (status === JobProcessingStatus.CANCELLING) summary.cancelling += 1
  }
  return summary
}
