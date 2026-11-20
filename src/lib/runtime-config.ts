import { z } from "zod"
import { isLanguage, type Language } from "./languages"
import { isTheme, type Theme } from "./preferences"

/** Browser-facing endpoints of a jobworkerp server registered in conductor, matched by name. */
export interface JobworkerpServerLink {
  name: string
  grpcWebUrl?: string
  adminUiUrl?: string
}

export interface RuntimeConfig {
  conductorUrl: string
  jobworkerpServers: JobworkerpServerLink[]
  cronTimezone?: string
  defaultLanguage?: Language
  defaultTheme?: Theme
}

/** Every value arrives as a string; see docker/generate-config.sh. */
export type RawConfig = Partial<
  Record<
    "conductorUrl" | "jobworkerpServers" | "cronTimezone" | "defaultLanguage" | "defaultTheme",
    string
  >
>

export type ConfigErrorCode =
  | "invalid_url"
  | "invalid_json"
  | "invalid_servers"
  | "duplicate_server"
  | "invalid_timezone"
  | "invalid_language"
  | "invalid_theme"

export interface ConfigError {
  field: keyof RawConfig
  code: ConfigErrorCode
  /** The offending server name, when the error concerns one entry. */
  detail?: string
}

export type ConfigResult =
  { ok: true; config: RuntimeConfig } | { ok: false; errors: ConfigError[] }

const serverEntrySchema = z.object({
  name: z.string().min(1),
  grpcWebUrl: z.string().optional(),
  adminUiUrl: z.string().optional(),
})
const serversSchema = z.array(serverEntrySchema)

/** Resolves against the page so "/" means "same origin"; only http(s) is allowed. */
function resolveUrl(value: string, pageUrl: string): string | undefined {
  let url: URL
  try {
    url = new URL(value, pageUrl)
  } catch {
    return undefined
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname === "") {
    return undefined
  }
  // gRPC-Web clients append "/package.Service/Method", so drop the trailing slash.
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "")
}

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone })
    return true
  } catch {
    return false
  }
}

function parseServers(
  raw: string,
  pageUrl: string,
): { servers: JobworkerpServerLink[] } | { error: ConfigError } {
  const field = "jobworkerpServers"
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { error: { field, code: "invalid_json" } }
  }
  const parsed = serversSchema.safeParse(json)
  if (!parsed.success) {
    return { error: { field, code: "invalid_servers" } }
  }
  const seen = new Set<string>()
  const servers: JobworkerpServerLink[] = []
  for (const entry of parsed.data) {
    if (seen.has(entry.name)) {
      return { error: { field, code: "duplicate_server", detail: entry.name } }
    }
    seen.add(entry.name)
    const server: JobworkerpServerLink = { name: entry.name }
    for (const key of ["grpcWebUrl", "adminUiUrl"] as const) {
      const value = entry[key]
      if (value === undefined) continue
      const resolved = resolveUrl(value, pageUrl)
      if (resolved === undefined) {
        return { error: { field, code: "invalid_url", detail: entry.name } }
      }
      server[key] = resolved
    }
    servers.push(server)
  }
  return { servers }
}

export function parseRuntimeConfig(raw: RawConfig, pageUrl: string): ConfigResult {
  const errors: ConfigError[] = []
  const config: RuntimeConfig = { conductorUrl: "", jobworkerpServers: [] }

  const conductorUrl = resolveUrl(raw.conductorUrl ?? "/", pageUrl)
  if (conductorUrl === undefined) {
    errors.push({ field: "conductorUrl", code: "invalid_url" })
  } else {
    config.conductorUrl = conductorUrl
  }

  if (raw.jobworkerpServers !== undefined) {
    const result = parseServers(raw.jobworkerpServers, pageUrl)
    if ("error" in result) errors.push(result.error)
    else config.jobworkerpServers = result.servers
  }

  // conductor trims CONDUCTOR_CRON_TIMEZONE and treats a blank one as unset.
  const cronTimezone = raw.cronTimezone?.trim()
  if (cronTimezone) {
    if (isValidTimeZone(cronTimezone)) config.cronTimezone = cronTimezone
    else errors.push({ field: "cronTimezone", code: "invalid_timezone" })
  }

  if (raw.defaultLanguage !== undefined) {
    if (isLanguage(raw.defaultLanguage)) config.defaultLanguage = raw.defaultLanguage
    else errors.push({ field: "defaultLanguage", code: "invalid_language" })
  }

  if (raw.defaultTheme !== undefined) {
    if (isTheme(raw.defaultTheme)) config.defaultTheme = raw.defaultTheme
    else errors.push({ field: "defaultTheme", code: "invalid_theme" })
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, config }
}

export const BUILD_TIME_KEYS: Record<keyof RawConfig, string> = {
  conductorUrl: "VITE_CONDUCTOR_URL",
  jobworkerpServers: "VITE_JOBWORKERP_SERVERS",
  cronTimezone: "VITE_CRON_TIMEZONE",
  defaultLanguage: "VITE_DEFAULT_LANGUAGE",
  defaultTheme: "VITE_DEFAULT_THEME",
}

/**
 * Runtime values (config.js, written at container start) win over build-time
 * values (.env files, used in development). Empty strings count as unset.
 */
export function mergeRawConfig(
  runtime: RawConfig | undefined,
  buildTime: Record<string, string | undefined>,
): RawConfig {
  const merged: RawConfig = {}
  for (const [key, envKey] of Object.entries(BUILD_TIME_KEYS) as [keyof RawConfig, string][]) {
    const value = runtime?.[key] || buildTime[envKey]
    if (value) merged[key] = value
  }
  return merged
}

declare global {
  interface Window {
    __CONDUCTOR_UI_CONFIG__?: RawConfig
  }
}

/** Servers that have an admin-ui to link to (sidebar and header, spec §4.1 / §5.1). */
export function adminUiLinks(config: RuntimeConfig): { name: string; url: string }[] {
  return config.jobworkerpServers.flatMap((server) =>
    server.adminUiUrl ? [{ name: server.name, url: server.adminUiUrl }] : [],
  )
}

export function loadRuntimeConfig(): ConfigResult {
  const raw = mergeRawConfig(window.__CONDUCTOR_UI_CONFIG__, import.meta.env)
  return parseRuntimeConfig(raw, window.location.href)
}
