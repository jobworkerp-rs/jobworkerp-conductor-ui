// Usage: tsx scripts/generate-third-party-licenses.ts <out-file>
//
// Writes THIRD-PARTY-LICENSES.txt for a release: every JavaScript package the
// build bundles (pnpm's production dependencies, plus tailwindcss, whose
// generated CSS ships too) and every Rust crate compiled into the WebAssembly
// modules (cargo-about with wasm/about.toml). Fails, writing nothing, when any
// of them is under a license outside about.toml's accepted list, so a release
// can never ship a dependency whose license was not reviewed.
//
// THIRD_PARTY_LICENSES_PNPM_JSON reads the package list from a file instead of
// `pnpm licenses list`, and THIRD_PARTY_LICENSES_WASM=skip leaves the crates
// out; both are for the script's own tests.
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  acceptedLicenses,
  licenseFileOf,
  renderPackages,
  satisfies,
  type PackageLicense,
} from "./lib/licenses"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
// Built into the shipped modules; the other workspace crates are host tools.
const WASM_CRATES = ["slack-regex", "cron"]
const ABOUT_TOML = join(ROOT, "wasm", "about.toml")
const MAX_OUTPUT = 64 * 1024 * 1024
const fixture = process.env.THIRD_PARTY_LICENSES_PNPM_JSON

interface PnpmEntry {
  name: string
  versions: string[]
  paths: string[]
  license: string
  homepage?: string
}

function pnpmPackages(): PnpmEntry[] {
  const json =
    fixture !== undefined
      ? readFileSync(fixture, "utf8")
      : execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
          cwd: ROOT,
          encoding: "utf8",
          maxBuffer: MAX_OUTPUT,
        })
  return Object.values(JSON.parse(json) as Record<string, PnpmEntry[]>).flat()
}

function licenseText(dir: string): string | undefined {
  const file = existsSync(dir) ? licenseFileOf(readdirSync(dir)) : undefined
  return file && readFileSync(join(dir, file), "utf8")
}

function javascriptPackages(): PackageLicense[] {
  const entries = pnpmPackages()
  if (fixture === undefined) {
    const dir = join(ROOT, "node_modules", "tailwindcss")
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      version: string
      license: string
      homepage?: string
    }
    entries.push({ name: "tailwindcss", versions: [manifest.version], paths: [dir], ...manifest })
  }
  return entries.flatMap((entry) =>
    entry.versions.map((version, i) => ({
      name: entry.name,
      version,
      license: entry.license,
      homepage: entry.homepage,
      text: licenseText(entry.paths[i] ?? entry.paths[0] ?? ""),
    })),
  )
}

/**
 * cargo-about enforces about.toml itself (--fail). It runs from CARGO_ABOUT,
 * else the pinned copy scripts/install-cargo-about.sh puts in .tools/, else
 * as `cargo about`. Without --output-file it writes the listing to stdout.
 */
function rustCrates(): string {
  const pinned = join(ROOT, ".tools", "cargo-about", "cargo-about")
  const cargoAbout = process.env.CARGO_ABOUT ?? (existsSync(pinned) ? pinned : undefined)
  const [command, prefix] = cargoAbout ? [cargoAbout, []] : ["cargo", ["about"]]
  return WASM_CRATES.map((crate) =>
    execFileSync(
      command,
      [
        ...prefix,
        "generate",
        "--locked",
        "--fail",
        "--config",
        ABOUT_TOML,
        "--manifest-path",
        join(ROOT, "wasm", crate, "Cargo.toml"),
        join(ROOT, "wasm", "about.hbs"),
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: MAX_OUTPUT },
    ),
  ).join("\n")
}

function main() {
  const out = process.argv[2]
  if (!out) {
    console.error("usage: generate-third-party-licenses.ts <out-file>")
    process.exit(2)
  }
  const accepted = acceptedLicenses(readFileSync(ABOUT_TOML, "utf8"))
  const packages = javascriptPackages()
  const rejected = packages.filter((p) => !satisfies(p.license, accepted))
  if (rejected.length > 0) {
    for (const p of rejected) {
      console.error(`not an accepted license: ${p.name} ${p.version} (${p.license})`)
    }
    process.exit(1)
  }
  const crates = process.env.THIRD_PARTY_LICENSES_WASM === "skip" ? "" : rustCrates()
  writeFileSync(
    out,
    [
      "THIRD-PARTY SOFTWARE LICENSES",
      "=============================",
      "",
      "jobworkerp-conductor-ui is distributed under the MIT License (see LICENSE).",
      "Its build bundles the third-party software below, each under the license",
      "shown with it.",
      "",
      "JavaScript packages",
      "-------------------",
      "",
      renderPackages(packages),
      "Rust crates compiled into the WebAssembly modules",
      "-------------------------------------------------",
      crates,
    ].join("\n"),
  )
}

main()
