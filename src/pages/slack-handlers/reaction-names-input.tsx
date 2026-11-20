import { X } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addReactionNames } from "@/lib/slack/form"

/** Reaction names as removable tags; Enter or a comma adds what was typed. */
export function ReactionNamesInput({
  value,
  onChange,
  error,
}: {
  value: string[]
  onChange: (names: string[]) => void
  error?: string
}) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState("")
  const commit = (text: string) => {
    onChange(addReactionNames(value, text))
    setTyped("")
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // Enter adds a name instead of submitting the form.
      event.preventDefault()
      commit(typed)
    }
  }
  return (
    <FormField
      label={t("slackHandlers.form.reactionNames")}
      help={t("slackHandlers.form.reactionNamesHelp")}
      error={error}
    >
      {(control) => (
        <div className="grid gap-2">
          {value.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {value.map((name) => (
                <li key={name}>
                  <Badge variant="secondary" className="gap-1 pr-1 font-mono">
                    {name}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      aria-label={t("slackHandlers.form.removeReaction", { name })}
                      onClick={() => onChange(value.filter((other) => other !== name))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <Input
            {...control}
            className="max-w-md font-mono"
            value={typed}
            onChange={(e) => {
              // A comma ends a name, as Enter does.
              if (e.target.value.includes(",")) commit(e.target.value)
              else setTyped(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => typed.trim() !== "" && commit(typed)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
    </FormField>
  )
}
