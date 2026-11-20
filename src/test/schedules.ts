import { EXECUTION_TARGET_DEFAULTS, type ExecutionTargetForm } from "@/lib/execution-target/form"
import { SCHEDULE_FORM_DEFAULTS, type ScheduleFormValues } from "@/lib/schedules/form"

/**
 * A disabled schedule running a worker on the server, with an expression
 * far from any test run, so conductor never fires it on its own.
 */
export function inertScheduleForm(
  name: string,
  serverId: string,
  target: Partial<ExecutionTargetForm> = {},
): ScheduleFormValues {
  return {
    ...SCHEDULE_FORM_DEFAULTS,
    name,
    crontab: "0 0 0 1 1 *",
    enabled: false,
    target: {
      ...EXECUTION_TARGET_DEFAULTS,
      serverId,
      method: "worker",
      workerName: "w",
      ...target,
    },
  }
}
