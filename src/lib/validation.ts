import type { FieldError } from "@/lib/field-error"

// Limits shared by every configuration's name and description (spec §6).
export const NAME_MAX_LENGTH = 100
export const DESCRIPTION_MAX_LENGTH = 500

/** i18n keys of the generic form errors; they interpolate {{max}}. */
export const FORM_ERRORS = {
  required: "common.formErrors.required",
  tooLong: "common.formErrors.tooLong",
} as const

const charLength = (value: string) => [...value].length

/** UTF-8 byte length, as conductor and jobworkerp (Rust's str::len) count limits. */
export const byteLength = (value: string) => new TextEncoder().encode(value).length

export function validateName(value: string): string | undefined {
  const name = value.trim()
  if (name === "") return FORM_ERRORS.required
  if (charLength(name) > NAME_MAX_LENGTH) return FORM_ERRORS.tooLong
  return undefined
}

export function validateDescription(value: string): string | undefined {
  return charLength(value.trim()) > DESCRIPTION_MAX_LENGTH ? FORM_ERRORS.tooLong : undefined
}

/** A message key as a FieldError carrying the limit its message mentions. */
function withLimit(key: string | undefined, max: number): FieldError | undefined {
  if (!key) return undefined
  return key === FORM_ERRORS.required ? { key } : { key, values: { max } }
}

export const nameFieldError = (value: string) => withLimit(validateName(value), NAME_MAX_LENGTH)

export const descriptionFieldError = (value: string) =>
  withLimit(validateDescription(value), DESCRIPTION_MAX_LENGTH)

export const requiredFieldError = (value: string): FieldError | undefined =>
  value.trim() === "" ? { key: FORM_ERRORS.required } : undefined

/** The fields that have an error; a form is valid when nothing is left. */
export function compactErrors<E extends object>(errors: E): E {
  return Object.fromEntries(Object.entries(errors).filter(([, error]) => error !== undefined)) as E
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0
