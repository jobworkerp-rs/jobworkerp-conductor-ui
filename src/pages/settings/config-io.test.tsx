import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { createJobworkerpClients } from "@/lib/clients"
import type { ManagedWorkers } from "@/hooks/use-settings-io"
import { renderWithRuntime, UNREACHABLE } from "@/test/render"
import { ClearAllDialog } from "./clear-all-dialog"
import { ExportSection } from "./export-section"
import { ImportSection, ValidationResult } from "./import-section"

const clients = createJobworkerpClients(UNREACHABLE)

const inUse: ManagedWorkers = {
  managed: [
    {
      kind: "schedule",
      id: "1",
      name: "nightly",
      serverId: "10",
      serverName: "local",
      workerName: "conductor-schedule-nightly",
      clients,
    },
  ],
  unverified: [
    {
      kind: "slackHandler",
      id: "2",
      name: "deploy",
      serverId: "20",
      workerName: "conductor-slack-deploy",
    },
  ],
  pending: false,
}
const none: ManagedWorkers = { managed: [], unverified: [], pending: false }

describe("ExportSection", () => {
  it("names the settings whose workflow definition the file leaves out", async () => {
    await renderWithRuntime(<ExportSection inUse={inUse} />)
    const notice = screen.getByRole("note")
    expect(within(notice).getByText("nightly")).toBeInTheDocument()
    expect(within(notice).getByText("conductor-schedule-nightly")).toBeInTheDocument()
    // Not confirmed (no browser link), but named like one.
    expect(within(notice).getByText("deploy")).toBeInTheDocument()
  })

  it("has no notice when no setting keeps its definition in jobworkerp", async () => {
    await renderWithRuntime(<ExportSection inUse={none} />)
    expect(screen.queryByRole("note")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Download TOML" })).toBeEnabled()
  })
})

describe("ImportSection", () => {
  it("imports only after the content has been validated", async () => {
    await renderWithRuntime(<ImportSection />)
    const validate = screen.getByRole("button", { name: "Validate" })
    const importButton = screen.getByRole("button", { name: "Import" })
    expect(validate).toBeDisabled()
    expect(importButton).toBeDisabled()
    await userEvent.type(screen.getByLabelText("TOML"), "[[jobworkerp]]")
    expect(validate).toBeEnabled()
    expect(importButton).toBeDisabled()
  })

  it("says what overwriting does", async () => {
    await renderWithRuntime(<ImportSection />)
    await userEvent.click(screen.getByLabelText(/Overwrite/))
    expect(screen.getByText(/deletes every existing setting first/)).toBeInTheDocument()
  })
})

describe("ValidationResult", () => {
  it("shows every error, the same text twice included", async () => {
    const counts = { servers: 0, schedules: 0, resultHandlers: 0, slackHandlers: 0 }
    const error = "Scheduler 'a': already exists"
    await renderWithRuntime(
      <ValidationResult result={{ ok: false, counts, errors: [error, error] }} />,
    )
    expect(screen.getAllByText(error)).toHaveLength(2)
  })
})

describe("ClearAllDialog", () => {
  it("needs DELETE typed, offers to delete the managed workers, and keeps history", async () => {
    await renderWithRuntime(<ClearAllDialog open onOpenChange={() => {}} inUse={inUse} />)
    const dialog = screen.getByRole("alertdialog")
    const confirm = within(dialog).getByRole("button", { name: "Delete all settings" })
    expect(confirm).toBeDisabled()
    expect(within(dialog).getByText(/Execution history is kept/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Also delete 1 managed workflow worker/)).toBeChecked()
    await userEvent.type(within(dialog).getByLabelText("Type DELETE to confirm"), "DELETE")
    expect(confirm).toBeEnabled()
  })

  it("does not offer to delete workers when there are none", async () => {
    await renderWithRuntime(<ClearAllDialog open onOpenChange={() => {}} inUse={none} />)
    expect(screen.queryByLabelText(/managed workflow worker/)).not.toBeInTheDocument()
  })
})
