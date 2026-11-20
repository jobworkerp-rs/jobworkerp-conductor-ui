/**
 * The plain C ABI shared by the modules built from wasm/ (no bindings
 * generator): strings are copied into memory obtained from `alloc`, and a
 * failing call returns -1 and leaves its message at
 * `last_error_ptr`/`last_error_len`.
 */
interface CoreExports {
  memory: WebAssembly.Memory
  alloc(len: number): number
  dealloc(ptr: number, len: number): void
  last_error_ptr(): number
  last_error_len(): number
  /** Every module validates its one kind of input: 0, or -1 with a message. */
  check(ptr: number, len: number): number
}

export interface CAbi<E> {
  wasm: CoreExports & E
  /** Copies strings into the module's memory for the duration of one call, as [ptr, len, ...]. */
  withStrings<T>(texts: string[], call: (args: number[]) => T): T
  /** The message of the last failure. */
  lastError(): string
  /** Undefined when the module accepts `text`; otherwise its message. */
  check(text: string): string | undefined
  /** `check` with another exported validator of the same shape. */
  checkWith(validate: (ptr: number, len: number) => number, text: string): string | undefined
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

async function instantiate(source: BufferSource | Response): Promise<WebAssembly.Instance> {
  // No imports: wasm-unbind (wasm/unbind) guarantees the modules need none.
  if (!(source instanceof Response)) return (await WebAssembly.instantiate(source, {})).instance
  // Streaming needs the application/wasm content type; fall back otherwise.
  if (source.headers.get("content-type")?.startsWith("application/wasm")) {
    return (await WebAssembly.instantiateStreaming(source, {})).instance
  }
  return (await WebAssembly.instantiate(await source.arrayBuffer(), {})).instance
}

/** Accepts the module's bytes, or a fetch response to compile while it downloads. */
export async function instantiateCAbi<E>(source: BufferSource | Response): Promise<CAbi<E>> {
  const wasm = (await instantiate(source)).exports as unknown as CoreExports & E
  const abi: CAbi<E> = {
    wasm,
    withStrings(texts, call) {
      const buffers: { ptr: number; len: number }[] = []
      try {
        // Inside the try, so a failure on a later string still frees the earlier ones.
        for (const text of texts) {
          const encoded = encoder.encode(text)
          const ptr = wasm.alloc(encoded.length)
          buffers.push({ ptr, len: encoded.length })
          new Uint8Array(wasm.memory.buffer, ptr, encoded.length).set(encoded)
        }
        return call(buffers.flatMap(({ ptr, len }) => [ptr, len]))
      } finally {
        for (const { ptr, len } of buffers) wasm.dealloc(ptr, len)
      }
    },
    lastError() {
      const bytes = new Uint8Array(wasm.memory.buffer, wasm.last_error_ptr(), wasm.last_error_len())
      return decoder.decode(bytes)
    },
    checkWith(validate, text) {
      const failed = abi.withStrings([text], ([ptr, len]) => validate(ptr, len)) < 0
      return failed ? abi.lastError() : undefined
    },
    check(text) {
      return abi.checkWith(wasm.check, text)
    },
  }
  return abi
}
