import { describe, expect, it } from "vitest"
import { createI18n, languageChoiceOf, resolveInitialLanguage } from "./i18n"

describe("resolveInitialLanguage", () => {
  it("prefers the stored choice", () => {
    expect(
      resolveInitialLanguage({ stored: "ja", runtimeDefault: "en", browserLanguages: ["en-US"] }),
    ).toBe("ja")
  })

  it("ignores an unsupported stored value and uses the runtime default", () => {
    expect(
      resolveInitialLanguage({ stored: "fr", runtimeDefault: "ja", browserLanguages: ["en-US"] }),
    ).toBe("ja")
  })

  it("follows the first supported browser language, matching by primary subtag", () => {
    expect(resolveInitialLanguage({ browserLanguages: ["fr-FR", "ja-JP", "en"] })).toBe("ja")
  })

  it("follows the browser when that was chosen, over the runtime default", () => {
    expect(
      resolveInitialLanguage({
        stored: "browser",
        runtimeDefault: "en",
        browserLanguages: ["ja-JP"],
      }),
    ).toBe("ja")
  })

  it("falls back to English", () => {
    expect(resolveInitialLanguage({ browserLanguages: ["fr-FR", "de"] })).toBe("en")
    expect(resolveInitialLanguage({ browserLanguages: [] })).toBe("en")
  })
})

describe("languageChoiceOf", () => {
  it("is the stored choice, including following the browser", () => {
    expect(languageChoiceOf("ja", "en")).toBe("ja")
    expect(languageChoiceOf("browser", "en")).toBe("browser")
  })

  it("is what applies without a stored choice: the runtime default, else the browser", () => {
    expect(languageChoiceOf(null, "en")).toBe("en")
    expect(languageChoiceOf(null, undefined)).toBe("browser")
    expect(languageChoiceOf("fr", undefined)).toBe("browser")
  })
})

describe("createI18n", () => {
  it("formats plurals per language", async () => {
    const en = await createI18n("en")
    const ja = await createI18n("ja")
    expect(en.t("common.items", { count: 1 })).toBe("1 item")
    expect(en.t("common.items", { count: 2 })).toBe("2 items")
    expect(ja.t("common.items", { count: 1 })).toBe("1 件")
    expect(ja.t("common.items", { count: 2 })).toBe("2 件")
  })

  it("falls back to English for a key missing in Japanese", async () => {
    const ja = await createI18n("ja")
    ja.addResource("en", "translation", "test.onlyInEnglish", "English only")
    expect(ja.t("test.onlyInEnglish")).toBe("English only")
  })

  it("switches language without recreating the instance", async () => {
    const i18n = await createI18n("ja")
    await i18n.changeLanguage("en")
    expect(i18n.t("nav.settings")).toBe("Settings")
  })
})
