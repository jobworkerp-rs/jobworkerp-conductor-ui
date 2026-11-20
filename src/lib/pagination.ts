export const DEFAULT_PAGE_SIZE = 20
/** The URL query parameter lists keep their page in. */
export const PAGE_PARAM = "page"

export interface Page<T> {
  items: T[]
  /** 1-based, clamped to the existing pages. */
  page: number
  totalPages: number
  total: number
  /** 1-based index of the first and last item shown; 0 when empty. */
  from: number
  to: number
  hasNext: boolean
}

/** Client-side paging of a fully fetched list (spec §4.3). */
export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Page<T> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, Math.floor(page)), totalPages)
  const start = (current - 1) * pageSize
  const slice = items.slice(start, start + pageSize)
  return {
    items: slice,
    page: current,
    totalPages,
    total,
    from: slice.length > 0 ? start + 1 : 0,
    to: start + slice.length,
    hasNext: current < totalPages,
  }
}

/** Reads the "page" URL query value; anything unusable means the first page. */
export function parsePageParam(value: string | null): number {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
}

/** Configuration lists are fetched whole; beyond this they may get slow (spec §4.3). */
export const LIST_SCALE_LIMIT = 1_000

export function exceedsListScale(count: number): boolean {
  return count > LIST_SCALE_LIMIT
}
