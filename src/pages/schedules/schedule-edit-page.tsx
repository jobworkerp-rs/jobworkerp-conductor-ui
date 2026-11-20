import { SettingEditPage } from "@/components/settings/setting-edit-page"
import { useRustCron } from "@/hooks/use-rust-cron"
import { SCHEDULE_FORM_DEFAULTS, toScheduleData, toScheduleForm } from "@/lib/schedules/form"
import { ScheduleForm } from "./schedule-form"

/** `/schedules/new` and `/schedules/:id/edit`. */
export function ScheduleEditPage() {
  // Start loading the cron module now, alongside the schedule, not after it.
  useRustCron()
  return (
    <SettingEditPage
      kind="schedules"
      defaults={SCHEDULE_FORM_DEFAULTS}
      toForm={toScheduleForm}
      toData={toScheduleData}
      Form={ScheduleForm}
    />
  )
}
