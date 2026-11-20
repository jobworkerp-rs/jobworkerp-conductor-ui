import i18next, { type i18n as I18n } from "i18next"
import { initReactI18next } from "react-i18next"
import en from "@/locales/en/translation.json"
import ja from "@/locales/ja/translation.json"
import {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isLanguage,
  type Language,
  type LanguageChoice,
} from "./languages"

const resources = {
  en: { translation: en },
  ja: { translation: ja },
}

/**
 * Order: the user's stored choice, the deployment default, then the browser
 * (spec §4.2). A stored "browser" skips the deployment default.
 */
export function resolveInitialLanguage(input: {
  stored?: string | null
  runtimeDefault?: Language
  browserLanguages: readonly string[]
}): Language {
  if (isLanguage(input.stored)) return input.stored
  if (input.runtimeDefault && input.stored !== "browser") return input.runtimeDefault
  for (const tag of input.browserLanguages) {
    const primary = tag.toLowerCase().split("-")[0]
    if (isLanguage(primary)) return primary
  }
  return FALLBACK_LANGUAGE
}

/** The choice in effect, for the settings screen: what resolveInitialLanguage follows. */
export function languageChoiceOf(
  stored: string | null,
  runtimeDefault: Language | undefined,
): LanguageChoice {
  if (isLanguage(stored) || stored === "browser") return stored
  return runtimeDefault ?? "browser"
}

export async function createI18n(language: Language): Promise<I18n> {
  const instance = i18next.createInstance()
  await instance.use(initReactI18next).init({
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    resources,
    // React escapes rendered text already.
    interpolation: { escapeValue: false },
  })
  return instance
}
