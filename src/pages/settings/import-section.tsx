import { useMutation } from "@tanstack/react-query"
import { useState, type DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { CheckboxField } from "@/components/common/checkbox-field"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { FormField } from "@/components/common/form-field"
import { MessageList } from "@/components/common/message-list"
import { WarningText } from "@/components/common/warning-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useNotify } from "@/hooks/use-notify"
import { useRuntime } from "@/hooks/use-runtime"
import { useImportSettings } from "@/hooks/use-settings-io"
import {
  validateConfig,
  type ImportCounts,
  type ImportResult,
} from "@/lib/services/config-management"
import { canImport, isCurrent, type Validated } from "@/lib/settings-io"
import { SettingsSection } from "./settings-section"

const COUNT_KINDS: (keyof ImportCounts)[] = [
  "servers",
  "schedules",
  "slackHandlers",
  "resultHandlers",
]

/**
 * Validate, then import a TOML file (spec §6.7). Import stays disabled
 * until exactly the current content and overwrite choice have validated.
 */
export function ImportSection() {
  const { t } = useTranslation()
  const { conductor } = useRuntime()
  const notify = useNotify()
  const importSettings = useImportSettings()
  const [toml, setToml] = useState("")
  const [overwrite, setOverwrite] = useState(false)
  const [validated, setValidated] = useState<Validated>()
  const [confirming, setConfirming] = useState(false)

  const validation = useMutation({
    mutationFn: (input: { toml: string; overwrite: boolean }) =>
      validateConfig(conductor, input.toml, input.overwrite),
    onSuccess: (result, input) => setValidated({ ...input, result }),
    onError: (err) => notify.error(err),
  })
  const runImport = async () => {
    const result = await importSettings(toml, overwrite)
    if (!result.ok) {
      // Something changed since validating; show what now fails.
      setValidated({ toml, overwrite, result })
      return
    }
    setValidated(undefined)
    notify.success(t("settingsPage.import.done", { ...result.counts }))
  }
  // One mutation for both ways in, so either keeps the buttons busy; the
  // confirm dialog reports its own errors.
  const importing = useMutation({ mutationFn: runImport })

  const readFile = async (file: File | undefined) => {
    if (file) setToml(await file.text())
  }
  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    void readFile(event.dataTransfer.files[0])
  }
  const current = isCurrent(validated, toml, overwrite)
  const busy = validation.isPending || importing.isPending

  return (
    <SettingsSection
      title={t("settingsPage.import.title")}
      description={t("settingsPage.import.description")}
    >
      <FormField label={t("settingsPage.import.file")}>
        {(control) => (
          <Input
            {...control}
            type="file"
            accept=".toml,text/plain"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
        )}
      </FormField>
      <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <FormField label={t("settingsPage.import.toml")} help={t("settingsPage.import.tomlHelp")}>
          {(control) => (
            <Textarea
              {...control}
              className="min-h-48 font-mono"
              spellCheck={false}
              value={toml}
              onChange={(e) => setToml(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <CheckboxField
        label={t("settingsPage.import.overwrite")}
        checked={overwrite}
        onChange={setOverwrite}
      />
      {overwrite && <WarningText>{t("settingsPage.import.overwriteHelp")}</WarningText>}
      <ul className="text-muted-foreground list-disc space-y-1 pl-5">
        <li>{t("settingsPage.import.newIds")}</li>
        {!overwrite && <li>{t("settingsPage.import.reuseServers")}</li>}
      </ul>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={busy || toml.trim() === ""}
          onClick={() => validation.mutate({ toml, overwrite })}
        >
          {t("settingsPage.import.validate")}
        </Button>
        <Button
          disabled={busy || !canImport(validated, toml, overwrite)}
          onClick={() =>
            overwrite
              ? setConfirming(true)
              : importing.mutate(undefined, { onError: (err) => notify.error(err) })
          }
        >
          {t("settingsPage.import.import")}
        </Button>
      </div>
      {validated && !current && (
        <p className="text-muted-foreground">{t("settingsPage.import.changed")}</p>
      )}
      {current && <ValidationResult result={validated.result} />}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("settingsPage.import.confirmTitle")}
        description={t("settingsPage.import.overwriteHelp")}
        confirmLabel={t("settingsPage.import.import")}
        destructive
        onConfirm={async () => {
          await importing.mutateAsync()
        }}
      />
    </SettingsSection>
  )
}

export function ValidationResult({ result }: { result: ImportResult }) {
  const { t } = useTranslation()
  const counts = (
    <ul className="flex flex-wrap gap-x-4">
      {COUNT_KINDS.map((kind) => (
        <li key={kind}>
          {t(`settingsPage.import.counts.${kind}`, { count: result.counts[kind] })}
        </li>
      ))}
    </ul>
  )
  if (result.ok) {
    return (
      <div role="status" className="space-y-1">
        <p className="font-medium">{t("settingsPage.import.valid")}</p>
        {counts}
      </div>
    )
  }
  return (
    <div role="alert" className="space-y-1">
      <p className="text-destructive font-medium">
        {t("settingsPage.import.invalid", { count: result.errors.length })}
      </p>
      <MessageList className="text-destructive" messages={result.errors} />
    </div>
  )
}
