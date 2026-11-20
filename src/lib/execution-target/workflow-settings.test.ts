import { describe, expect, it } from "vitest"
// The runner_settings_proto that jobworkerp v0.25 reports for its WORKFLOW runner.
import settingsProto from "@/test/fixtures/workflow-runner-settings.proto?raw"
import { decodeWorkflowSettings, encodeWorkflowSettings } from "./workflow-settings"

describe("encodeWorkflowSettings", () => {
  it("stores the definition as workflow_data (field 2)", () => {
    expect(Array.from(encodeWorkflowSettings(settingsProto, "abc"))).toEqual([
      0x12, 3, 0x61, 0x62, 0x63,
    ])
  })
})

describe("decodeWorkflowSettings", () => {
  it("reads back the definition, including multi-byte text", () => {
    const definition = "do:\n  - 挨拶:\n      set: {}\n"
    expect(
      decodeWorkflowSettings(settingsProto, encodeWorkflowSettings(settingsProto, definition)),
    ).toEqual({
      workflowData: definition,
    })
  })

  it("reports a URL-based setting so the caller can refuse to edit it inline", () => {
    // workflow_url (field 1) = "u"
    expect(decodeWorkflowSettings(settingsProto, new Uint8Array([0x0a, 1, 0x75]))).toEqual({
      workflowUrl: "u",
    })
  })

  it("rejects a schema without a message", () => {
    expect(() => encodeWorkflowSettings('syntax = "proto3";', "x")).toThrow()
  })
})
