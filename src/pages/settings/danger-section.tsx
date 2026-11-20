import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useExportDownload, type ManagedWorkers } from "@/hooks/use-settings-io"
import { ClearAllDialog } from "./clear-all-dialog"
import { SettingsSection } from "./settings-section"

/** The bottom of the screen: deleting every setting, with a backup first. */
export function DangerSection({ inUse }: { inUse: ManagedWorkers }) {
  const { t } = useTranslation()
  const download = useExportDownload()
  const [open, setOpen] = useState(false)
  return (
    <SettingsSection
      title={t("settingsPage.clear.title")}
      description={t("settingsPage.clear.description")}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={download.isPending}
          onClick={() => download.mutate(false)}
        >
          {t("settingsPage.clear.exportFirst")}
        </Button>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          {t("settingsPage.clear.button")}
        </Button>
      </div>
      <ClearAllDialog open={open} onOpenChange={setOpen} inUse={inUse} />
    </SettingsSection>
  )
}
