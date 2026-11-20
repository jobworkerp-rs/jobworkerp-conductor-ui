/** Screens of the jobworkerp admin-ui that this UI links to (its router paths). */
export type AdminUiTarget =
  | { page: "dashboard" | "workers" | "jobs" | "results" }
  | { page: "worker" | "job" | "result"; id: string }

const LIST_PATHS = { dashboard: "/", workers: "/workers", jobs: "/jobs", results: "/results" }
const ITEM_PATHS = { worker: "/workers", job: "/jobs", result: "/results" }

export function adminUiUrl(base: string, target: AdminUiTarget): string {
  const root = base.replace(/\/+$/, "")
  const path =
    "id" in target
      ? `${ITEM_PATHS[target.page]}/${encodeURIComponent(target.id)}`
      : LIST_PATHS[target.page]
  return `${root}${path}`
}
