import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeAll, describe, expect, it } from "vitest"
import type { RustCron } from "@/lib/schedules/rust-cron"
import { renderWithApp } from "@/test/render"
import { loadTestRustCron } from "@/test/wasm"
import { CrontabField, type CronModule } from "./crontab-field"

let cron: RustCron
beforeAll(async () => {
  cron = await loadTestRustCron()
})

const NOW = Date.UTC(2026, 0, 1) / 1000

function Field({
  initial = "",
  module = { module: cron, error: undefined, reload: () => {} },
  timeZone = "UTC",
  configured = true,
  rejected,
}: {
  initial?: string
  module?: CronModule
  timeZone?: string
  configured?: boolean
  rejected?: string
}) {
  const [value, setValue] = useState(initial)
  return (
    <CrontabField
      value={value}
      onChange={setValue}
      cron={module}
      timeZone={{ timeZone, configured, rejected }}
      now={NOW}
    />
  )
}

describe("CrontabField", () => {
  it("fills the input from a preset and lists the next five runs in the cron time zone", async () => {
    await renderWithApp(<Field timeZone="Asia/Tokyo" />)
    await userEvent.click(screen.getByRole("button", { name: "Weekdays 9:00" }))
    expect(screen.getByLabelText(/^Cron expression/)).toHaveValue("0 0 9 * * MON-FRI")
    expect(await screen.findByText("At 09:00, Monday through Friday")).toBeInTheDocument()
    const runs = await screen.findAllByRole("listitem")
    expect(runs).toHaveLength(5)
    // 09:00 on 1 January in Tokyo is NOW itself, so the first run is the next weekday.
    expect(runs[0]).toHaveTextContent("01/02/2026, 09:00:00 GMT+9")
    expect(runs[1]).toHaveTextContent("01/05/2026, 09:00:00 GMT+9")
    expect(screen.getByText(/Asia\/Tokyo/)).toBeInTheDocument()
  })

  it("says that five fields get a seconds field", async () => {
    await renderWithApp(<Field initial="30 9 * * *" />)
    expect(await screen.findByText(/0 30 9 \* \* \*/)).toBeInTheDocument()
  })

  it("notes that both day fields must match", async () => {
    await renderWithApp(<Field initial="0 0 0 13 * FRI" />)
    expect(await screen.findByText(/day of the month and the day of the week/)).toBeInTheDocument()
  })

  it("shows conductor's message for an expression it refuses", async () => {
    await renderWithApp(<Field initial="0 0 24 * * *" />)
    expect(await screen.findByText(/conductor cannot schedule this expression/)).toBeInTheDocument()
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
  })

  it("warns when the time zone is not configured or observes daylight saving time", async () => {
    const { unmount } = await renderWithApp(<Field initial="@daily" configured={false} />)
    expect(await screen.findByText(/may differ from conductor's/)).toBeInTheDocument()
    unmount()
    await renderWithApp(<Field initial="@daily" timeZone="America/New_York" />)
    expect(await screen.findByText(/daylight saving time/)).toBeInTheDocument()
  })

  it("offers a retry when conductor's rules cannot be loaded", async () => {
    let reloads = 0
    await renderWithApp(
      <Field
        initial="@daily"
        module={{ module: undefined, error: new Error("404"), reload: () => reloads++ }}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(reloads).toBe(1)
  })

  it("says conductor runs in UTC when it cannot read the configured zone", async () => {
    await renderWithApp(<Field initial="0 0 9 * * *" timeZone="UTC" rejected="asia/tokyo" />)
    expect(
      await screen.findByText(/conductor cannot read the time zone "asia\/tokyo"/),
    ).toBeInTheDocument()
    expect((await screen.findAllByRole("listitem"))[0]).toHaveTextContent("09:00:00 UTC")
  })

  it("announces the description, not the list of runs", async () => {
    await renderWithApp(<Field initial="0 0 9 * * *" />)
    const status = await screen.findByRole("status")
    expect(status).toHaveTextContent("At 09:00")
    for (const item of screen.getAllByRole("listitem")) expect(status).not.toContainElement(item)
  })
})
