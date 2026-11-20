import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ResolvedExecutionStatus as S } from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { renderWithRuntime } from "@/test/render"
import { ExecutionStatusBadge } from "./execution-status-badge"

describe("ExecutionStatusBadge", () => {
  it("names the status and gives the reason on focus", async () => {
    await renderWithRuntime(
      <ExecutionStatusBadge
        status={S.RESOLVED_EXECUTION_STATUS_UNAVAILABLE}
        detail="jobworkerp unreachable"
      />,
    )
    const badge = screen.getByText("Unavailable")
    await userEvent.tab()
    expect(badge.closest("[tabindex]")).toHaveFocus()
    expect(await screen.findByRole("tooltip")).toHaveTextContent("jobworkerp unreachable")
  })

  it("is not focusable without a reason", async () => {
    await renderWithRuntime(<ExecutionStatusBadge status={S.RESOLVED_EXECUTION_STATUS_SUCCEEDED} />)
    expect(screen.getByText("Succeeded").closest("[tabindex]")).toBeNull()
  })
})
