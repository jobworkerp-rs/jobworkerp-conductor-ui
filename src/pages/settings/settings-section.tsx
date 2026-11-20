import { useId, type ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** A titled card that is also a landmark, so each part of the screen can be jumped to. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h3 id={id}>{title}</h3>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">{children}</CardContent>
      </Card>
    </section>
  )
}
