import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import type { ConfigKind } from "@/lib/execution-target/form"
import { EXECUTION_TARGET_DEFAULTS, type ExecutionTargetForm } from "@/lib/execution-target/form"
import type { ExecutionTargetErrors } from "@/lib/execution-target/validate"
import { renderWithRuntime } from "@/test/render"
import { ExecutionTargetField } from "./execution-target-field"

function Harness({
  kind = "schedule",
  initial = EXECUTION_TARGET_DEFAULTS,
  errors,
}: {
  kind?: ConfigKind
  initial?: ExecutionTargetForm
  errors?: ExecutionTargetErrors
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <ExecutionTargetField
        kind={kind}
        settingName="daily report"
        value={value}
        onChange={setValue}
        errors={errors}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  )
}

const current = () => JSON.parse(screen.getByTestId("value").textContent!) as ExecutionTargetForm

describe("ExecutionTargetField", () => {
  it("starts with a registered worker and offers the three methods", async () => {
    await renderWithRuntime(<Harness />)
    expect(screen.getByRole("radio", { name: /Registered worker/ })).toBeChecked()
    expect(screen.getByRole("radio", { name: /Workflow \(URL or path\)/ })).not.toBeChecked()
    expect(screen.getByLabelText(/^Worker name/)).toBeRequired()
  })

  it("does not offer an inline definition without a jobworkerp link, and says why", async () => {
    await renderWithRuntime(<Harness />)
    const inline = screen.getByRole("radio", { name: /Workflow \(written here\)/ })
    expect(inline).toBeDisabled()
    expect(inline).toHaveAccessibleDescription(/runtime configuration/)
  })

  it("shows the fields of the selected method and keeps the others' values", async () => {
    await renderWithRuntime(<Harness />)
    await userEvent.type(screen.getByLabelText(/^Worker name/), "report")
    await userEvent.click(screen.getByRole("radio", { name: /Workflow \(URL or path\)/ }))
    expect(screen.queryByLabelText(/^Worker name/)).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/^Workflow URL/), "https://h/f.yaml")
    await userEvent.type(screen.getByLabelText(/^Channel/), "batch")
    expect(current()).toMatchObject({
      method: "workflowUrl",
      workerName: "report",
      workflowUrl: "https://h/f.yaml",
      channel: "batch",
    })
    await userEvent.click(screen.getByRole("radio", { name: /Registered worker/ }))
    expect(screen.getByLabelText(/^Worker name/)).toHaveValue("report")
  })

  it("explains Slack's URL rule and shows errors against their fields", async () => {
    await renderWithRuntime(
      <Harness
        kind="slackHandler"
        initial={{ ...EXECUTION_TARGET_DEFAULTS, method: "workflowUrl" }}
        errors={{
          serverId: { key: "common.formErrors.required" },
          workflowUrl: { key: "executionTarget.errors.slackWorkflowUrl" },
        }}
      />,
    )
    const url = screen.getByLabelText(/^Workflow URL/)
    expect(url).toHaveAttribute("aria-invalid", "true")
    expect(url).toHaveAccessibleDescription(/do not use ".."/)
    expect(screen.getByLabelText(/^Server/)).toHaveAccessibleDescription(/required/)
  })

  it("formats the arguments", async () => {
    await renderWithRuntime(<Harness initial={{ ...EXECUTION_TARGET_DEFAULTS, args: '{"a":1}' }} />)
    await userEvent.click(screen.getByRole("button", { name: "Format" }))
    expect(screen.getByLabelText(/^Arguments/)).toHaveValue('{\n  "a": 1\n}')
  })

  it("warns about arguments the WORKFLOW runner would take as its own", async () => {
    await renderWithRuntime(
      <Harness
        initial={{
          ...EXECUTION_TARGET_DEFAULTS,
          method: "workflowInline",
          managedWorkerName: "w",
          args: '{"input":"x"}',
        }}
      />,
    )
    expect(screen.getByLabelText(/^Arguments/)).toHaveAccessibleDescription(
      /input is also an argument of the WORKFLOW runner/,
    )
  })

  it("explains what each kind of setting passes to the target", async () => {
    await renderWithRuntime(<Harness kind="resultHandler" />)
    expect(screen.getByText(/watched job's result as "result"/)).toBeInTheDocument()
  })

  it("is translated", async () => {
    await renderWithRuntime(<Harness />, { language: "ja" })
    expect(screen.getByRole("radio", { name: /登録済みワーカー/ })).toBeChecked()
  })
})
