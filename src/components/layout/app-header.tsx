import { ExternalLink, PanelLeft, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { useRuntime } from "@/hooks/use-runtime"
import { adminUiLinks } from "@/lib/runtime-config"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "./language-switcher"
import { ModeToggle } from "./mode-toggle"

function AdminUiLinks() {
  const { t } = useTranslation()
  const { config } = useRuntime()
  const links = adminUiLinks(config)
  if (links.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <ExternalLink className="h-4 w-4" />
          {t("nav.adminUiGroup")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {links.map((link) => (
          <DropdownMenuItem key={link.name} asChild>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("nav.opensInNewTab", { name: link.name })}
            >
              {link.name}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppHeader() {
  const { t } = useTranslation()
  const { toggleSidebar } = useSidebar()
  const { autoRefresh, setAutoRefresh } = useAutoRefresh()
  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label={t("header.toggleSidebar")}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-4" />
      </div>
      <div className="flex items-center gap-2">
        <Label
          htmlFor="auto-refresh"
          className="text-muted-foreground flex items-center gap-1 text-sm whitespace-nowrap"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", autoRefresh && "animate-spin [animation-duration:3s]")}
          />
          {t("header.autoRefresh")}
        </Label>
        <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
        <Separator orientation="vertical" className="h-4" />
        <AdminUiLinks />
        <LanguageSwitcher />
        <ModeToggle />
      </div>
    </header>
  )
}
