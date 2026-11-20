import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import {
  ExecutionSourceType as T,
  ResolvedExecutionStatus as S,
  type ExecutionRef,
} from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { renderWithRuntime } from "@/test/render"
import { ExecutionActionsMenu } from "./execution-actions-menu"

const execution: ExecutionRef = {
  id: { value: "70" },
  sourceType: T.EXECUTION_SOURCE_TYPE_SLACK_EVENT_HANDLER,
  sourceId: "5",
  sourceName: "deploy-bot",
  jobworkerpServerId: { value: "1" },
  triggeredAt: "0",
  createdAt: "0",
}

describe("ExecutionActionsMenu", () => {
  it("lists every operation, disabling those not possible with the reason", async () => {
    await renderWithRuntime(
      <ExecutionActionsMenu execution={execution} status={S.RESOLVED_EXECUTION_STATUS_RUNNING} />,
    )
    await userEvent.click(screen.getByRole("button", { name: "Actions for execution 70" }))
    expect(screen.getByRole("menuitem", { name: "Details" })).toHaveAttribute(
      "href",
      "/executions/70",
    )
    expect(screen.getByRole("menuitem", { name: "Open setting" })).toHaveAttribute(
      "href",
      "/slack-handlers/5/edit",
    )
    const cancel = screen.getByRole("menuitem", { name: /^Cancel/ })
    expect(cancel).toHaveAttribute("aria-disabled", "true")
    expect(cancel).toHaveTextContent("The job ID is not known yet")
    expect(screen.getByRole("menuitem", { name: /^Re-run/ })).toHaveTextContent(
      "Only executions started by a schedule",
    )
    expect(screen.getByRole("menuitem", { name: /^Delete/ })).toHaveTextContent(
      "Only finished executions",
    )
  })

  it("asks before re-running, saying the current settings are used", async () => {
    await renderWithRuntime(
      <ExecutionActionsMenu
        execution={{ ...execution, sourceType: T.EXECUTION_SOURCE_TYPE_CRON_SCHEDULER }}
        status={S.RESOLVED_EXECUTION_STATUS_SUCCEEDED}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: "Actions for execution 70" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Re-run" }))
    expect(screen.getByRole("alertdialog", { name: "Re-run deploy-bot?" })).toHaveTextContent(
      "current settings, not with the args of the original execution",
    )
  })
})
