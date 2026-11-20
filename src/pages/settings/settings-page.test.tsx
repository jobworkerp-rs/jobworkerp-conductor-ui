import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { PREFERENCE_KEYS } from "@/lib/preferences"
import type { RuntimeConfig } from "@/lib/runtime-config"
import { renderWithRuntime, UNREACHABLE } from "@/test/render"
import { SettingsPage } from "./settings-page"

const config: RuntimeConfig = {
  conductorUrl: UNREACHABLE,
  jobworkerpServers: [
    { name: "local", grpcWebUrl: UNREACHABLE, adminUiUrl: "http://admin.example" },
    { name: "remote" },
  ],
}

afterEach(() => {
  window.localStorage.clear()
})

describe("SettingsPage connections", () => {
  it("shows where the UI connects, and how to change it", async () => {
    await renderWithRuntime(<SettingsPage />, { config })
    const section = screen.getByRole("region", { name: "Connections" })
    expect(within(section).getAllByText(UNREACHABLE).length).toBeGreaterThan(0)
    expect(await within(section).findByText("Cannot reach the conductor API")).toBeInTheDocument()
    expect(within(section).getByText(/CONDUCTOR_UI_/)).toBeInTheDocument()
  })

  it("lists each jobworkerp link with its reachability", async () => {
    await renderWithRuntime(<SettingsPage />, { config })
    const local = screen.getByRole("row", { name: /local/ })
    expect(within(local).getByText("http://admin.example")).toBeInTheDocument()
    expect(await within(local).findByText("Unreachable")).toBeInTheDocument()
    const remote = screen.getByRole("row", { name: /remote/ })
    expect(within(remote).getByText("Not linked")).toBeInTheDocument()
  })

  it("says cron expressions are read in UTC when no zone is configured", async () => {
    await renderWithRuntime(<SettingsPage />, { config })
    expect(screen.getByText("UTC")).toBeInTheDocument()
    expect(screen.getByText(/No cron time zone is configured/)).toBeInTheDocument()
  })
})

describe("SettingsPage display preferences", () => {
  it("stores the chosen auto refresh interval", async () => {
    await renderWithRuntime(<SettingsPage />, { config })
    const interval = screen.getByLabelText("Auto refresh interval")
    expect(interval).toHaveValue("30")
    await userEvent.selectOptions(interval, "60")
    expect(window.localStorage.getItem(PREFERENCE_KEYS.refreshInterval)).toBe("60")
  })

  it("switches the language at once and can follow the browser instead", async () => {
    await renderWithRuntime(<SettingsPage />, { config })
    await userEvent.selectOptions(screen.getByLabelText("Language"), "ja")
    expect(await screen.findByRole("heading", { name: "設定" })).toBeInTheDocument()
    expect(window.localStorage.getItem(PREFERENCE_KEYS.language)).toBe("ja")

    await userEvent.selectOptions(screen.getByLabelText("言語"), "browser")
    // jsdom's browser language is English.
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(window.localStorage.getItem(PREFERENCE_KEYS.language)).toBe("browser")
    expect(screen.getByLabelText("Language")).toHaveValue("browser")
  })
})
