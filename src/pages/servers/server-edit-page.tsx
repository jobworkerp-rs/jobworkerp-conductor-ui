import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router"
import { QueryGate } from "@/components/common/query-gate"
import { PageHeader } from "@/components/layout/page-header"
import { useServer, useConfigActions } from "@/hooks/use-config"
import { useNotify } from "@/hooks/use-notify"
import { toNamed } from "@/lib/entities"
import { nowSeconds } from "@/lib/format"
import {
  SERVER_FORM_DEFAULTS,
  toServerData,
  toServerForm,
  type ServerFormValues,
} from "@/lib/servers/form"
import { ServerForm } from "./server-form"

/** `/servers/new` and `/servers/:id/edit`. */
export function ServerEditPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const { query, server: current } = useServer(id)
  const actions = useConfigActions("servers")

  const existing = toNamed(query.data ?? [])

  const submit = async (values: ServerFormValues) => {
    try {
      let savedId: string
      if (current) {
        await actions.update(current.id, toServerData(values, nowSeconds(), current.data.createdAt))
        savedId = current.id
      } else {
        savedId = await actions.create(toServerData(values, nowSeconds()))
      }
      notify.success(
        current ? t("servers.form.saved") : t("servers.form.created"),
        values.name.trim(),
      )
      navigate(`/servers/${savedId}`)
    } catch (err) {
      // Stay on the form so the input can be corrected and saved again.
      notify.error(err)
    }
  }

  return (
    <QueryGate
      query={query}
      notFoundMessage={id !== undefined && !current && t("servers.notFound", { id })}
    >
      {() => (
        <div className="space-y-6">
          <PageHeader
            title={current ? t("servers.form.editTitle") : t("servers.form.createTitle")}
            description={
              current
                ? t("servers.form.editDescription", { name: current.data.name })
                : t("servers.form.createDescription")
            }
          />
          <ServerForm
            // Background refetches must not reset what the user is typing.
            key={id ?? "new"}
            initial={current ? toServerForm(current.data) : SERVER_FORM_DEFAULTS}
            existing={existing}
            selfId={id}
            onSubmit={submit}
            onCancel={() => navigate(current ? `/servers/${current.id}` : "/servers")}
          />
        </div>
      )}
    </QueryGate>
  )
}
