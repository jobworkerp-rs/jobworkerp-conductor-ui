/** A validation message: an i18n key, its values, and untranslated detail. */
export interface FieldError {
  key: string
  values?: Record<string, string | number>
  /** Raw detail such as a parser message; shown as is. */
  detail?: string
  /** 1-based position, for errors inside a definition. */
  line?: number
  column?: number
}

type Translate = (key: string, values?: Record<string, unknown>) => string

export function fieldErrorText(t: Translate, error: FieldError): string {
  const text = t(error.key, { ...error.values, line: error.line, column: error.column })
  return error.detail ? `${text}: ${error.detail}` : text
}
