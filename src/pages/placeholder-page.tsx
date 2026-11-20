import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/layout/page-header"

/** Stand-in for screens built in later phases; keeps routes and navigation testable now. */
export function PlaceholderPage({
  page,
  values,
}: {
  page: string
  values?: Record<string, string>
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <PageHeader
        title={t(`pages.${page}.title`)}
        description={t(`pages.${page}.description`, values)}
      />
      <p className="text-muted-foreground">{t("pages.comingSoon")}</p>
    </div>
  )
}
