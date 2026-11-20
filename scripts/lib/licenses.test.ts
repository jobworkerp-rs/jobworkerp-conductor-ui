import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { acceptedLicenses, licenseFileOf, renderPackages, satisfies } from "./licenses"

const ACCEPTED = acceptedLicenses(readFileSync("wasm/about.toml", "utf8"))

describe("acceptedLicenses", () => {
  it("reads the list cargo-about applies, comments left out", () => {
    expect(ACCEPTED).toContain("MIT")
    expect(ACCEPTED).toContain("Apache-2.0 WITH LLVM-exception")
    expect(ACCEPTED).not.toContain("GPL-3.0-only")
    expect(
      acceptedLicenses('accepted = [\n  "MIT", # preferred\n  # "GPL-2.0",\n  "ISC",\n]\n'),
    ).toEqual(["MIT", "ISC"])
  })

  it("refuses a file without the list", () => {
    expect(() => acceptedLicenses("targets = []")).toThrow()
  })
})

describe("satisfies", () => {
  it("accepts a license on the list, whatever its case", () => {
    expect(satisfies("MIT", ACCEPTED)).toBe(true)
    expect(satisfies("mit", ACCEPTED)).toBe(true)
  })

  it("needs every part of an AND and one part of an OR", () => {
    expect(satisfies("(Apache-2.0 AND BSD-3-Clause)", ACCEPTED)).toBe(true)
    expect(satisfies("MIT AND GPL-3.0-only", ACCEPTED)).toBe(false)
    expect(satisfies("GPL-3.0-only OR MIT", ACCEPTED)).toBe(true)
    expect(satisfies("(MIT OR Apache-2.0) AND (ISC OR GPL-2.0)", ACCEPTED)).toBe(true)
    expect(satisfies("(LGPL-2.1 OR GPL-2.0) AND MIT", ACCEPTED)).toBe(false)
  })

  it("reads WITH as one license with its exception", () => {
    expect(satisfies("Apache-2.0 WITH LLVM-exception", ACCEPTED)).toBe(true)
    expect(satisfies("GPL-2.0 WITH Classpath-exception-2.0", ACCEPTED)).toBe(false)
  })

  it("rejects copyleft, unknown and malformed licenses", () => {
    for (const expression of [
      "GPL-3.0-only",
      "UNLICENSED",
      "",
      "(MIT",
      "MIT AND",
      "SEE LICENSE IN x",
    ]) {
      expect(satisfies(expression, ACCEPTED)).toBe(false)
    }
  })
})

describe("licenseFileOf", () => {
  it("picks the license text among a package's files", () => {
    expect(licenseFileOf(["index.js", "LICENSE", "README.md"])).toBe("LICENSE")
    expect(licenseFileOf(["license.md", "package.json"])).toBe("license.md")
    expect(licenseFileOf(["LICENCE.txt"])).toBe("LICENCE.txt")
    expect(licenseFileOf(["COPYING"])).toBe("COPYING")
    expect(licenseFileOf(["LICENSE-MIT", "LICENSE-APACHE"])).toBe("LICENSE-MIT")
    expect(licenseFileOf(["index.js"])).toBeUndefined()
  })
})

describe("renderPackages", () => {
  it("lists each package with its license and text, in name order", () => {
    const text = renderPackages([
      { name: "zod", version: "4.0.0", license: "MIT", text: "MIT text" },
      { name: "clsx", version: "2.1.1", license: "MIT" },
    ])
    expect(text.indexOf("clsx 2.1.1")).toBeLessThan(text.indexOf("zod 4.0.0"))
    expect(text).toContain("License: MIT")
    expect(text).toContain("MIT text")
    expect(text).toContain("(the package ships no license file)")
  })
})
