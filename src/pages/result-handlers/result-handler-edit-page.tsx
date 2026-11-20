import { SettingEditPage } from "@/components/settings/setting-edit-page"
import {
  RESULT_HANDLER_FORM_DEFAULTS,
  toResultHandlerData,
  toResultHandlerForm,
} from "@/lib/result-handlers/form"
import { ResultHandlerForm } from "./result-handler-form"

/** `/result-handlers/new` and `/result-handlers/:id/edit`. */
export function ResultHandlerEditPage() {
  return (
    <SettingEditPage
      kind="resultHandlers"
      defaults={RESULT_HANDLER_FORM_DEFAULTS}
      toForm={toResultHandlerForm}
      toData={toResultHandlerData}
      Form={ResultHandlerForm}
    />
  )
}
