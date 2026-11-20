import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes, useLocation } from "react-router"
import { describe, expect, it } from "vitest"
import { renderWithApp } from "@/test/render"
import { DataTable } from "./data-table"

const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `item-${i + 1}` }))
const columns = [{ id: "name", header: "Name", cell: (row: (typeof rows)[number]) => row.name }]

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>
}

function Harness({ data }: { data: typeof rows }) {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <DataTable columns={columns} rows={data} getRowId={(r) => r.id} pageSize={10} />
            <LocationProbe />
          </>
        }
      />
    </Routes>
  )
}

describe("DataTable", () => {
  it("shows the page named in the URL query", async () => {
    await renderWithApp(<Harness data={rows} />, { route: "/?page=3" })
    const body = screen.getAllByRole("rowgroup")[1]
    expect(
      within(body)
        .getAllByRole("row")
        .map((r) => r.textContent),
    ).toEqual(["item-21", "item-22", "item-23", "item-24", "item-25"])
    expect(screen.getByText("21–25 of 25")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("moves between pages and writes the page into the URL", async () => {
    await renderWithApp(<Harness data={rows} />)
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("11–20 of 25")).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("?page=2")
  })

  it("keeps other query parameters when paging", async () => {
    await renderWithApp(<Harness data={rows} />, { route: "/?status=enabled" })
    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByTestId("location")).toHaveTextContent("?status=enabled&page=2")
  })

  it("shows an empty state in the current language", async () => {
    await renderWithApp(<Harness data={[]} />, { language: "ja" })
    expect(screen.getByText("表示する項目がありません")).toBeInTheDocument()
  })

  describe("with a page fetched by the server", () => {
    function Served({
      page,
      hasNext,
      total,
      shown = 10,
    }: {
      page: number
      hasNext: boolean
      total?: number
      shown?: number
    }) {
      return (
        <>
          <DataTable
            columns={columns}
            rows={rows.slice(0, shown)}
            getRowId={(r) => r.id}
            pageSize={10}
            serverPage={{ page, hasNext, total, size: 10 }}
          />
          <LocationProbe />
        </>
      )
    }

    it("shows the rows as given, with the server's count", async () => {
      await renderWithApp(<Served page={2} hasNext total={35} />, { route: "/?page=2" })
      expect(within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row")).toHaveLength(10)
      expect(screen.getByText("11–20 of 35")).toBeInTheDocument()
      await userEvent.click(screen.getByRole("button", { name: "Previous" }))
      expect(screen.getByTestId("location")).toHaveTextContent("?page=1")
    })

    it("gives the server page's range even when only some of its rows are shown", async () => {
      await renderWithApp(<Served page={2} hasNext total={35} shown={3} />, { route: "/?page=2" })
      expect(within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row")).toHaveLength(3)
      expect(screen.getByText("11–20 of 35")).toBeInTheDocument()
    })

    it("pages by whether more follow when the count is unknown", async () => {
      await renderWithApp(<Served page={1} hasNext={false} />)
      expect(screen.getByText("1–10")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()
    })
  })
})
