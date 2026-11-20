/**
 * Fetches a module for `instantiateCAbi`, which compiles it while it
 * downloads where the server sends the wasm content type.
 */
export async function fetchWasm(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`could not load ${url}: HTTP ${response.status}`)
  return response
}
