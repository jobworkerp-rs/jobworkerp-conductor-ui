import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import { NativeSelect } from "@/components/common/native-select"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { useLanguageChoice } from "@/hooks/use-language"
import { SUPPORTED_LANGUAGES, isLanguage } from "@/lib/languages"
import { THEMES, isTheme } from "@/lib/preferences"
import { REFRESH_INTERVALS, parseRefreshSeconds } from "@/lib/refresh"
import { SettingsSection } from "./settings-section"

/** Per-browser display preferences (spec §6.7); each applies at once. */
export function DisplaySection() {
  const { t } = useTranslation()
  const { choice, setChoice } = useLanguageChoice()
  const { theme, setTheme } = useTheme()
  const { intervalSeconds, setIntervalSeconds } = useAutoRefresh()
  return (
    <SettingsSection
      title={t("settingsPage.display.title")}
      description={t("settingsPage.display.description")}
    >
      <div className="grid max-w-md gap-4">
        <FormField label={t("settingsPage.display.language")}>
          {(control) => (
            <NativeSelect
              {...control}
              value={choice}
              onChange={(e) =>
                void setChoice(isLanguage(e.target.value) ? e.target.value : "browser")
              }
            >
              {SUPPORTED_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {t(`languages.${language}`)}
                </option>
              ))}
              <option value="browser">{t("settingsPage.display.followBrowser")}</option>
            </NativeSelect>
          )}
        </FormField>
        <FormField label={t("settingsPage.display.theme")}>
          {(control) => (
            <NativeSelect
              {...control}
              value={isTheme(theme) ? theme : "system"}
              onChange={(e) => setTheme(e.target.value)}
            >
              {THEMES.map((option) => (
                <option key={option} value={option}>
                  {t(`header.themes.${option}`)}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          label={t("settingsPage.display.interval")}
          help={t("settingsPage.display.intervalHelp")}
        >
          {(control) => (
            <NativeSelect
              {...control}
              value={String(intervalSeconds)}
              onChange={(e) => setIntervalSeconds(parseRefreshSeconds(e.target.value))}
            >
              {REFRESH_INTERVALS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {t("settingsPage.display.seconds", { seconds })}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
    </SettingsSection>
  )
}
