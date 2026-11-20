import { useId, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { CodeEditor } from "@/components/common/code-editor"
import { FormField } from "@/components/common/form-field"
import { NativeSelect } from "@/components/common/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  useChannels,
  useExecutionTargetContext,
  useTargetServer,
} from "@/hooks/use-execution-target"
import { ARGS_MAX_KB, formatArgs, validateArgs } from "@/lib/execution-target/args"
import { WORKFLOW_TEMPLATE } from "@/lib/execution-target/definition"
import { fieldErrorText, type FieldError } from "@/lib/field-error"
import {
  runsWorkflow,
  type ConfigKind,
  type ExecutionTargetForm,
  type TargetMethod,
} from "@/lib/execution-target/form"
import { defaultManagedWorkerName } from "@/lib/execution-target/managed-worker"
import { SLACK_WORKFLOW_URL_MAX, type ExecutionTargetErrors } from "@/lib/execution-target/validate"
import { cn } from "@/lib/utils"
import { ManagedWorkerNameField, WorkerFields } from "./worker-fields"

const METHODS: TargetMethod[] = ["worker", "workflowUrl", "workflowInline"]

interface ExecutionTargetFieldProps {
  kind: ConfigKind
  /** The setting's name, for the default name of the worker storing a definition. */
  settingName: string
  value: ExecutionTargetForm
  onChange: (next: ExecutionTargetForm) => void
  /** Validation errors, shown once the user has tried to save. */
  errors?: ExecutionTargetErrors
  /** jobworkerp's answer when the worker storing the definition could not be saved. */
  definitionServerError?: string
  /** The edit page found no worker for the stored definition. */
  managedWorkerMissing?: boolean
}

/**
 * What runs, where, and with which arguments: shared by schedules, Slack
 * events and result handlers (spec §4.6).
 */
export function ExecutionTargetField({
  kind,
  settingName,
  value,
  onChange,
  errors = {},
  definitionServerError,
  managedWorkerMissing = false,
}: ExecutionTargetFieldProps) {
  const { t } = useTranslation()
  const ids = useId()
  const context = useExecutionTargetContext(kind, value)
  const { servers, link } = useTargetServer(value.serverId)
  const channels = useChannels(value.serverId)

  const set = (patch: Partial<ExecutionTargetForm>) => onChange({ ...value, ...patch })
  const message = (error: FieldError | undefined) => error && fieldErrorText(t, error)

  const selectMethod = (method: TargetMethod) =>
    set({
      method,
      // The default is filled in once and never follows later renames (spec §4.6.4).
      managedWorkerName:
        method === "workflowInline" && value.managedWorkerName === ""
          ? defaultManagedWorkerName(kind, settingName)
          : value.managedWorkerName,
    })

  const argsWarnings = useMemo(
    () =>
      validateArgs(value.args, {
        kind,
        method: value.method,
        workflowRunner: context.workflowRunner,
      }).warnings,
    [value.args, value.method, kind, context.workflowRunner],
  )
  const definitionError = errors.definition
  const editorError = useMemo(
    () =>
      definitionError?.line !== undefined
        ? {
            line: definitionError.line,
            column: definitionError.column,
            message: fieldErrorText(t, definitionError),
          }
        : undefined,
    [definitionError, t],
  )
  const channelList = `${ids}-channels`

  return (
    <fieldset className="grid gap-6">
      <legend className="mb-2 text-lg font-semibold">{t("executionTarget.legend")}</legend>

      <FormField
        label={t("executionTarget.server")}
        required
        help={t("executionTarget.serverHelp")}
        error={message(errors.serverId)}
      >
        {(control) => (
          <NativeSelect
            {...control}
            className="max-w-md"
            value={value.serverId}
            onChange={(e) => set({ serverId: e.target.value })}
          >
            <option value="">{t("executionTarget.serverPlaceholder")}</option>
            {(servers.data ?? []).map((server) => (
              <option key={server.id} value={server.id}>
                {server.data.enabled
                  ? server.data.name
                  : t("executionTarget.serverDisabled", { name: server.data.name })}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("executionTarget.method")}</legend>
        <div className="grid gap-2 md:grid-cols-3">
          {METHODS.map((method) => {
            const disabled = method === "workflowInline" && !context.inlineAvailable
            const descriptionId = `${ids}-${method}-description`
            return (
              <label
                key={method}
                className={cn(
                  "hover:bg-accent/50 flex cursor-pointer gap-3 rounded-md border p-3 text-sm",
                  value.method === method && "border-primary ring-primary/30 ring-2",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="radio"
                  name={`${ids}-method`}
                  className="mt-1"
                  checked={value.method === method}
                  disabled={disabled}
                  aria-describedby={descriptionId}
                  onChange={() => selectMethod(method)}
                />
                <span className="grid gap-1">
                  <span className="font-medium">
                    {t(`executionTarget.methods.${method}.label`)}
                  </span>
                  <span id={descriptionId} className="text-muted-foreground">
                    {disabled
                      ? t("executionTarget.inlineUnavailableReason")
                      : t(`executionTarget.methods.${method}.description`)}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
        {errors.method && <p className="text-destructive text-sm">{message(errors.method)}</p>}
      </fieldset>

      {value.method === "worker" && (
        <WorkerFields
          value={value}
          set={set}
          error={message(errors.workerName)}
          adminUi={link?.adminUiUrl}
        />
      )}

      {value.method === "workflowUrl" && (
        <FormField
          label={t("executionTarget.workflowUrl")}
          required
          help={
            kind === "slackHandler"
              ? t("executionTarget.workflowUrlHelpSlack", { max: SLACK_WORKFLOW_URL_MAX })
              : t("executionTarget.workflowUrlHelp")
          }
          error={message(errors.workflowUrl)}
        >
          {(control) => (
            <Input
              {...control}
              className="font-mono"
              value={value.workflowUrl}
              onChange={(e) => set({ workflowUrl: e.target.value })}
              spellCheck={false}
            />
          )}
        </FormField>
      )}

      {value.method === "workflowInline" && (
        <>
          <FormField
            label={t("executionTarget.definition.label")}
            required
            help={t("executionTarget.definitionHelp")}
            error={message(errors.definition) ?? definitionServerError}
            warning={managedWorkerMissing ? t("executionTarget.managedWorkerMissing") : undefined}
          >
            {(control, { labelId }) => (
              <div className="grid gap-2">
                <CodeEditor
                  value={value.definition}
                  onChange={(definition) => set({ definition })}
                  language="yaml"
                  labelId={labelId}
                  describedBy={control["aria-describedby"]}
                  invalid={control["aria-invalid"]}
                  error={editorError}
                />
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    // Never overwrite what the user has written.
                    disabled={value.definition.trim() !== ""}
                    onClick={() => set({ definition: WORKFLOW_TEMPLATE })}
                  >
                    {t("executionTarget.insertTemplate")}
                  </Button>
                </div>
              </div>
            )}
          </FormField>
          <ManagedWorkerNameField
            value={value}
            set={set}
            error={message(errors.managedWorkerName)}
            adminUi={link?.adminUiUrl}
          />
        </>
      )}

      {value.method !== "worker" && (
        <FormField
          label={t("executionTarget.channel")}
          help={
            value.method === "workflowInline"
              ? t("executionTarget.channelHelpInline")
              : t("executionTarget.channelHelp")
          }
        >
          {(control) => (
            <>
              <Input
                {...control}
                className="max-w-md font-mono"
                list={channelList}
                value={value.channel}
                onChange={(e) => set({ channel: e.target.value })}
                autoComplete="off"
              />
              <datalist id={channelList}>
                {(channels.data ?? []).map((channel) => (
                  <option key={channel} value={channel} />
                ))}
              </datalist>
            </>
          )}
        </FormField>
      )}

      <FormField
        label={t("executionTarget.args.label")}
        help={t("executionTarget.argsHelp", { kb: ARGS_MAX_KB })}
        error={message(errors.args)}
        warning={
          argsWarnings.length > 0
            ? t("executionTarget.argsReserved", { names: argsWarnings.join(", ") })
            : undefined
        }
      >
        {(control) => (
          <div className="grid gap-2">
            <Textarea
              {...control}
              className="min-h-32 font-mono"
              value={value.args}
              onChange={(e) => set({ args: e.target.value })}
              spellCheck={false}
            />
            <div className="flex flex-wrap items-start gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set({ args: formatArgs(value.args) })}
              >
                {t("executionTarget.formatArgs")}
              </Button>
              <details className="text-muted-foreground text-sm">
                <summary className="cursor-pointer">{t("executionTarget.shapeTitle")}</summary>
                <p>{t(`executionTarget.shape.${kind}`)}</p>
                {runsWorkflow(value.method, context.workflowRunner) && (
                  <p>{t("executionTarget.shape.workflow")}</p>
                )}
              </details>
            </div>
          </div>
        )}
      </FormField>
    </fieldset>
  )
}
