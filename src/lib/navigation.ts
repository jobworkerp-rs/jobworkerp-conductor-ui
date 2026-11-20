import {
  Activity,
  Clock,
  GitMerge,
  LayoutDashboard,
  MessageSquare,
  Server,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  path: string
  /** Screen key: labels live under "nav.<page>", titles under "pages.<page>". */
  page: string
  icon: LucideIcon
}

// The single list of top-level screens (spec §5.1); the router is built from it.
export const NAV_ITEMS: NavItem[] = [
  { path: "/", page: "dashboard", icon: LayoutDashboard },
  { path: "/servers", page: "servers", icon: Server },
  { path: "/schedules", page: "schedules", icon: Clock },
  { path: "/result-handlers", page: "resultHandlers", icon: GitMerge },
  { path: "/slack-handlers", page: "slackHandlers", icon: MessageSquare },
  { path: "/executions", page: "executions", icon: Activity },
  { path: "/settings", page: "settings", icon: SlidersHorizontal },
]

/** "/" matches only itself; other items also match their sub-pages. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.path === "/"
    ? pathname === "/"
    : pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export function navPath(page: string): string {
  const item = NAV_ITEMS.find((candidate) => candidate.page === page)
  if (!item) throw new Error(`unknown screen: ${page}`)
  return item.path
}

export const serverDetailPath = (id: string) => `${navPath("servers")}/${encodeURIComponent(id)}`
