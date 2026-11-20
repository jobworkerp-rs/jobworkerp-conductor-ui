import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { useValidatedForm } from "./use-validated-form"

type Values = { a: string; b: string }

function Form({ onSubmit }: { onSubmit: (values: Values) => Promise<void> }) {
  const [values, setValues] = useState<Values>({ a: "", b: "" })
  const form = useValidatedForm<Values, Partial<Record<keyof Values, string>>>({
    values,
    validate: (v) => ({ ...(v.a ? {} : { a: "a?" }), ...(v.b ? {} : { b: "b?" }) }),
    onSubmit,
  })
  return (
    <form onSubmit={form.handleSubmit} noValidate>
      {(["a", "b"] as const).map((field) => (
        <div key={field}>
          <label>
            {field}
            <input
              value={values[field]}
              aria-invalid={form.errors[field] ? true : undefined}
              onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
            />
          </label>
          <span>{form.errors[field]}</span>
        </div>
      ))}
      <button disabled={form.pending}>save</button>
    </form>
  )
}

describe("useValidatedForm", () => {
  it("shows errors only after the first attempt and focuses the first invalid field", async () => {
    const sent: Values[] = []
    render(<Form onSubmit={async (v) => void sent.push(v)} />)
    expect(screen.queryByText("a?")).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("a"), "x")
    await userEvent.click(screen.getByRole("button", { name: "save" }))
    expect(screen.getByText("b?")).toBeInTheDocument()
    expect(screen.getByLabelText("b")).toHaveFocus()
    expect(sent).toEqual([])
  })

  it("submits valid values and locks saving until it settles", async () => {
    let settle: () => void = () => {}
    const sent: Values[] = []
    render(
      <Form
        onSubmit={(v) => {
          sent.push(v)
          return new Promise((resolve) => {
            settle = resolve
          })
        }}
      />,
    )
    await userEvent.type(screen.getByLabelText("a"), "x")
    await userEvent.type(screen.getByLabelText("b"), "y")
    const save = screen.getByRole("button", { name: "save" })
    await userEvent.click(save)
    expect(sent).toEqual([{ a: "x", b: "y" }])
    expect(save).toBeDisabled()
    settle()
    await waitFor(() => expect(save).toBeEnabled())
  })
})
