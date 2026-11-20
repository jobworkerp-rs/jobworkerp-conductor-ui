import { useTranslation } from "react-i18next"
import type { SlackEventHandlerData } from "@/lib/grpc/jobworkerp_conductor/data/slack_event_handler"
import { REACTION_OPERATIONS, eventKindOf } from "@/lib/slack/form"

const OPERATION_KEY = new Map<number, string>(REACTION_OPERATIONS)

/** A handler's conditions in a few words, for the list. */
export function ConditionsSummary({ data }: { data: SlackEventHandlerData }) {
  const { t } = useTranslation()
  const parts = [
    data.slackChannelId
      ? t("slackHandlers.conditions.channel", { id: data.slackChannelId })
      : t("slackHandlers.conditions.allChannels"),
  ]
  if (eventKindOf(data) === "message") {
    if (data.messagePattern)
      parts.push(t("slackHandlers.conditions.pattern", { pattern: data.messagePattern }))
    if (data.mentionRequired) parts.push(t("slackHandlers.conditions.mention"))
  } else {
    const operation = OPERATION_KEY.get(data.reactionOperation)
    parts.push(
      (data.reactionNames
        ? t("slackHandlers.conditions.reactions", {
            names: data.reactionNames.replaceAll(",", ", "),
          })
        : t("slackHandlers.conditions.anyReaction")) +
        (operation ? ` (${t(`slackHandlers.conditions.operations.${operation}`)})` : ""),
    )
    if (data.reactionUserFilter) {
      parts.push(t("slackHandlers.conditions.userFilter", { filter: data.reactionUserFilter }))
    }
  }
  return <span className="text-sm">{parts.join(" · ")}</span>
}
