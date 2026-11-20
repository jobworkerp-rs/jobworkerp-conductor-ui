import { LineCounter, parseDocument } from "yaml"
import { isPlainObject } from "@/lib/json"
import { FORM_ERRORS } from "@/lib/validation"
import type { FieldError } from "@/lib/field-error"

/**
 * Syntax only: YAML (a superset of JSON) with a mapping at the top. Whether
 * it is a valid workflow is for jobworkerp to say when the worker is saved.
 */
export function checkDefinitionSyntax(text: string): FieldError | undefined {
  if (text.trim() === "") return { key: FORM_ERRORS.required }
  const lineCounter = new LineCounter()
  const document = parseDocument(text, { prettyErrors: false, lineCounter })
  const [error] = document.errors
  if (error) {
    const { line, col } = lineCounter.linePos(error.pos[0])
    return {
      key: "executionTarget.definition.errors.syntax",
      detail: error.message,
      line,
      column: col,
    }
  }
  if (!isPlainObject(document.toJS())) {
    return { key: "executionTarget.definition.errors.notObject" }
  }
  return undefined
}

/** A starting point that returns its input, so the delivered arguments are easy to inspect. */
export const WORKFLOW_TEMPLATE = `document:
  dsl: "1.0.0"
  namespace: "conductor"
  name: "example"
  version: "1.0.0"
input:
  schema:
    document:
      type: object
do:
  - echo:
      set:
        received: "\${.}"
`
