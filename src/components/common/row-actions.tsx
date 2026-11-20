import { History, Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"

/** The icon buttons at the end of a list row, labelled with the entry's name. */
export function RowActions({
  name,
  editTo,
  historyTo,
  onDelete,
}: {
  name: string
  editTo: string
  /** Executions started by this entry, if it starts any. */
  historyTo?: string
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex justify-end gap-1">
      {historyTo && (
        <Button asChild variant="ghost" size="icon">
          <Link to={historyTo} aria-label={t("common.historyItem", { name })}>
            <History className="h-4 w-4" />
          </Link>
        </Button>
      )}
      <Button asChild variant="ghost" size="icon">
        <Link to={editTo} aria-label={t("common.editItem", { name })}>
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive"
        aria-label={t("common.deleteItem", { name })}
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
