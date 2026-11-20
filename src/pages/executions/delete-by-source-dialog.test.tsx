import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { renderWithRuntime } from "@/test/render"
import { DeleteBySourceDialog } from "./delete-by-source-dialog"

describe("DeleteBySourceDialog", () => {
  it("needs the source's name typed to include unfinished executions", async () => {
    await renderWithRuntime(
      <DeleteBySourceDialog kind="schedule" sourceId="5" name="nightly" onClose={() => {}} />,
    )
    const remove = screen.getByRole("button", { name: "Delete" })
    expect(remove).toBeEnabled()
    await userEvent.click(screen.getByLabelText(/Include unfinished executions/))
    expect(remove).toBeDisabled()
    await userEvent.type(screen.getByLabelText("Type nightly to confirm"), "nightly")
    expect(remove).toBeEnabled()
  })
})
