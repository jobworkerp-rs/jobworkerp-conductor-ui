import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import type { NameStatusFilter } from "@/lib/list-filter"
import { NativeSelect } from "./native-select"

/** The name search and status select every setting list offers. */
export function NameStatusFilters({
  filter,
  onChange,
}: {
  filter: NameStatusFilter
  onChange: (key: keyof NameStatusFilter, value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Input
        className="max-w-xs"
        type="search"
        aria-label={t("common.filters.search")}
        placeholder={t("common.filters.search")}
        value={filter.q ?? ""}
        onChange={(e) => onChange("q", e.target.value)}
      />
      <NativeSelect
        className="w-40"
        aria-label={t("common.filters.status")}
        value={filter.status ?? ""}
        onChange={(e) => onChange("status", e.target.value)}
      >
        <option value="">{t("common.filters.allStatuses")}</option>
        <option value="enabled">{t("common.enabled")}</option>
        <option value="disabled">{t("common.disabled")}</option>
      </NativeSelect>
    </>
  )
}
