import { Info } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { fieldErrorText } from "@/lib/field-error"
import { findDuplicateName, type Named } from "@/lib/names"
import { validateServerForm, type ServerFormValues } from "@/lib/servers/form"
import { NAME_MAX_LENGTH } from "@/lib/validation"

interface ServerFormProps {
  initial: ServerFormValues
  /** All servers, for the advisory duplicate-name warning. */
  existing: readonly Named[]
  /** The server being edited, so its own name is not a duplicate. */
  selfId?: string
  /** Saves the values; reports its own failures, so it settles without throwing. */
  onSubmit: (values: ServerFormValues) => Promise<void>
  onCancel: () => void
}

export function ServerForm({ initial, existing, selfId, onSubmit, onCancel }: ServerFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState(initial)
  const { errors, pending, handleSubmit } = useValidatedForm({
    values,
    validate: validateServerForm,
    onSubmit,
  })
  const sslId = useId()
  const enabledId = useId()

  const errorText = (field: keyof ServerFormValues) => {
    const error = errors[field]
    return error && fieldErrorText(t, error)
  }
  const duplicate = findDuplicateName(values.name.trim(), existing, selfId)
  const set = <K extends keyof ServerFormValues>(field: K, value: ServerFormValues[K]) =>
    setValues((previous) => ({ ...previous, [field]: value }))

  return (
    <Card>
      <CardContent className="pt-6">
        <form className="grid max-w-2xl gap-6" onSubmit={handleSubmit} noValidate>
          <FormField
            label={t("servers.form.name")}
            required
            help={t("servers.form.nameHelp", { max: NAME_MAX_LENGTH })}
            error={errorText("name")}
            warning={duplicate ? t("servers.form.duplicateName") : undefined}
          >
            {(control) => (
              <Input
                {...control}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                autoComplete="off"
              />
            )}
          </FormField>
          <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
            <FormField
              label={t("servers.form.host")}
              required
              help={t("servers.form.hostHelp")}
              error={errorText("host")}
            >
              {(control) => (
                <Input
                  {...control}
                  className="font-mono"
                  value={values.host}
                  onChange={(e) => set("host", e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </FormField>
            <FormField label={t("servers.form.port")} required error={errorText("port")}>
              {(control) => (
                <Input
                  {...control}
                  className="font-mono"
                  inputMode="numeric"
                  value={values.port}
                  onChange={(e) => set("port", e.target.value)}
                  autoComplete="off"
                />
              )}
            </FormField>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id={sslId}
              checked={values.sslEnabled}
              onCheckedChange={(checked) => set("sslEnabled", checked)}
            />
            <Label htmlFor={sslId}>{t("servers.form.ssl")}</Label>
          </div>
          <FormField label={t("servers.form.description")} error={errorText("description")}>
            {(control) => (
              <Textarea
                {...control}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
              />
            )}
          </FormField>
          <div className="flex items-center gap-3">
            <Switch
              id={enabledId}
              checked={values.enabled}
              onCheckedChange={(checked) => set("enabled", checked)}
            />
            <Label htmlFor={enabledId}>{t("servers.form.enabled")}</Label>
          </div>
          <p className="text-muted-foreground flex gap-2 rounded-md border p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {t("servers.form.browserUrlNote")}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
