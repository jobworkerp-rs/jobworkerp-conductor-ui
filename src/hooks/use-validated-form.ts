import { useState, type FormEvent } from "react"
import { flushSync } from "react-dom"

/**
 * Validation shown from the first save attempt on, for values the caller
 * holds (so validation may depend on what the caller derives from them). A
 * refused save moves focus to the first field marked aria-invalid, which
 * FormField sets from the error it is given.
 */
export function useValidatedForm<V, E extends object>({
  values,
  validate,
  onSubmit,
}: {
  values: V
  validate: (values: V) => E
  /** Reports its own failures, so it settles without throwing. */
  onSubmit: (values: V) => Promise<void>
}) {
  const [attempted, setAttempted] = useState(false)
  const [pending, setPending] = useState(false)
  const errors = attempted ? validate(values) : ({} as E)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    // Rendered synchronously so the first invalid field can take focus now.
    flushSync(() => setAttempted(true))
    if (Object.keys(validate(values)).length > 0) {
      form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus()
      return
    }
    setPending(true)
    try {
      await onSubmit(values)
    } finally {
      setPending(false)
    }
  }

  return { errors, pending, handleSubmit }
}
