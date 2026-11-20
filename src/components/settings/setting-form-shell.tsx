import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import { ExecutionTargetField } from "@/components/execution-target/execution-target-field"
import { ObsoleteWorkerChoice } from "@/components/execution-target/obsolete-worker-choice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { SettingForm, SettingFormErrors, SettingFormValues } from "@/hooks/use-setting-form"
import { findDuplicateName, type Named } from "@/lib/names"
import { NAME_MAX_LENGTH } from "@/lib/validation"

/**
 * The parts every setting form shares: name and description, then the kind's
 * own fields (children), the execution target, enabled, the choice about an
 * unused managed worker, and the buttons.
 */
export function SettingFormShell<V extends SettingFormValues, E extends SettingFormErrors>({
  form,
  existing,
  selfId,
  managedWorkerMissing,
  definitionServerError,
  enabledNote,
  onCancel,
  children,
}: {
  form: SettingForm<V, E>
  /** All entries of the kind, for the advisory duplicate-name warning. */
  existing: readonly Named[]
  selfId?: string
  managedWorkerMissing?: boolean
  definitionServerError?: string
  /** Shown instead of the enabled switch where it cannot be chosen. */
  enabledNote?: string
  onCancel: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const enabledId = useId()
  const { values, set, errors, message } = form
  const duplicate = findDuplicateName(values.name.trim(), existing, selfId)
  return (
    <Card>
      <CardContent className="pt-6">
        <form className="grid max-w-4xl gap-6" onSubmit={form.handleSubmit} noValidate>
          <FormField
            label={t("settings.form.name")}
            required
            help={t("settings.form.nameHelp", { max: NAME_MAX_LENGTH })}
            error={message(errors.name)}
            warning={duplicate ? t("common.duplicateName") : undefined}
          >
            {(control) => (
              <Input
                {...control}
                className="max-w-xl"
                value={values.name}
                onChange={(e) => set({ name: e.target.value } as Partial<V>)}
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField label={t("settings.form.description")} error={message(errors.description)}>
            {(control) => (
              <Textarea
                {...control}
                className="max-w-xl"
                value={values.description}
                onChange={(e) => set({ description: e.target.value } as Partial<V>)}
              />
            )}
          </FormField>

          {children}

          <ExecutionTargetField
            kind={form.kind}
            settingName={values.name.trim()}
            value={values.target}
            onChange={(target) => set({ target } as Partial<V>)}
            errors={errors.target}
            definitionServerError={definitionServerError}
            managedWorkerMissing={managedWorkerMissing}
          />

          {enabledNote ? (
            <p className="text-muted-foreground text-sm">{enabledNote}</p>
          ) : (
            <div className="flex items-center gap-3">
              <Switch
                id={enabledId}
                checked={values.enabled}
                onCheckedChange={(enabled) => set({ enabled } as Partial<V>)}
              />
              <Label htmlFor={enabledId}>{t("settings.form.enabled")}</Label>
            </div>
          )}

          {form.obsolete && (
            <ObsoleteWorkerChoice
              obsolete={form.obsolete}
              checked={form.deleteObsolete}
              onChange={form.setDeleteObsolete}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={form.pending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
