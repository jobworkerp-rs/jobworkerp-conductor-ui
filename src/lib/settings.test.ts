import { describe, expect, it } from "vitest"
import type { ConfigDataByKind } from "@/lib/services/config"
import { SETTING_ENTITY, TARGET_KIND, settingEditPath, targetServerIdOf } from "./settings"

describe("targetServerIdOf", () => {
  it("is the process server for result handlers and the only server otherwise", () => {
    expect(
      targetServerIdOf("resultHandlers", {
        listenJobworkerpServerId: { value: "1" },
        processJobworkerpServerId: { value: "2" },
      } as ConfigDataByKind["resultHandlers"]),
    ).toBe("2")
    expect(
      targetServerIdOf("schedules", {
        jobworkerpServerId: { value: "3" },
      } as ConfigDataByKind["schedules"]),
    ).toBe("3")
    expect(targetServerIdOf("slackHandlers", {} as ConfigDataByKind["slackHandlers"])).toBe("")
  })
})

describe("TARGET_KIND", () => {
  it("maps each setting list to the execution target's kind", () => {
    expect(TARGET_KIND).toEqual({
      schedules: "schedule",
      slackHandlers: "slackHandler",
      resultHandlers: "resultHandler",
    })
  })
})

describe("settingEditPath", () => {
  it("links to each kind of setting's edit page", () => {
    expect(settingEditPath("schedule", "7")).toBe("/schedules/7/edit")
    expect(settingEditPath("slackHandler", "8")).toBe("/slack-handlers/8/edit")
    expect(settingEditPath("resultHandler", "9")).toBe("/result-handlers/9/edit")
  })

  it("maps every kind back to its list", () => {
    for (const [entity, kind] of Object.entries(TARGET_KIND)) {
      expect(SETTING_ENTITY[kind]).toBe(entity)
    }
  })
})
