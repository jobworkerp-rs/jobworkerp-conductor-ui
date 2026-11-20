import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter } from "react-router"
import { AutoRefreshProvider } from "@/components/auto-refresh-provider"
import { RuntimeProvider } from "@/components/runtime-provider"
import { createI18n } from "@/lib/i18n"
import type { Language } from "@/lib/languages"
import type { RuntimeConfig } from "@/lib/runtime-config"

/** Renders with the real translation catalogs and an in-memory router. */
export async function renderWithApp(
  ui: ReactElement,
  options: { language?: Language; route?: string } & Omit<RenderOptions, "wrapper"> = {},
) {
  const { language = "en", route = "/", ...rest } = options
  const i18n = await createI18n(language)
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </I18nextProvider>,
    rest,
  )
}

// Nothing listens here, so every call fails fast as a network error. Components
// under test see no data, as when the backend is down; nothing is stubbed.
export const UNREACHABLE = "http://127.0.0.1:9"

/**
 * The runtime, query and auto-refresh providers, as a wrapper for components
 * and hooks that fetch data, with its query client for inspection. Pass
 * `config` to point them at a real backend instead.
 */
export function createRuntimeWrapper(
  config: RuntimeConfig = { conductorUrl: UNREACHABLE, jobworkerpServers: [] },
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RuntimeProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AutoRefreshProvider>{children}</AutoRefreshProvider>
      </QueryClientProvider>
    </RuntimeProvider>
  )
  return { wrapper, queryClient }
}

/** renderWithApp inside createRuntimeWrapper's providers. */
export async function renderWithRuntime(
  ui: ReactElement,
  options: { language?: Language; config?: RuntimeConfig } = {},
) {
  const { wrapper: Wrapper } = createRuntimeWrapper(options.config)
  return renderWithApp(<Wrapper>{ui}</Wrapper>, { language: options.language })
}
