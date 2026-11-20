import { describe, expect, it } from "vitest"
import { describeCrontab } from "./describe"

describe("describeCrontab", () => {
  it("describes in English", () => {
    expect(describeCrontab("0 0 9 * * MON-FRI", "en")).toBe("At 09:00, Monday through Friday")
    expect(describeCrontab("0 */15 * * * *", "en")).toBe("Every 15 minutes")
  })

  it("describes in Japanese as a list of conditions", () => {
    expect(describeCrontab("0 0 9 * * MON-FRI", "ja")).toBe("09:00、月曜日 から 金曜日 まで")
    expect(describeCrontab("0 0 0 L * *", "ja")).toBe("00:00、月の最終日")
    expect(describeCrontab("0 30 8-17 * * MON,WED", "ja")).not.toMatch(/, /)
  })

  it("reads both day fields as a condition on the same day", () => {
    expect(describeCrontab("0 0 0 13 * FRI", "en")).toBe(
      "At 00:00, on day 13 of the month, only on Friday",
    )
  })

  it("describes the aliases conductor accepts", () => {
    expect(describeCrontab("@daily", "en")).toBe("At 00:00")
  })

  it("is undefined for what it cannot read", () => {
    expect(describeCrontab("", "en")).toBeUndefined()
    expect(describeCrontab("not a cron", "ja")).toBeUndefined()
  })
})
