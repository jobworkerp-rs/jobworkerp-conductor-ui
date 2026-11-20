import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { FormField } from "@/components/common/form-field"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { RustRegex } from "@/lib/slack/rust-regex"

/**
 * A regex input with a sample text tried by conductor's own rules. Without
 * the regex module there is nothing reliable to try with, so the sample is
 * not offered and conductor checks the pattern on save (spec §6.5).
 */
export function PatternField({
  label,
  help,
  value,
  onChange,
  regex,
  error,
}: {
  label: string
  help: string
  value: string
  onChange: (value: string) => void
  regex: RustRegex | undefined
  error?: string
}) {
  const { t } = useTranslation()
  const sampleId = useId()
  const [sample, setSample] = useState("")
  const result = useMemo(
    () => (regex && value !== "" && sample !== "" ? regex.isMatch(value, sample) : undefined),
    [regex, value, sample],
  )
  return (
    <FormField label={label} help={help} error={error}>
      {(control) => (
        <div className="grid gap-2">
          <Input
            {...control}
            className="font-mono"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {regex ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={sampleId} className="text-muted-foreground">
                {t("slackHandlers.form.sample")}
              </label>
              <Input
                id={sampleId}
                className="h-8 max-w-sm"
                value={sample}
                onChange={(e) => setSample(e.target.value)}
              />
              <span role="status">
                {result !== undefined && (
                  <Badge variant={result ? "default" : "secondary"}>
                    {result
                      ? t("slackHandlers.form.sampleResultMatch")
                      : t("slackHandlers.form.sampleResultNoMatch")}
                  </Badge>
                )}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("slackHandlers.form.regexUnavailable")}
            </p>
          )}
        </div>
      )}
    </FormField>
  )
}
