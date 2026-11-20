/** The filters every setting list offers, kept in the URL query (spec §4.5). */
export interface NameStatusFilter {
  q?: string
  status?: "enabled" | "disabled"
}

export function parseNameStatusFilter(params: URLSearchParams): NameStatusFilter {
  const filter: NameStatusFilter = {}
  const q = params.get("q")
  if (q) filter.q = q
  const status = params.get("status")
  if (status === "enabled" || status === "disabled") filter.status = status
  return filter
}

export function matchesNameStatus(
  entry: { name: string; enabled: boolean },
  filter: NameStatusFilter,
): boolean {
  return (
    (!filter.q || entry.name.toLowerCase().includes(filter.q.toLowerCase())) &&
    (!filter.status || entry.enabled === (filter.status === "enabled"))
  )
}

/** Enabled entries out of all, for list summaries. */
export function countEnabled(entries: readonly { data: { enabled: boolean } }[]) {
  return { enabled: entries.filter((e) => e.data.enabled).length, total: entries.length }
}
