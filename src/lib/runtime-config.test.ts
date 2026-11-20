import { describe, expect, it } from "vitest"
import { adminUiLinks, mergeRawConfig, parseRuntimeConfig } from "./runtime-config"

const PAGE = "https://ui.example.com/schedules?page=2"

describe("parseRuntimeConfig", () => {
  it("trims the cron time zone, as conductor reads CONDUCTOR_CRON_TIMEZONE", () => {
    expect(parseRuntimeConfig({ cronTimezone: " Asia/Tokyo " }, PAGE)).toMatchObject({
      ok: true,
      config: { cronTimezone: "Asia/Tokyo" },
    })
    // conductor treats a blank value as unset.
    const blank = parseRuntimeConfig({ cronTimezone: "  " }, PAGE)
    expect(blank).toMatchObject({ ok: true })
    expect(blank.ok && blank.config.cronTimezone).toBeUndefined()
  })

  it("accepts a complete configuration", () => {
    const result = parseRuntimeConfig(
      {
        conductorUrl: "http://localhost:9090/",
        jobworkerpServers: JSON.stringify([
          {
            name: "local",
            grpcWebUrl: "http://localhost:9000",
            adminUiUrl: "http://localhost:5174/",
          },
        ]),
        cronTimezone: "Asia/Tokyo",
        defaultLanguage: "ja",
        defaultTheme: "dark",
      },
      PAGE,
    )
    expect(result).toEqual({
      ok: true,
      config: {
        conductorUrl: "http://localhost:9090",
        jobworkerpServers: [
          {
            name: "local",
            grpcWebUrl: "http://localhost:9000",
            adminUiUrl: "http://localhost:5174",
          },
        ],
        cronTimezone: "Asia/Tokyo",
        defaultLanguage: "ja",
        defaultTheme: "dark",
      },
    })
  })

  it("defaults the conductor URL to the page origin and leaves the rest unset", () => {
    expect(parseRuntimeConfig({}, PAGE)).toEqual({
      ok: true,
      config: { conductorUrl: "https://ui.example.com", jobworkerpServers: [] },
    })
  })

  it("resolves relative URLs against the page", () => {
    const result = parseRuntimeConfig(
      {
        conductorUrl: "/",
        jobworkerpServers: JSON.stringify([{ name: "local", grpcWebUrl: "/" }]),
      },
      PAGE,
    )
    expect(result.ok && result.config.conductorUrl).toBe("https://ui.example.com")
    expect(result.ok && result.config.jobworkerpServers[0].grpcWebUrl).toBe(
      "https://ui.example.com",
    )
  })

  it("keeps a path prefix without a trailing slash", () => {
    const result = parseRuntimeConfig({ conductorUrl: "https://api.example.com/conductor/" }, PAGE)
    expect(result.ok && result.config.conductorUrl).toBe("https://api.example.com/conductor")
  })

  it.each([
    ["a non-http scheme", "ftp://example.com"],
    ["a javascript URL", "javascript:alert(1)"],
    ["an unparsable URL", "http://"],
  ])("rejects %s for the conductor URL", (_label, conductorUrl) => {
    expect(parseRuntimeConfig({ conductorUrl }, PAGE)).toEqual({
      ok: false,
      errors: [{ field: "conductorUrl", code: "invalid_url" }],
    })
  })

  it("rejects server mappings that are not JSON", () => {
    expect(parseRuntimeConfig({ jobworkerpServers: "[{name:" }, PAGE)).toEqual({
      ok: false,
      errors: [{ field: "jobworkerpServers", code: "invalid_json" }],
    })
  })

  it.each([
    ["an object instead of an array", { name: "local" }],
    ["an entry without a name", [{ grpcWebUrl: "http://x" }]],
    ["an empty name", [{ name: "" }]],
    ["a non-string URL", [{ name: "a", grpcWebUrl: 1 }]],
  ])("rejects server mappings with %s", (_label, value) => {
    expect(parseRuntimeConfig({ jobworkerpServers: JSON.stringify(value) }, PAGE)).toEqual({
      ok: false,
      errors: [{ field: "jobworkerpServers", code: "invalid_servers" }],
    })
  })

  it("rejects an invalid URL inside a server mapping", () => {
    expect(
      parseRuntimeConfig(
        { jobworkerpServers: JSON.stringify([{ name: "a", adminUiUrl: "ftp://x" }]) },
        PAGE,
      ),
    ).toEqual({
      ok: false,
      errors: [{ field: "jobworkerpServers", code: "invalid_url", detail: "a" }],
    })
  })

  it("rejects duplicate server names", () => {
    expect(
      parseRuntimeConfig(
        { jobworkerpServers: JSON.stringify([{ name: "a" }, { name: "b" }, { name: "a" }]) },
        PAGE,
      ),
    ).toEqual({
      ok: false,
      errors: [{ field: "jobworkerpServers", code: "duplicate_server", detail: "a" }],
    })
  })

  it("rejects an unknown time zone, language and theme together", () => {
    const result = parseRuntimeConfig(
      { cronTimezone: "Mars/Olympus", defaultLanguage: "fr", defaultTheme: "sepia" },
      PAGE,
    )
    expect(result).toEqual({
      ok: false,
      errors: [
        { field: "cronTimezone", code: "invalid_timezone" },
        { field: "defaultLanguage", code: "invalid_language" },
        { field: "defaultTheme", code: "invalid_theme" },
      ],
    })
  })
})

describe("mergeRawConfig", () => {
  it("prefers runtime values and falls back to build-time values", () => {
    expect(
      mergeRawConfig(
        { conductorUrl: "http://runtime", cronTimezone: "" },
        {
          VITE_CONDUCTOR_URL: "http://build",
          VITE_CRON_TIMEZONE: "UTC",
          VITE_DEFAULT_THEME: "light",
        },
      ),
    ).toEqual({ conductorUrl: "http://runtime", cronTimezone: "UTC", defaultTheme: "light" })
  })

  it("ignores a missing runtime object", () => {
    expect(mergeRawConfig(undefined, {})).toEqual({})
  })
})

describe("adminUiLinks", () => {
  it("lists only servers that have an admin-ui URL, in configuration order", () => {
    expect(
      adminUiLinks({
        conductorUrl: "http://c",
        jobworkerpServers: [
          { name: "a", adminUiUrl: "http://a-ui" },
          { name: "b", grpcWebUrl: "http://b" },
          { name: "c", adminUiUrl: "http://c-ui" },
        ],
      }),
    ).toEqual([
      { name: "a", url: "http://a-ui" },
      { name: "c", url: "http://c-ui" },
    ])
  })
})
