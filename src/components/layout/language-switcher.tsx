import { Check, Languages } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/hooks/use-language"
import { SUPPORTED_LANGUAGES } from "@/lib/languages"

export function LanguageSwitcher() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The accessible name must contain the visible text (WCAG 2.5.3), so the
            purpose is prefixed for screen readers instead of replacing it. */}
        <Button variant="ghost" size="sm">
          <Languages className="h-4 w-4" />
          <span className="sr-only">{t("header.languagePrefix")}</span>
          {t(`languages.${language}`)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((option) => (
          <DropdownMenuItem key={option} onSelect={() => void setLanguage(option)}>
            {t(`languages.${option}`)}
            {option === language && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
