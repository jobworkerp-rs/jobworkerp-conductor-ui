import {
  countEnabled,
  matchesNameStatus,
  parseNameStatusFilter,
  type NameStatusFilter,
} from "@/lib/list-filter"
import type { ConfigEntity } from "@/lib/services/config"
import { eventKindOf, type SlackEventKind } from "./form"

type Handler = ConfigEntity<"slackHandlers">

export interface SlackSummary {
  total: number
  messages: number
  reactions: number
  enabled: number
  /** Distinct channels named by handlers; handlers for all channels are not counted. */
  channels: number
}

/** Channels named by handlers, sorted; handlers for all channels name none. */
export function channelsOf(handlers: readonly Handler[]): string[] {
  return [
    ...new Set(handlers.flatMap((h) => (h.data.slackChannelId ? [h.data.slackChannelId] : []))),
  ].sort()
}

export function summarizeSlackHandlers(handlers: readonly Handler[]): SlackSummary {
  const reactions = handlers.filter((h) => eventKindOf(h.data) === "reaction").length
  return {
    total: handlers.length,
    messages: handlers.length - reactions,
    reactions,
    enabled: countEnabled(handlers).enabled,
    channels: channelsOf(handlers).length,
  }
}

/** The common filters plus the Slack-specific kind and channel. */
export interface SlackFilter extends NameStatusFilter {
  kind?: SlackEventKind
  channel?: string
}

export function parseSlackFilter(params: URLSearchParams): SlackFilter {
  const filter: SlackFilter = parseNameStatusFilter(params)
  const kind = params.get("kind")
  if (kind === "message" || kind === "reaction") filter.kind = kind
  const channel = params.get("channel")
  if (channel) filter.channel = channel
  return filter
}

export function filterSlackHandlers(handlers: readonly Handler[], filter: SlackFilter): Handler[] {
  return handlers.filter(
    ({ data }) =>
      matchesNameStatus(data, filter) &&
      (!filter.kind || eventKindOf(data) === filter.kind) &&
      (!filter.channel || data.slackChannelId === filter.channel),
  )
}
