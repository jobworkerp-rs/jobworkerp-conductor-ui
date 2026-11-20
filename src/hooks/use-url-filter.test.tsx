import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useLocation } from "react-router"
import { describe, expect, it } from "vitest"
import { parseNameStatusFilter } from "@/lib/list-filter"
import { renderWithApp } from "@/test/render"
import { useUrlFilter } from "./use-url-filter"

function Probe() {
  const [filter, setFilter] = useUrlFilter(parseNameStatusFilter)
  const location = useLocation()
  return (
    <>
      <button onClick={() => setFilter("status", "enabled")}>enable</button>
      <button onClick={() => setFilter("q", "")}>clear</button>
      <output data-testid="filter">{JSON.stringify(filter)}</output>
      <output data-testid="search">{location.search}</output>
    </>
  )
}

describe("useUrlFilter", () => {
  it("reads the filter and starts again from the first page when it changes", async () => {
    await renderWithApp(<Probe />, { route: "/list?q=dep&page=3" })
    expect(screen.getByTestId("filter")).toHaveTextContent('{"q":"dep"}')
    await userEvent.click(screen.getByRole("button", { name: "enable" }))
    expect(screen.getByTestId("search")).toHaveTextContent("?q=dep&status=enabled")
    await userEvent.click(screen.getByRole("button", { name: "clear" }))
    expect(screen.getByTestId("search")).toHaveTextContent("?status=enabled")
  })

  it("changes several filters in one step", async () => {
    function Patcher() {
      const [, , setFilters] = useUrlFilter(parseNameStatusFilter)
      return <button onClick={() => setFilters({ q: "", status: "" })}>reset</button>
    }
    await renderWithApp(
      <>
        <Patcher />
        <Probe />
      </>,
      { route: "/?q=dep&status=enabled&page=3" },
    )
    await userEvent.click(screen.getByRole("button", { name: "reset" }))
    expect(screen.getByTestId("search")).toHaveTextContent(/^$/)
  })
})
