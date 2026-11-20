import type { ReactNode } from "react"

/** One label/value row; place inside a two-column <dl> grid. */
export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}
