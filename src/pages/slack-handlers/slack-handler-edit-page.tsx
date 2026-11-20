import { SettingEditPage } from "@/components/settings/setting-edit-page"
import { useRustRegex } from "@/hooks/use-rust-regex"
import {
  SLACK_HANDLER_FORM_DEFAULTS,
  toSlackHandlerData,
  toSlackHandlerForm,
} from "@/lib/slack/form"
import { SlackHandlerForm } from "./slack-handler-form"

/** `/slack-handlers/new` and `/slack-handlers/:id/edit`. */
export function SlackHandlerEditPage() {
  // Start loading the regex module now, alongside the handler, not after it.
  useRustRegex()
  return (
    <SettingEditPage
      kind="slackHandlers"
      defaults={SLACK_HANDLER_FORM_DEFAULTS}
      toForm={toSlackHandlerForm}
      toData={toSlackHandlerData}
      Form={SlackHandlerForm}
    />
  )
}
