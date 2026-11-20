import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.notFound.title")} description={t("pages.notFound.description")} />
      <Button asChild variant="outline">
        <Link to="/">{t("pages.notFound.backToDashboard")}</Link>
      </Button>
    </div>
  )
}
