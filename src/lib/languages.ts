export const SUPPORTED_LANGUAGES = ["ja", "en"] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const FALLBACK_LANGUAGE: Language = "en"

export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.some((language) => language === value)
}

/** A language, or following the browser's whatever the deployment default (spec §6.7). */
export type LanguageChoice = Language | "browser"
