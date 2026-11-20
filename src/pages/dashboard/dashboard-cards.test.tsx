import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { JobworkerpServerData } from "@/lib/grpc/jobworkerp_conductor/data/jobworkerp_server"
import type { ConfigDataByKind } from "@/lib/services/config"
import { renderWithRuntime, UNREACHABLE } from "@/test/render"
import { ServerCard } from "./server-card"
import { SummaryCards } from "./summary-cards"

const server = JobworkerpServerData.fromPartial({ name: "local", enabled: true })

describe("ServerCard", () => {
  it("does not count references before the settings have loaded", async () => {
    await renderWithRuntime(<ServerCard id="1" data={server} snapshot={undefined} />)
    expect(screen.getByText("Loading…")).toBeInTheDocument()
    expect(screen.queryByText(/^Schedules 0/)).not.toBeInTheDocument()
  })

  it("counts the settings that use the server", async () => {
    const schedule = {
      id: "7",
      data: {
        name: "nightly",
        jobworkerpServerId: { value: "1" },
      } as ConfigDataByKind["schedules"],
    }
    await renderWithRuntime(
      <ServerCard
        id="1"
        data={server}
        snapshot={{ schedules: [schedule], slackHandlers: [], resultHandlers: [] }}
      />,
    )
    expect(screen.getByText("Schedules 1 · Slack events 0 · Result handlers 0")).toBeInTheDocument()
  })
})

describe("SummaryCards", () => {
  it("says it is checking until every linked server has answered", async () => {
    await renderWithRuntime(<SummaryCards snapshot={undefined} servers={[{ data: server }]} />, {
      config: {
        conductorUrl: UNREACHABLE,
        jobworkerpServers: [{ name: "local", grpcWebUrl: UNREACHABLE }],
      },
    })
    expect(screen.getByText("Checking…")).toBeInTheDocument()
    expect(screen.queryByText(/linked reachable/)).not.toBeInTheDocument()
    expect(await screen.findByText("0 of 1 linked reachable")).toBeInTheDocument()
  })
})
