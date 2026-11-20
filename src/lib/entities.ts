/** A conductor configuration entry with its id unwrapped and its data known to be present. */
export interface Entity<D> {
  id: string
  data: D
}

interface Stored<D> {
  id?: { value: string } | undefined
  data?: D | undefined
}

/** Narrows FindList results once, so screens need no per-field checks. */
export function toEntities<D>(list: readonly Stored<D>[]): Entity<D>[] {
  return list.flatMap(({ id, data }) => (id && data ? [{ id: id.value, data }] : []))
}

export function findEntity<D>(
  entities: readonly Entity<D>[],
  id: string | undefined,
): Entity<D> | undefined {
  return id === undefined ? undefined : entities.find((entity) => entity.id === id)
}

/** id and name pairs, for the duplicate-name warning. */
export function toNamed(
  entities: readonly Entity<{ name: string }>[],
): { id: string; name: string }[] {
  return entities.map(({ id, data }) => ({ id, name: data.name }))
}
