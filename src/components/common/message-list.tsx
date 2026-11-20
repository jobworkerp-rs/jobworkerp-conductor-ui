import { cn } from "@/lib/utils"

/** Messages from conductor, one per item, such as the entries an import or export could not take. */
export function MessageList({
  messages,
  className,
}: {
  messages: readonly string[]
  className?: string
}) {
  return (
    <ul className={cn("list-disc pl-5", className)}>
      {messages.map((message, i) => (
        // The same text may come back for more than one entry.
        <li key={`${i}:${message}`}>{message}</li>
      ))}
    </ul>
  )
}
