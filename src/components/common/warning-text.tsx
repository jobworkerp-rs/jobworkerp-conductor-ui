import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Amber dark enough for text contrast on the light background (WCAG AA). */
export const WARNING_TEXT_CLASS = "text-amber-700 dark:text-amber-500"

/** A caution that does not block the action, such as a setting that may surprise. */
export function WarningText({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn(WARNING_TEXT_CLASS, className)}>{children}</p>
}
