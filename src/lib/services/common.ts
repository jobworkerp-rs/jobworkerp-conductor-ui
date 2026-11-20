import { ClientError, Status } from "nice-grpc-common"

export async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of stream) items.push(item)
  return items
}

/** Raised for entities that disappeared, so callers see the same error as a server NOT_FOUND. */
export function notFound(path: string, what: string): ClientError {
  return new ClientError(path, Status.NOT_FOUND, `${what} not found`)
}
