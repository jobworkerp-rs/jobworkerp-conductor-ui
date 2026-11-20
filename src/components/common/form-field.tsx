import { useId, type ReactElement, type ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { WARNING_TEXT_CLASS } from "./warning-text"

export interface FieldControlProps {
  id: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
  "aria-required"?: boolean
}

/**
 * Label, help text and error for one input. The control is rendered by the
 * caller with the ids passed in, so help and error are announced with it.
 */
export function FormField({
  label,
  required = false,
  help,
  error,
  warning,
  children,
}: {
  label: string
  required?: boolean
  help?: string
  error?: string
  warning?: string
  /** `labelId` is for controls a <label for> cannot name, such as a code editor. */
  children: (control: FieldControlProps, meta: { labelId: string }) => ReactElement
}) {
  const id = useId()
  const notes: [string, ReactNode, string][] = []
  if (error) notes.push([`${id}-error`, error, "text-destructive"])
  if (warning) notes.push([`${id}-warning`, warning, WARNING_TEXT_CLASS])
  if (help) notes.push([`${id}-help`, help, "text-muted-foreground"])
  return (
    <div className="grid content-start gap-2">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children(
        {
          id,
          "aria-describedby":
            notes.length > 0 ? notes.map(([noteId]) => noteId).join(" ") : undefined,
          "aria-invalid": error ? true : undefined,
          // The visual asterisk is hidden from screen readers; this announces it.
          "aria-required": required || undefined,
        },
        { labelId: `${id}-label` },
      )}
      {notes.map(([noteId, text, className]) => (
        <p key={noteId} id={noteId} className={`text-sm ${className}`}>
          {text}
        </p>
      ))}
    </div>
  )
}
