import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import { NativeSelect } from "@/components/common/native-select"
import { Button } from "@/components/ui/button"
import { useExportDownload, type ManagedWorkers } from "@/hooks/use-settings-io"
import { ManagedWorkflowNotice } from "./managed-workflow-notice"
import { SettingsSection } from "./settings-section"

/** Every setting as a TOML file (spec §6.7). */
export function ExportSection({ inUse }: { inUse: ManagedWorkers }) {
  const { t } = useTranslation()
  const [enabledOnly, setEnabledOnly] = useState(false)
  const download = useExportDownload()
  return (
    <SettingsSection
      title={t("settingsPage.export.title")}
      description={t("settingsPage.export.description")}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <FormField label={t("settingsPage.export.scope")}>
            {(control) => (
              <NativeSelect
                {...control}
                value={enabledOnly ? "enabled" : "all"}
                onChange={(e) => setEnabledOnly(e.target.value === "enabled")}
              >
                <option value="all">{t("settingsPage.export.scopeAll")}</option>
                <option value="enabled">{t("settingsPage.export.scopeEnabled")}</option>
              </NativeSelect>
            )}
          </FormField>
        </div>
        <Button disabled={download.isPending} onClick={() => download.mutate(enabledOnly)}>
          {t("settingsPage.export.download")}
        </Button>
      </div>
      {enabledOnly && (
        <p className="text-muted-foreground">{t("settingsPage.export.enabledHelp")}</p>
      )}
      <ManagedWorkflowNotice inUse={inUse} />
    </SettingsSection>
  )
}
