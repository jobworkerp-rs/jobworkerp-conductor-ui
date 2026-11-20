import * as cronstrueModule from "cronstrue"
import "cronstrue/locales/ja"
import type { Language } from "@/lib/languages"

// cronstrue's Japanese phrases follow the English sentence ("次において実施
// 09:00..."); these read its parts as a list of conditions instead.
const JA_PHRASES: Record<string, string> = {
  atSpace: "",
  at: "",
  atX0: "%s",
  spaceAnd: "、",
  commaOnlyOnX0: "、%s",
  commaOnlyInX0: "、%s",
  commaOnThe: "、",
  spaceX0OfTheMonth: "月の%s",
  commaOnTheX0OfTheMonth: "、月の%s",
  commaOnTheLastDayOfTheMonth: "、月の最終日",
  commaOnTheLastX0OfTheMonth: "、月の最後の%s",
  commaOnDayX0OfTheMonth: "、%s日",
  commaAndOnX0: "、%s",
  first: "第1",
  second: "第2",
  third: "第3",
  fourth: "第4",
  fifth: "第5",
}

type Descriptor = typeof import("cronstrue/dist/expressionDescriptor").ExpressionDescriptor
type Locale = Record<string, () => string>

// cronstrue is CommonJS exporting its descriptor class as `default`; Vite
// wraps that once more than Node does.
const unwrap = (module: unknown) => (module as { default?: unknown }).default ?? module
const cronstrue = unwrap(unwrap(cronstrueModule)) as Descriptor
const locales = cronstrue.locales as unknown as Record<string, Locale>

// A locale of its own, so cronstrue's shared "ja" stays as published.
const JA_LOCALE = "ja-conductor"
locales[JA_LOCALE] = Object.assign(
  Object.create(locales.ja) as Locale,
  Object.fromEntries(Object.entries(JA_PHRASES).map(([phrase, text]) => [phrase, () => text])),
)

/**
 * A readable description, or undefined where cronstrue cannot read the
 * expression. Wording only: acceptance and run times come from conductor's
 * own rules (RustCron).
 */
export function describeCrontab(expression: string, language: Language): string | undefined {
  try {
    const text = cronstrue.toString(expression, {
      locale: language === "ja" ? JA_LOCALE : language,
      use24HourTimeFormat: true,
      // conductor requires both day fields to match when both are given.
      logicalAndDayFields: true,
    })
    return language === "ja" ? text.replaceAll(", ", "、") : text
  } catch {
    return undefined
  }
}
