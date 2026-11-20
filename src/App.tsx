import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useState, type ReactElement } from "react"
import { BrowserRouter, Route, Routes } from "react-router"
import { AutoRefreshProvider } from "@/components/auto-refresh-provider"
import { AppLayout } from "@/components/layout/app-layout"
import { RuntimeProvider } from "@/components/runtime-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { NAV_ITEMS } from "@/lib/navigation"
import { PREFERENCE_KEYS } from "@/lib/preferences"
import type { RuntimeConfig } from "@/lib/runtime-config"
import { DashboardPage } from "@/pages/dashboard/dashboard-page"
import { ExecutionDetailPage } from "@/pages/executions/execution-detail-page"
import { ExecutionListPage } from "@/pages/executions/execution-list-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { PlaceholderPage } from "@/pages/placeholder-page"
import { ResultHandlerEditPage } from "@/pages/result-handlers/result-handler-edit-page"
import { ResultHandlerListPage } from "@/pages/result-handlers/result-handler-list-page"
import { ScheduleEditPage } from "@/pages/schedules/schedule-edit-page"
import { ScheduleListPage } from "@/pages/schedules/schedule-list-page"
import { ServerDetailPage } from "@/pages/servers/server-detail-page"
import { SlackHandlerEditPage } from "@/pages/slack-handlers/slack-handler-edit-page"
import { SlackHandlerListPage } from "@/pages/slack-handlers/slack-handler-list-page"
import { ServerEditPage } from "@/pages/servers/server-edit-page"
import { ServerListPage } from "@/pages/servers/server-list-page"
import { SettingsPage } from "@/pages/settings/settings-page"

/** Screens built so far; the rest of NAV_ITEMS render a placeholder. */
const SCREENS: Partial<Record<string, ReactElement>> = {
  dashboard: <DashboardPage />,
  servers: <ServerListPage />,
  schedules: <ScheduleListPage />,
  executions: <ExecutionListPage />,
  settings: <SettingsPage />,
  resultHandlers: <ResultHandlerListPage />,
  slackHandlers: <SlackHandlerListPage />,
}

export default function App({ config }: { config: RuntimeConfig }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  )
  return (
    <RuntimeProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme={config.defaultTheme ?? "system"}
          enableSystem
          storageKey={PREFERENCE_KEYS.theme}
        >
          <AutoRefreshProvider>
            <TooltipProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppLayout />}>
                    {NAV_ITEMS.map((item) => (
                      <Route
                        key={item.path}
                        path={item.path}
                        element={SCREENS[item.page] ?? <PlaceholderPage page={item.page} />}
                      />
                    ))}
                    <Route path="servers/new" element={<ServerEditPage />} />
                    <Route path="schedules/new" element={<ScheduleEditPage />} />
                    <Route path="schedules/:id/edit" element={<ScheduleEditPage />} />
                    <Route path="result-handlers/new" element={<ResultHandlerEditPage />} />
                    <Route path="result-handlers/:id/edit" element={<ResultHandlerEditPage />} />
                    <Route path="slack-handlers/new" element={<SlackHandlerEditPage />} />
                    <Route path="slack-handlers/:id/edit" element={<SlackHandlerEditPage />} />
                    <Route path="servers/:id" element={<ServerDetailPage />} />
                    <Route path="servers/:id/edit" element={<ServerEditPage />} />
                    <Route path="executions/:refId" element={<ExecutionDetailPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AutoRefreshProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </RuntimeProvider>
  )
}
