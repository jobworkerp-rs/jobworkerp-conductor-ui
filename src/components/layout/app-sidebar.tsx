import { Activity, ExternalLink, Server } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ConnectionIndicator } from "./connection-indicator"
import { useRuntime } from "@/hooks/use-runtime"
import { NAV_ITEMS, isNavItemActive } from "@/lib/navigation"
import { adminUiLinks } from "@/lib/runtime-config"

function ConnectionStatus() {
  const { config } = useRuntime()
  return (
    <div className="text-muted-foreground px-2 text-xs">
      <ConnectionIndicator />
      <div className="truncate font-mono">{config.conductorUrl}</div>
    </div>
  )
}

export function AppSidebar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { config } = useRuntime()
  const links = adminUiLinks(config)

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 font-semibold">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground grid h-7 w-7 place-items-center rounded-md">
            <Activity className="h-4 w-4" />
          </span>
          {t("app.name")}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.group")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={isNavItemActive(item, pathname)}>
                    <Link to={item.path}>
                      <item.icon />
                      <span>{t(`nav.${item.page}`)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {links.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("nav.adminUiGroup")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {links.map((link) => (
                  <SidebarMenuItem key={link.name}>
                    <SidebarMenuButton asChild>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("nav.opensInNewTab", { name: link.name })}
                      >
                        <Server />
                        <span>{link.name}</span>
                        <ExternalLink className="ml-auto opacity-50" />
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <ConnectionStatus />
      </SidebarFooter>
    </Sidebar>
  )
}
