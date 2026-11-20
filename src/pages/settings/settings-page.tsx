import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/layout/page-header"
import { useConfigSnapshot } from "@/hooks/use-config"
import { useManagedWorkers } from "@/hooks/use-settings-io"
import { ConnectionSection } from "./connection-section"
import { DangerSection } from "./danger-section"
import { DisplaySection } from "./display-section"
import { ExportSection } from "./export-section"
import { ImportSection } from "./import-section"

/** `/settings` (spec §6.7); the danger zone stays at the bottom. */
export function SettingsPage() {
  const { t } = useTranslation()
  const snapshot = useConfigSnapshot()
  const inUse = useManagedWorkers(snapshot.data)
  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.settings.title")} description={t("pages.settings.description")} />
      <ConnectionSection />
      <DisplaySection />
      <ExportSection inUse={inUse} />
      <ImportSection />
      <DangerSection inUse={inUse} />
    </div>
  )
}
