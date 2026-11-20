import { useTranslation } from "react-i18next"
import type { ClassifiedError } from "@/lib/errors"

/** The raw server message, collapsed and untranslated (spec §4.4). */
export function ErrorDetails({ error }: { error: ClassifiedError }) {
  const { t } = useTranslation()
  if (!error.serverMessage) return null
  return (
    <details className="text-sm">
      <summary className="cursor-pointer">{t("errors.details")}</summary>
      <pre className="bg-muted mt-1 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
        {error.serverMessage}
      </pre>
    </details>
  )
}
