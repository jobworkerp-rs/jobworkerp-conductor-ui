import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { SERVER_FORM_DEFAULTS, type ServerFormValues } from "@/lib/servers/form"
import { renderWithApp } from "@/test/render"
import { ServerForm } from "./server-form"

async function setup(
  props: Partial<Parameters<typeof ServerForm>[0]> = {},
  options: { language?: "ja" | "en" } = {},
) {
  const submitted: ServerFormValues[] = []
  await renderWithApp(
    <ServerForm
      initial={SERVER_FORM_DEFAULTS}
      existing={[{ id: "1", name: "taken" }]}
      onSubmit={async (values) => {
        submitted.push(values)
      }}
      onCancel={() => {}}
      {...props}
    />,
    options,
  )
  return { submitted }
}

describe("ServerForm", () => {
  it("starts from the defaults: port 9000, SSL off, enabled", async () => {
    await setup()
    expect(screen.getByLabelText(/^Port/)).toHaveValue("9000")
    expect(screen.getByRole("switch", { name: "Use SSL/TLS" })).not.toBeChecked()
    expect(screen.getByRole("switch", { name: "Enabled" })).toBeChecked()
  })

  it("submits the entered values", async () => {
    const { submitted } = await setup()
    await userEvent.type(screen.getByLabelText(/^Name/), "prod")
    await userEvent.type(screen.getByLabelText(/^Host/), "jobworkerp")
    await userEvent.click(screen.getByRole("switch", { name: "Use SSL/TLS" }))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(submitted).toEqual([
      { ...SERVER_FORM_DEFAULTS, name: "prod", host: "jobworkerp", sslEnabled: true },
    ])
  })

  it("shows field errors instead of submitting invalid values", async () => {
    const { submitted } = await setup()
    const port = screen.getByLabelText(/^Port/)
    await userEvent.clear(port)
    await userEvent.type(port, "65536")
    await userEvent.type(screen.getByLabelText(/^Host/), "http://x")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(submitted).toEqual([])
    expect(screen.getByLabelText(/^Name/)).toHaveAccessibleDescription(/required/i)
    const host = screen.getByLabelText(/^Host/)
    // The help text is always attached; the error has its own wording.
    expect(host).toHaveAccessibleDescription(/without scheme, port or path/)
    expect(host).toHaveAttribute("aria-invalid", "true")
    expect(port).toHaveAccessibleDescription(/1 to 65535/)
    expect(port).toHaveAttribute("aria-invalid", "true")
  })

  it("marks required fields for assistive technology", async () => {
    await setup()
    for (const label of [/^Name/, /^Host/, /^Port/]) {
      expect(screen.getByLabelText(label)).toBeRequired()
    }
    expect(screen.getByLabelText("Description")).not.toBeRequired()
  })

  it("moves focus to the first invalid field when saving is refused", async () => {
    await setup()
    await userEvent.type(screen.getByLabelText(/^Name/), "ok")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(screen.getByLabelText(/^Host/)).toHaveFocus()
  })

  it("warns about a duplicate name while typing but leaves the final check to the server", async () => {
    const { submitted } = await setup()
    await userEvent.type(screen.getByLabelText(/^Name/), "taken")
    expect(screen.getByText(/already used/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/^Host/), "h")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(submitted).toHaveLength(1)
  })

  it("does not flag its own name when editing", async () => {
    await setup({ initial: { ...SERVER_FORM_DEFAULTS, name: "taken" }, selfId: "1" })
    expect(screen.queryByText(/already used/)).not.toBeInTheDocument()
  })

  it("disables saving while the request runs and re-enables it when it settles", async () => {
    let settle: () => void = () => {}
    await setup({
      initial: { ...SERVER_FORM_DEFAULTS, name: "n", host: "h" },
      onSubmit: () =>
        new Promise<void>((resolve) => {
          settle = resolve
        }),
    })
    const save = screen.getByRole("button", { name: "Save" })
    await userEvent.click(save)
    expect(save).toBeDisabled()
    settle()
    await waitFor(() => expect(save).toBeEnabled())
  })

  it("is translated", async () => {
    await setup({}, { language: "ja" })
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument()
    expect(screen.getByLabelText(/^ポート/)).toBeInTheDocument()
  })
})
