import { Outlet } from "react-router"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"
import { ConnectionBanner } from "./connection-banner"

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="min-w-0 flex-1">
        <AppHeader />
        <div className="flex flex-col gap-6 p-6 md:p-8">
          <ConnectionBanner />
          <Outlet />
        </div>
        <Toaster />
      </main>
    </SidebarProvider>
  )
}
