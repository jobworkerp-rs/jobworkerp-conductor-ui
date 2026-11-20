export interface Named {
  id: string
  name: string
}

/**
 * Finds another entry already using `name`. Checked against the full list
 * rather than FindByName, whose server-side cache can lag behind renames and
 * deletes (conductor #84). Advisory only: the save itself reports
 * ALREADY_EXISTS.
 */
export function findDuplicateName<T extends Named>(
  name: string,
  entries: readonly T[],
  selfId?: string,
): T | undefined {
  if (name === "") return undefined
  return entries.find((entry) => entry.name === name && entry.id !== selfId)
}
