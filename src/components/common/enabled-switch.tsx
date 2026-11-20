import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Switch } from "@/components/ui/switch"
import { useNotify } from "@/hooks/use-notify"

interface EnabledSwitchProps {
  /** Name of the configuration, used in the accessible label. */
  name: string
  checked: boolean
  /** Performs the update; the switch stays disabled until it settles. */
  onToggle: (next: boolean) => Promise<void>
}

export function EnabledSwitch({ name, checked, onToggle }: EnabledSwitchProps) {
  const { t } = useTranslation()
  const notify = useNotify()
  const [pending, setPending] = useState(false)

  const handleChange = async (next: boolean) => {
    setPending(true)
    try {
      await onToggle(next)
    } catch (err) {
      notify.error(err)
    } finally {
      setPending(false)
    }
  }

  return (
    <Switch
      checked={checked}
      disabled={pending}
      onCheckedChange={handleChange}
      aria-label={t("common.toggleEnabled", { name })}
    />
  )
}
