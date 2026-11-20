import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

/** A small button opening `href` in a new tab, announced as such. */
export function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  const { t } = useTranslation()
  return (
    <Button asChild variant="outline" size="sm">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("nav.opensInNewTab", { name: label })}
      >
        {label}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </Button>
  )
}
