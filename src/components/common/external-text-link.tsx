import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

/** An inline link opening `href` in a new tab, announced as such. */
export function ExternalTextLink({
  href,
  label,
  className,
}: {
  href: string
  label: string
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("nav.opensInNewTab", { name: label })}
      className={cn(
        "inline-flex w-fit items-center gap-1 underline-offset-4 hover:underline",
        className,
      )}
    >
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  )
}
