import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderWithApp } from "@/test/render"
import { ConfigErrorScreen } from "./config-error-screen"

describe("ConfigErrorScreen", () => {
  it("lists each configuration error in the current language", async () => {
    await renderWithApp(
      <ConfigErrorScreen
        errors={[
          { field: "conductorUrl", code: "invalid_url" },
          { field: "jobworkerpServers", code: "duplicate_server", detail: "local" },
        ]}
      />,
      { language: "ja" },
    )
    expect(
      screen.getByRole("heading", { name: "ランタイム設定に誤りがあります" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("conductor API の URL: http または https の URL を指定してください"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("jobworkerp サーバーの対応付け: サーバー名「local」が重複しています"),
    ).toBeInTheDocument()
  })
})
