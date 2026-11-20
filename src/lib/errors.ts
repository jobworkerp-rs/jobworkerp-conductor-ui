import { ClientError, Status } from "nice-grpc-common"

/**
 * - network: no response at all (server down, DNS, CORS rejection)
 * - http:    an HTTP reply that is not gRPC-Web (wrong URL, proxy error page)
 * - status:  a gRPC status returned by the server
 * - app:     a failure this UI detected itself (AppError)
 */
export type ErrorKind = "network" | "http" | "status" | "app" | "aborted" | "unknown"

export interface ClassifiedError {
  kind: ErrorKind
  /** i18n key of the user-facing message and the values it interpolates. */
  messageKey: string
  messageValues?: Record<string, string | number>
  code?: Status
  httpStatus?: number
  /** Raw detail for the collapsible "details" view; never translated. */
  serverMessage?: string
}

/** A failure the UI explains in its own words; the cause keeps the raw detail. */
export class AppError extends Error {
  constructor(
    readonly messageKey: string,
    readonly messageValues: Record<string, string | number> = {},
    cause?: unknown,
  ) {
    super(messageKey, { cause })
    this.name = "AppError"
  }
}

// nice-grpc-web reports failures of its fetch transport and non-gRPC HTTP
// replies as ClientErrors whose details carry these prefixes.
const TRANSPORT_ERROR_PREFIX = "Transport error:"
const HTTP_REPLY_PATTERN = /^Received HTTP (\d{3}) response/

function isAbortError(err: unknown): boolean {
  return (err instanceof Error || err instanceof DOMException) && err.name === "AbortError"
}

function statusMessageKey(code: Status): string {
  const name = Status[code]
  return name === undefined || code === Status.OK
    ? "errors.status.default"
    : `errors.status.${name.toLowerCase()}`
}

export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof AppError) {
    const classified: ClassifiedError = {
      kind: "app",
      messageKey: err.messageKey,
      messageValues: err.messageValues,
    }
    if (err.cause !== undefined) {
      const { serverMessage } = classifyError(err.cause)
      if (serverMessage !== undefined) classified.serverMessage = serverMessage
    }
    return classified
  }
  if (isAbortError(err)) {
    return { kind: "aborted", messageKey: "errors.aborted" }
  }
  if (err instanceof ClientError) {
    if (err.code === Status.UNKNOWN && err.details.startsWith(TRANSPORT_ERROR_PREFIX)) {
      return { kind: "network", messageKey: "errors.network", serverMessage: err.details }
    }
    const http = HTTP_REPLY_PATTERN.exec(err.details)
    if (http) {
      const httpStatus = Number(http[1])
      return {
        kind: "http",
        messageKey: "errors.http",
        messageValues: { status: httpStatus },
        httpStatus,
        serverMessage: err.details,
      }
    }
    return {
      kind: "status",
      code: err.code,
      messageKey: statusMessageKey(err.code),
      serverMessage: err.details,
    }
  }
  return {
    kind: "unknown",
    messageKey: "errors.unknown",
    serverMessage: err instanceof Error ? err.message : String(err),
  }
}
