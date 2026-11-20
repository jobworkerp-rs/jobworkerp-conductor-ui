import type { ReactNode } from "react"
import { Link } from "react-router"

/** The first cell of a list row: the name linking to the entry, its description, and extras. */
export function NameCell({
  name,
  to,
  description,
  children,
}: {
  name: string
  to: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div>
      <Link to={to} className="font-medium hover:underline">
        {name}
      </Link>
      {description && (
        <div className="text-muted-foreground line-clamp-1 text-xs">{description}</div>
      )}
      {children}
    </div>
  )
}
