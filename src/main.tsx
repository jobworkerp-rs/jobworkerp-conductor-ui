import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { I18nextProvider } from "react-i18next"
import App from "./App"
import { ConfigErrorScreen } from "./components/config-error-screen"
import { createI18n, resolveInitialLanguage } from "./lib/i18n"
import { loadRuntimeConfig } from "./lib/runtime-config"
import { PREFERENCE_KEYS, readPreference } from "./lib/preferences"
import "./index.css"

async function bootstrap() {
  const result = loadRuntimeConfig()
  const language = resolveInitialLanguage({
    stored: readPreference(PREFERENCE_KEYS.language),
    runtimeDefault: result.ok ? result.config.defaultLanguage : undefined,
    browserLanguages: navigator.languages,
  })
  const i18n = await createI18n(language)
  document.documentElement.lang = language
  i18n.on("languageChanged", (next) => {
    document.documentElement.lang = next
  })

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        {result.ok ? <App config={result.config} /> : <ConfigErrorScreen errors={result.errors} />}
      </I18nextProvider>
    </StrictMode>,
  )
}

void bootstrap()
