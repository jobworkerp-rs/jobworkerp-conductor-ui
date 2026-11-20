import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import type { Reachability } from "@/lib/reachability"
import { cn } from "@/lib/utils"

const DOT: Record<Exclude<Reachability, "notConfigured">, string> = {
  reachable: "bg-emerald-500",
  unreachable: "bg-destructive",
  checking: "bg-muted-foreground",
}

export function ReachabilityBadge({ reachability }: { reachability: Reachability }) {
  const { t } = useTranslation()
  const label = t(`servers.reach.${reachability}`)
  if (reachability === "notConfigured") {
    return <span className="text-muted-foreground text-sm">{label}</span>
  }
  return (
    <Badge variant={reachability === "unreachable" ? "destructive" : "outline"} className="gap-1.5">
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[reachability])} />
      {label}
    </Badge>
  )
}
