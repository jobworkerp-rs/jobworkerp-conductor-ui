import { toEpochSeconds } from "@/lib/format"
import type { JobworkerpServerData } from "@/lib/grpc/jobworkerp_conductor/data/jobworkerp_server"
import type { FieldError } from "@/lib/field-error"
import {
  compactErrors,
  descriptionFieldError,
  nameFieldError,
  requiredFieldError,
} from "@/lib/validation"

const MAX_PORT = 65_535

export interface ServerFormValues {
  name: string
  host: string
  port: string
  sslEnabled: boolean
  description: string
  enabled: boolean
}

export const SERVER_FORM_DEFAULTS: ServerFormValues = {
  name: "",
  host: "",
  port: "9000",
  sslEnabled: false,
  description: "",
  enabled: true,
}

export type ServerFormErrors = Partial<Record<keyof ServerFormValues, FieldError>>

/**
 * conductor builds `scheme://host:port` from the stored host, so the host must
 * survive URL parsing unchanged: a DNS name, an IPv4 address, or a bracketed
 * IPv6 address. The WHATWG parser here matches the Rust url crate conductor
 * uses.
 */
export function isValidHost(host: string): boolean {
  if (host === "" || /[\s/@:]/.test(host.replace(/^\[[^\]]*\]$/, ""))) return false
  try {
    return new URL(`http://${host}`).hostname === host.toLowerCase()
  } catch {
    return false
  }
}

function isValidPort(port: string): boolean {
  if (!/^\d{1,5}$/.test(port)) return false
  const value = Number(port)
  return value >= 1 && value <= MAX_PORT
}

export function validateServerForm(values: ServerFormValues): ServerFormErrors {
  const host = values.host.trim()
  const port = values.port.trim()
  return compactErrors({
    name: nameFieldError(values.name),
    host:
      requiredFieldError(host) ??
      (isValidHost(host) ? undefined : { key: "servers.form.errors.invalidHost" }),
    port:
      requiredFieldError(port) ??
      (isValidPort(port) ? undefined : { key: "servers.form.errors.portRange" }),
    description: descriptionFieldError(values.description),
  })
}

/**
 * conductor stores the timestamps the client sends (spec §4.3), so the UI
 * stamps them; an update keeps the original creation time.
 */
export function toServerData(
  values: ServerFormValues,
  nowSeconds: number,
  createdAt?: string,
): JobworkerpServerData {
  const now = toEpochSeconds(nowSeconds)
  const description = values.description.trim()
  return {
    name: values.name.trim(),
    host: values.host.trim(),
    port: String(Number(values.port)),
    sslEnabled: values.sslEnabled,
    description: description === "" ? undefined : description,
    enabled: values.enabled,
    createdAt: createdAt ?? now,
    updatedAt: now,
  }
}

export function toServerForm(data: JobworkerpServerData): ServerFormValues {
  return {
    name: data.name,
    host: data.host,
    port: data.port,
    sslEnabled: data.sslEnabled,
    description: data.description ?? "",
    enabled: data.enabled,
  }
}

/** The address conductor itself connects to (not necessarily reachable from the browser). */
export function serverEndpoint(
  data: Pick<JobworkerpServerData, "host" | "port" | "sslEnabled">,
): string {
  return `${data.sslEnabled ? "https" : "http"}://${data.host}:${data.port}`
}
