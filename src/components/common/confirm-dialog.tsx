import { useId, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useNotify } from "@/hooks/use-notify"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean
  /** Keeps the action disabled, e.g. while the caller still loads what the dialog shows. */
  confirmDisabled?: boolean
  /** When set, the action stays disabled until the user types this text. */
  requiredText?: string
  /** Performs the action; the dialog closes only when it resolves. */
  onConfirm: () => Promise<void>
  /** Extra content between the description and the buttons. */
  children?: ReactNode
}

export function ConfirmDialog({ open, onOpenChange, ...body }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* The body unmounts on close, so the typed phrase never survives a reopen. */}
      {open && <ConfirmDialogBody {...body} onClose={() => onOpenChange(false)} />}
    </AlertDialog>
  )
}

function ConfirmDialogBody({
  title,
  description,
  confirmLabel,
  destructive = false,
  confirmDisabled = false,
  requiredText,
  onConfirm,
  children,
  onClose,
}: Omit<ConfirmDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const { t } = useTranslation()
  const notify = useNotify()
  const inputId = useId()
  const [typed, setTyped] = useState("")
  const [pending, setPending] = useState(false)
  const phraseMatches = requiredText === undefined || typed === requiredText

  const handleConfirm = async () => {
    setPending(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      notify.error(err)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialogContent
      onEscapeKeyDown={(event) => {
        // Closing mid-request would hide whether the action went through.
        if (pending) event.preventDefault()
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {children}
      {requiredText !== undefined && (
        <div className="grid gap-2">
          <Label htmlFor={inputId}>{t("common.typeToConfirm", { text: requiredText })}</Label>
          <Input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </div>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{t("common.cancel")}</AlertDialogCancel>
        <Button
          variant={destructive ? "destructive" : "default"}
          disabled={pending || confirmDisabled || !phraseMatches}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}
