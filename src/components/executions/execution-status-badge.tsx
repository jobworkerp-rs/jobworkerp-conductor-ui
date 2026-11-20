import { useTranslation } from "react-i18next"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { statusDisplay, statusNameKey, type StatusTone } from "@/lib/executions/status"
import type { ResolvedExecutionStatus } from "@/lib/grpc/jobworkerp_conductor/data/execution_ref"
import { cn } from "@/lib/utils"

// Text tones dark enough for contrast on the light background (WCAG AA).
const TONES: Record<StatusTone, string> = {
  yellow: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300",
  purple: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300",
  orange: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300",
  green: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300",
  red: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300",
  gray: "bg-muted text-muted-foreground border-border",
}

/**
 * An execution's status (spec §6.6). Outlined statuses say nothing about the
 * job's outcome; where conductor gave a reason (e.g. why it is unavailable),
 * it shows on hover and focus.
 */
export function ExecutionStatusBadge({
  status,
  detail,
}: {
  status: ResolvedExecutionStatus
  detail?: string
}) {
  const { t } = useTranslation()
  const display = statusDisplay(status)
  const Icon = display.icon
  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[display.tone],
        display.outline
          ? "border-current bg-transparent dark:bg-transparent"
          : "border-transparent",
      )}
      tabIndex={detail ? 0 : undefined}
    >
      <Icon aria-hidden className={cn("h-3.5 w-3.5", display.spinning && "animate-spin")} />
      {t(statusNameKey(display.name))}
    </span>
  )
  if (!detail) return badge
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-sm break-words">{detail}</TooltipContent>
    </Tooltip>
  )
}
