import { useId } from "react"
import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import { NativeSelect } from "@/components/common/native-select"
import type { SettingFormProps } from "@/components/settings/setting-edit-page"
import { SettingFormShell } from "@/components/settings/setting-form-shell"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useRustRegex } from "@/hooks/use-rust-regex"
import { useSettingForm } from "@/hooks/use-setting-form"
import {
  PATTERN_MAX_BYTES,
  REACTION_OPERATIONS,
  validateSlackHandlerForm,
  type SlackEventKind,
  type SlackHandlerFormValues,
} from "@/lib/slack/form"
import { cn } from "@/lib/utils"
import { PatternField } from "./pattern-field"
import { ReactionNamesInput } from "./reaction-names-input"

const KINDS: SlackEventKind[] = ["message", "reaction"]

export function SlackHandlerForm({
  initial,
  creating,
  existing,
  selfId,
  previous,
  managedWorkerMissing,
  definitionServerError,
  onSubmit,
  onCancel,
}: SettingFormProps<SlackHandlerFormValues>) {
  const { t } = useTranslation()
  const ids = useId()
  const regex = useRustRegex()
  const form = useSettingForm({
    kind: "slackHandler",
    initial,
    previous,
    validate: (values, targetContext) => validateSlackHandlerForm(values, targetContext, regex),
    onSubmit,
  })
  const { values, set, errors, message } = form

  return (
    <SettingFormShell
      form={form}
      existing={existing}
      selfId={selfId}
      managedWorkerMissing={managedWorkerMissing}
      definitionServerError={definitionServerError}
      // conductor creates every handler enabled (conductor #80).
      enabledNote={creating ? t("slackHandlers.form.createdEnabled") : undefined}
      onCancel={onCancel}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("slackHandlers.form.kind")}</legend>
        <div className="flex gap-2">
          {KINDS.map((kind) => (
            <label
              key={kind}
              className={cn(
                "hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm",
                values.kind === kind && "border-primary ring-primary/30 ring-2",
              )}
            >
              <input
                type="radio"
                name={`${ids}-kind`}
                checked={values.kind === kind}
                onChange={() => set({ kind })}
              />
              {t(`slackHandlers.kinds.${kind}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        label={t("slackHandlers.form.channelId")}
        help={t("slackHandlers.form.channelIdHelp")}
        error={message(errors.channelId)}
      >
        {(control) => (
          <Input
            {...control}
            className="max-w-xs font-mono"
            value={values.channelId}
            onChange={(e) => set({ channelId: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>

      {values.kind === "message" ? (
        <div className="grid gap-4 rounded-md border p-4">
          <p className="text-muted-foreground text-sm">
            {t("slackHandlers.form.messageConditionHelp")}
          </p>
          <PatternField
            label={t("slackHandlers.form.messagePattern")}
            help={t("slackHandlers.form.patternHelp", { max: PATTERN_MAX_BYTES })}
            value={values.messagePattern}
            onChange={(messagePattern) => set({ messagePattern })}
            regex={regex}
            error={message(errors.messagePattern)}
          />
          <div className="flex items-center gap-3">
            <Switch
              id={`${ids}-mention`}
              checked={values.mentionRequired}
              onCheckedChange={(mentionRequired) => set({ mentionRequired })}
            />
            <Label htmlFor={`${ids}-mention`}>{t("slackHandlers.form.mentionRequired")}</Label>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 rounded-md border p-4">
          <ReactionNamesInput
            value={values.reactionNames}
            onChange={(reactionNames) => set({ reactionNames })}
            error={message(errors.reactionNames)}
          />
          <FormField label={t("slackHandlers.form.reactionOperation")} required>
            {(control) => (
              <NativeSelect
                {...control}
                className="max-w-xs"
                value={values.reactionOperation}
                onChange={(e) => set({ reactionOperation: Number(e.target.value) })}
              >
                {REACTION_OPERATIONS.map(([operation, key]) => (
                  <option key={operation} value={operation}>
                    {t(`slackHandlers.form.operations.${key}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <PatternField
            label={t("slackHandlers.form.reactionUserFilter")}
            help={t("slackHandlers.form.reactionUserFilterHelp")}
            value={values.reactionUserFilter}
            onChange={(reactionUserFilter) => set({ reactionUserFilter })}
            regex={regex}
            error={message(errors.reactionUserFilter)}
          />
        </div>
      )}
    </SettingFormShell>
  )
}
