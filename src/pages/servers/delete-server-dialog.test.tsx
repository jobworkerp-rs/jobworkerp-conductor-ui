import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ServerReference } from "@/lib/servers/references"
import { renderWithApp } from "@/test/render"
import { DeleteServerDialogView } from "./delete-server-dialog"

const ref = (kind: ServerReference["kind"], name: string): ServerReference => ({
  kind,
  id: name,
  name,
  roles: ["target"],
  enabled: true,
})

function show(references: ServerReference[] | undefined) {
  return renderWithApp(
    <DeleteServerDialogView
      serverName="prod-main"
      references={references}
      onClose={() => {}}
      onConfirm={async () => {}}
    />,
  )
}

describe("DeleteServerDialogView", () => {
  it("holds the confirmation until the current references are loaded", async () => {
    await show(undefined)
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
      /Checking which configurations use this server/,
    )
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })

  it("asks plainly when nothing uses the server", async () => {
    await show([])
    expect(screen.getByRole("alertdialog", { name: "Delete prod-main?" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("warns with the count and names of referencing configurations", async () => {
    await show([
      ref("schedule", "s1"),
      ref("schedule", "s2"),
      ref("schedule", "s3"),
      ref("schedule", "s4"),
      ref("resultHandler", "r1"),
    ])
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(/used by 5 configurations/)
    const items = screen.getAllByRole("listitem").map((li) => li.textContent)
    expect(items).toEqual(["Schedules: s1, s2, s3 and 1 more", "Result Handlers: r1"])
    expect(screen.getByRole("button", { name: "Delete anyway" })).toBeInTheDocument()
  })
})
