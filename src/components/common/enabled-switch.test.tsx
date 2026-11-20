import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { renderWithApp } from "@/test/render"
import { EnabledSwitch } from "./enabled-switch"

describe("EnabledSwitch", () => {
  it("is labelled for screen readers with the item name", async () => {
    await renderWithApp(<EnabledSwitch name="daily-report" checked onToggle={async () => {}} />)
    expect(screen.getByRole("switch", { name: "Enable or disable daily-report" })).toBeChecked()
  })

  it("passes the requested state and stays disabled until the update settles", async () => {
    const calls: boolean[] = []
    let finish: () => void = () => {}
    const onToggle = (next: boolean) => {
      calls.push(next)
      return new Promise<void>((resolve) => {
        finish = resolve
      })
    }
    await renderWithApp(<EnabledSwitch name="x" checked={false} onToggle={onToggle} />)
    const control = screen.getByRole("switch")
    await userEvent.click(control)
    expect(calls).toEqual([true])
    expect(control).toBeDisabled()
    finish()
    await waitFor(() => expect(control).toBeEnabled())
  })

  it("re-enables itself after a failed update", async () => {
    await renderWithApp(
      <EnabledSwitch name="x" checked={false} onToggle={() => Promise.reject(new Error("boom"))} />,
    )
    const control = screen.getByRole("switch")
    await userEvent.click(control)
    await waitFor(() => expect(control).toBeEnabled())
  })
})
