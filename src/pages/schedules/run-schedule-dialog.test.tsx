import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { ConfigEntity } from "@/lib/services/config"
import { renderWithRuntime } from "@/test/render"
import { RunScheduleDialog } from "./run-schedule-dialog"

const schedule: ConfigEntity<"schedules"> = {
  id: "1",
  data: {
    name: "nightly",
    jobworkerpServerId: { value: "9" },
    workflowUrl: "",
    crontab: "0 0 3 * * *",
    enabled: false,
    createdAt: "0",
    updatedAt: "0",
    args: '{"a":1}',
    worker: { workerName: "w" },
  },
}

describe("RunScheduleDialog", () => {
  it("shows what runs and with which args, and that a disabled schedule still runs", async () => {
    await renderWithRuntime(<RunScheduleDialog schedule={schedule} onClose={() => {}} />)
    expect(screen.getByRole("alertdialog", { name: "Run nightly now?" })).toBeInTheDocument()
    expect(screen.getByText("Worker: w")).toBeInTheDocument()
    expect(screen.getByText('{"a":1}')).toBeInTheDocument()
    expect(screen.getByText(/This schedule is disabled/)).toBeInTheDocument()
  })

  it("replaces the args only once valid JSON is given", async () => {
    await renderWithRuntime(<RunScheduleDialog schedule={schedule} onClose={() => {}} />)
    const run = screen.getByRole("button", { name: "Run" })
    await userEvent.click(screen.getByLabelText("Replace the args for this run only"))
    const args = screen.getByLabelText("Args for this run")
    expect(args).toHaveValue('{"a":1}')
    expect(screen.getByText(/they are not merged/)).toBeInTheDocument()
    await userEvent.clear(args)
    await userEvent.type(args, "{{bad")
    expect(run).toBeDisabled()
    expect(args).toHaveAttribute("aria-invalid", "true")
    await userEvent.clear(args)
    await userEvent.type(args, '{{"b":2}')
    expect(run).toBeEnabled()
  })

  it("needs args to replace with; {} runs with none", async () => {
    await renderWithRuntime(<RunScheduleDialog schedule={schedule} onClose={() => {}} />)
    const run = screen.getByRole("button", { name: "Run" })
    await userEvent.click(screen.getByLabelText("Replace the args for this run only"))
    const args = screen.getByLabelText("Args for this run")
    await userEvent.clear(args)
    expect(run).toBeDisabled()
    expect(args).toHaveAccessibleDescription(/required/)
    await userEvent.type(args, "{{}")
    expect(run).toBeEnabled()
  })
})
