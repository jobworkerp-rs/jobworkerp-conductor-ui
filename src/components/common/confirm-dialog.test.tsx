import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { renderWithApp } from "@/test/render"
import { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog"

type HarnessProps = Omit<ConfirmDialogProps, "open" | "onOpenChange">

/** Owns the open state like a real caller, so closing can be observed. */
function Harness(props: HarnessProps) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <ConfirmDialog {...props} open={open} onOpenChange={setOpen} />
      {!open && <p>closed</p>}
    </>
  )
}

const base: HarnessProps = {
  title: "Delete schedule",
  description: "daily-report will be deleted.",
  confirmLabel: "Delete",
  onConfirm: async () => {},
}

describe("ConfirmDialog", () => {
  it("shows the title and description as an alert dialog", async () => {
    await renderWithApp(<Harness {...base} />)
    const dialog = screen.getByRole("alertdialog", { name: "Delete schedule" })
    expect(dialog).toHaveAccessibleDescription("daily-report will be deleted.")
  })

  it("runs the action and closes once it succeeds", async () => {
    let calls = 0
    await renderWithApp(
      <Harness
        {...base}
        onConfirm={async () => {
          calls += 1
        }}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(calls).toBe(1)
    await screen.findByText("closed")
  })

  it("closes on cancel without running the action", async () => {
    let calls = 0
    await renderWithApp(
      <Harness
        {...base}
        onConfirm={async () => {
          calls += 1
        }}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await screen.findByText("closed")
    expect(calls).toBe(0)
  })

  it("closes with the Escape key", async () => {
    await renderWithApp(<Harness {...base} />)
    await userEvent.keyboard("{Escape}")
    await screen.findByText("closed")
  })

  it("locks both buttons and ignores Escape while the action runs", async () => {
    let calls = 0
    let finish: () => void = () => {}
    await renderWithApp(
      <Harness
        {...base}
        onConfirm={() => {
          calls += 1
          return new Promise<void>((resolve) => {
            finish = resolve
          })
        }}
      />,
    )
    const confirm = screen.getByRole("button", { name: "Delete" })
    await userEvent.click(confirm)
    expect(confirm).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    await userEvent.keyboard("{Escape}")
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(calls).toBe(1)
    finish()
    await screen.findByText("closed")
  })

  it("stays open and unlocks after a failed action", async () => {
    await renderWithApp(<Harness {...base} onConfirm={() => Promise.reject(new Error("boom"))} />)
    const confirm = screen.getByRole("button", { name: "Delete" })
    await userEvent.click(confirm)
    await waitFor(() => expect(confirm).toBeEnabled())
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.queryByText("closed")).not.toBeInTheDocument()
  })

  it("requires the exact phrase before confirming", async () => {
    let calls = 0
    await renderWithApp(
      <Harness
        {...base}
        requiredText="DELETE"
        onConfirm={async () => {
          calls += 1
        }}
      />,
    )
    const confirm = screen.getByRole("button", { name: "Delete" })
    const input = screen.getByRole("textbox", { name: "Type DELETE to confirm" })
    expect(confirm).toBeDisabled()
    await userEvent.type(input, "delete")
    expect(confirm).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, "DELETE")
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(calls).toBe(1)
  })

  it("clears the typed phrase when reopened", async () => {
    function Reopen() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button onClick={() => setOpen(true)}>reopen</button>
          <ConfirmDialog {...base} requiredText="DELETE" open={open} onOpenChange={setOpen} />
        </>
      )
    }
    await renderWithApp(<Reopen />)
    await userEvent.type(screen.getByRole("textbox"), "DELETE")
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole("button", { name: "reopen" }))
    expect(screen.getByRole("textbox")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })

  it("keeps the action disabled while the caller is not ready", async () => {
    await renderWithApp(<Harness {...base} confirmDisabled />)
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })

  it("renders extra content such as a list of affected items", async () => {
    await renderWithApp(
      <Harness {...base}>
        <ul>
          <li>handler-a</li>
        </ul>
      </Harness>,
    )
    expect(screen.getByRole("listitem")).toHaveTextContent("handler-a")
  })

  it("uses the translated cancel label", async () => {
    await renderWithApp(<Harness {...base} />, { language: "ja" })
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument()
  })
})
