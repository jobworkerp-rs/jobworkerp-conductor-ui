import { useCallback, useReducer } from "react"
import { useTranslation } from "react-i18next"
import { languageChoiceOf, resolveInitialLanguage } from "@/lib/i18n"
import { FALLBACK_LANGUAGE, isLanguage, type Language, type LanguageChoice } from "@/lib/languages"
import { PREFERENCE_KEYS, readPreference, writePreference } from "@/lib/preferences"
import { useRuntime } from "./use-runtime"

export function useLanguage() {
  const { i18n } = useTranslation()
  const language: Language = isLanguage(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : FALLBACK_LANGUAGE
  const setLanguage = useCallback(
    async (next: Language) => {
      await i18n.changeLanguage(next)
      writePreference(PREFERENCE_KEYS.language, next)
    },
    [i18n],
  )
  return { language, setLanguage }
}

/** The stored language choice, which can also be to follow the browser (spec §6.7). */
export function useLanguageChoice() {
  const { i18n } = useTranslation()
  const { config } = useRuntime()
  // The choice lives in storage; following the browser may not change the
  // language, so nothing else would re-render this.
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const choice = languageChoiceOf(readPreference(PREFERENCE_KEYS.language), config.defaultLanguage)
  const setChoice = useCallback(
    async (next: LanguageChoice) => {
      writePreference(PREFERENCE_KEYS.language, next)
      await i18n.changeLanguage(
        resolveInitialLanguage({
          stored: next,
          runtimeDefault: config.defaultLanguage,
          browserLanguages: navigator.languages,
        }),
      )
      rerender()
    },
    [i18n, config.defaultLanguage],
  )
  return { choice, setChoice }
}
