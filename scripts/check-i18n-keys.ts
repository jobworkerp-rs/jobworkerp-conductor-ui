// Fails when a translation catalog lacks keys of the reference (English)
// catalog or has keys the reference does not know (spec §4.2).
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { diffCatalogKeys } from "../src/lib/catalog-keys"

const LOCALES_DIR = join(import.meta.dirname, "..", "src", "locales")
const REFERENCE = "en"

const load = (language: string): unknown =>
  JSON.parse(readFileSync(join(LOCALES_DIR, language, "translation.json"), "utf8"))

const reference = load(REFERENCE)
let failed = false
for (const language of readdirSync(LOCALES_DIR).filter((l) => l !== REFERENCE)) {
  const { missing, extra } = diffCatalogKeys(reference, load(language))
  for (const key of missing) console.error(`${language}: missing ${key}`)
  for (const key of extra) console.error(`${language}: unknown key ${key}`)
  failed ||= missing.length > 0 || extra.length > 0
}
if (failed) process.exit(1)
console.log("translation catalogs are consistent")
