/**
 * The licenses a release may ship: `accepted` in wasm/about.toml, the list
 * cargo-about applies to the Rust crates, so the JavaScript packages are held
 * to the same one.
 */
export function acceptedLicenses(aboutToml: string): string[] {
  const list = /^accepted\s*=\s*\[([^\]]*)\]/m.exec(aboutToml)?.[1]
  if (list === undefined) throw new Error("about.toml has no accepted list")
  return [...list.replace(/#.*$/gm, "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!)
}

type Token = "(" | ")" | "AND" | "OR" | "WITH" | { id: string }

function tokenize(expression: string): Token[] {
  return (expression.match(/[()]|[^\s()]+/g) ?? []).map((word) => {
    if (word === "(" || word === ")") return word
    const upper = word.toUpperCase()
    return upper === "AND" || upper === "OR" || upper === "WITH" ? upper : { id: word }
  })
}

/**
 * Whether an SPDX license expression is satisfied by the accepted licenses:
 * every part of an AND, one part of an OR. Anything that does not parse is
 * not satisfied, so an odd license field gets a human look.
 */
export function satisfies(expression: string, accepted: readonly string[]): boolean {
  const allowed = new Set(accepted.map((license) => license.toLowerCase()))
  const tokens = tokenize(expression)
  let at = 0
  // Typed on the binding, so a call narrows like a throw.
  const fail: () => never = () => {
    throw new Error("malformed")
  }
  // license := id [WITH id] | "(" or ")"
  const license = (): boolean => {
    const token = tokens[at++]
    if (token === "(") {
      const value = or()
      if (tokens[at++] !== ")") fail()
      return value
    }
    if (typeof token !== "object") fail()
    let id = token.id
    if (tokens[at] === "WITH") {
      at++
      const exception = tokens[at++]
      if (typeof exception !== "object") fail()
      id = `${id} WITH ${exception.id}`
    }
    return allowed.has(id.toLowerCase())
  }
  const and = (): boolean => {
    let value = license()
    while (tokens[at] === "AND") {
      at++
      value = license() && value
    }
    return value
  }
  const or = (): boolean => {
    let value = and()
    while (tokens[at] === "OR") {
      at++
      value = and() || value
    }
    return value
  }
  try {
    const value = or()
    return at === tokens.length && value
  } catch {
    return false
  }
}

const LICENSE_FILE = /^(licen[cs]e|copying)([-.].*)?$/i

/** The file holding a package's license text, preferring the plain name. */
export function licenseFileOf(files: readonly string[]): string | undefined {
  const candidates = files.filter((file) => LICENSE_FILE.test(file))
  return candidates.sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
}

export interface PackageLicense {
  name: string
  version: string
  license: string
  homepage?: string
  text?: string
}

const RULE = "=".repeat(80)

/** The listing of JavaScript packages, one block per package in name order. */
export function renderPackages(packages: readonly PackageLicense[]): string {
  return [...packages]
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
    .map((p) =>
      [
        RULE,
        `${p.name} ${p.version}${p.homepage ? ` (${p.homepage})` : ""}`,
        `License: ${p.license}`,
        RULE,
        "",
        p.text?.trim() ?? "(the package ships no license file)",
        "",
      ].join("\n"),
    )
    .join("\n")
}
