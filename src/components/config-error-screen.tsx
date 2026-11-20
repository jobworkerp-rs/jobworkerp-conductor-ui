import { useTranslation } from "react-i18next"
import type { ConfigError } from "@/lib/runtime-config"

/** Shown instead of the app when config.js is invalid, so nothing runs against a wrong endpoint. */
export function ConfigErrorScreen({ errors }: { errors: ConfigError[] }) {
  const { t } = useTranslation()
  const describe = (error: ConfigError) => {
    const message = t(`config.errors.${error.code}`, {
      field: t(`config.fields.${error.field}`),
      detail: error.detail,
    })
    // duplicate_server already names the server in its message.
    return error.detail && error.code !== "duplicate_server"
      ? message + t("config.serverDetail", { detail: error.detail })
      : message
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div role="alert" className="border-destructive space-y-3 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">{t("config.invalidTitle")}</h1>
        <p className="text-muted-foreground">{t("config.invalidDescription")}</p>
        <ul className="list-disc space-y-1 pl-5">
          {errors.map((error) => (
            <li key={`${error.field}:${error.code}:${error.detail ?? ""}`}>{describe(error)}</li>
          ))}
        </ul>
      </div>
    </main>
  )
}
