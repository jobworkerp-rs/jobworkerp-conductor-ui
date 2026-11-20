/** A JSON object (not an array or null). */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** JSON indented for reading; blank or invalid text is returned as it is. */
export function prettyJson(text: string): string {
  try {
    return text.trim() === "" ? text : JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
