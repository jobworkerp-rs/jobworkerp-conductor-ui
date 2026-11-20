import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeAll, describe, expect, it } from "vitest"
import type { RustRegex } from "@/lib/slack/rust-regex"
import { loadTestRustRegex } from "@/test/wasm"
import { renderWithApp } from "@/test/render"
import { PatternField } from "./pattern-field"
import { ReactionNamesInput } from "./reaction-names-input"

let regex: RustRegex
beforeAll(async () => {
  regex = await loadTestRustRegex()
})

function Reactions({ initial = [] as string[] }) {
  const [names, setNames] = useState(initial)
  return (
    <>
      <ReactionNamesInput value={names} onChange={setNames} />
      <output data-testid="names">{names.join("|")}</output>
    </>
  )
}

describe("ReactionNamesInput", () => {
  it("adds names on Enter and comma, without colons or duplicates", async () => {
    await renderWithApp(<Reactions initial={["eyes"]} />)
    const input = screen.getByLabelText(/^Reactions/)
    await userEvent.type(input, ":+1:{Enter}")
    await userEvent.type(input, "eyes,white_check_mark,")
    expect(screen.getByTestId("names")).toHaveTextContent("eyes|+1|white_check_mark")
    expect(input).toHaveValue("")
  })

  it("removes a name with its button", async () => {
    await renderWithApp(<Reactions initial={["eyes", "+1"]} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove eyes" }))
    expect(screen.getByTestId("names")).toHaveTextContent(/^\+1$/)
  })
})

function Pattern({ regexModule }: { regexModule: RustRegex | undefined }) {
  const [value, setValue] = useState("(?i)^deploy")
  return (
    <PatternField
      label="Message pattern"
      help="help"
      value={value}
      onChange={setValue}
      regex={regexModule}
    />
  )
}

describe("PatternField", () => {
  it("tries a sample text with conductor's regex rules", async () => {
    await renderWithApp(<Pattern regexModule={regex} />)
    const sample = screen.getByLabelText("Try a text")
    await userEvent.type(sample, "Deploy now")
    expect(screen.getByRole("status")).toHaveTextContent("Matches")
    await userEvent.clear(sample)
    await userEvent.type(sample, "please deploy")
    expect(screen.getByRole("status")).toHaveTextContent("Does not match")
  })

  it("leaves checking to conductor without the regex module", async () => {
    await renderWithApp(<Pattern regexModule={undefined} />)
    expect(screen.queryByLabelText("Try a text")).not.toBeInTheDocument()
    expect(screen.getByText("Patterns are checked by conductor when saving.")).toBeInTheDocument()
  })
})
