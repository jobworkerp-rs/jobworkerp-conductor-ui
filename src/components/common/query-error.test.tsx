import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ClientError, Status } from "nice-grpc-common"
import { describe, expect, it } from "vitest"
import { renderWithApp } from "@/test/render"
import { QueryError } from "./query-error"

describe("QueryError", () => {
  it("shows the user-facing message, the server detail and a retry button", async () => {
    let retries = 0
    await renderWithApp(
      <QueryError
        error={new ClientError("/x", Status.INTERNAL, "db exploded")}
        onRetry={() => {
          retries += 1
        }}
      />,
    )
    expect(screen.getByRole("alert")).toHaveTextContent("The server could not process the request")
    expect(screen.getByText("db exploded")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(retries).toBe(1)
  })
})
