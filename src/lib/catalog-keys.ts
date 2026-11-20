const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function collectKeys(node: unknown, prefix: string, out: Set<string>): void {
  if (node !== null && typeof node === "object") {
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      collectKeys(child, prefix ? `${prefix}.${key}` : key, out)
    }
    return
  }
  // Languages differ in plural forms (English has _one/_other, Japanese only
  // _other), so all forms of a key count as that key.
  out.add(prefix.replace(PLURAL_SUFFIX, ""))
}

/** Keys present in `reference` but not `other` (missing) and vice versa (extra). */
export function diffCatalogKeys(
  reference: unknown,
  other: unknown,
): { missing: string[]; extra: string[] } {
  const referenceKeys = new Set<string>()
  const otherKeys = new Set<string>()
  collectKeys(reference, "", referenceKeys)
  collectKeys(other, "", otherKeys)
  return {
    missing: [...referenceKeys].filter((key) => !otherKeys.has(key)).sort(),
    extra: [...otherKeys].filter((key) => !referenceKeys.has(key)).sort(),
  }
}
