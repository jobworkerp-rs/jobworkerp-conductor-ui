import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useExecutionTargetContext, useObsoleteManagedWorker } from "@/hooks/use-execution-target"
import { useValidatedForm } from "@/hooks/use-validated-form"
import type { ManagedWorkerRef } from "@/lib/execution-target/cleanup"
import type { ConfigKind, ExecutionTargetForm } from "@/lib/execution-target/form"
import type { ExecutionTargetContext, ExecutionTargetErrors } from "@/lib/execution-target/validate"
import { fieldErrorText, type FieldError } from "@/lib/field-error"

/** What every setting form has besides its own fields. */
export interface SettingFormValues {
  name: string
  description: string
  enabled: boolean
  target: ExecutionTargetForm
}

export interface SettingFormErrors {
  name?: FieldError
  description?: FieldError
  target?: ExecutionTargetErrors
}

/**
 * State, validation and the "delete the unused worker" choice of a setting
 * form; the kind's own fields come with `validate` and the form's markup.
 */
export function useSettingForm<V extends SettingFormValues, E extends SettingFormErrors>({
  kind,
  initial,
  previous,
  validate,
  onSubmit,
}: {
  kind: ConfigKind
  initial: V
  /** The managed worker the stored setting uses, if any. */
  previous: ManagedWorkerRef | undefined
  validate: (values: V, targetContext: ExecutionTargetContext) => E
  onSubmit: (values: V, keepObsolete: boolean) => Promise<void>
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState(initial)
  const [deleteObsolete, setDeleteObsolete] = useState(true)
  const targetContext = useExecutionTargetContext(kind, values.target)
  const obsolete = useObsoleteManagedWorker(previous, values.target)
  const { errors, pending, handleSubmit } = useValidatedForm({
    values,
    validate: (v) => validate(v, targetContext),
    onSubmit: (v) => onSubmit(v, obsolete !== undefined && !deleteObsolete),
  })
  return {
    kind,
    values,
    setValues,
    set: (patch: Partial<V>) => setValues((current) => ({ ...current, ...patch })),
    errors,
    pending,
    handleSubmit,
    message: (error: FieldError | undefined) => error && fieldErrorText(t, error),
    obsolete,
    deleteObsolete,
    setDeleteObsolete,
  }
}

export type SettingForm<V extends SettingFormValues, E extends SettingFormErrors> = ReturnType<
  typeof useSettingForm<V, E>
>
