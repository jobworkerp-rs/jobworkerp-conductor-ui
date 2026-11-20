import { useTranslation } from "react-i18next"
import { LIST_SCALE_LIMIT, exceedsListScale } from "@/lib/pagination"

export function ListScaleWarning({ count }: { count: number }) {
  const { t } = useTranslation()
  if (!exceedsListScale(count)) return null
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {t("common.listScaleWarning", { count, limit: LIST_SCALE_LIMIT })}
    </p>
  )
}
