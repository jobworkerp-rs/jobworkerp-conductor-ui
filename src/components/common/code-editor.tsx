import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { json } from "@codemirror/lang-json"
import { yaml } from "@codemirror/lang-yaml"
import { bracketMatching, indentOnInput } from "@codemirror/language"
import { setDiagnostics } from "@codemirror/lint"
import { Compartment, EditorState } from "@codemirror/state"
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view"
import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export interface CodeEditorError {
  /** 1-based. */
  line: number
  column?: number
  message: string
}

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: "json" | "yaml"
  /** A code editor is not a labelable element, so it is named by the label's id. */
  labelId: string
  describedBy?: string
  invalid?: boolean
  error?: CodeEditorError
  className?: string
}

// Colours come from the theme tokens so the editor follows light and dark mode.
const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "inherit", fontSize: "0.875rem" },
  ".cm-content": {
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    caretColor: "currentColor",
  },
  ".cm-cursor": { borderLeftColor: "currentColor" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklab, var(--accent) 60%, transparent)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { minHeight: "12rem", maxHeight: "32rem" },
})

function diagnostics(state: EditorState, error: CodeEditorError | undefined) {
  if (!error) return setDiagnostics(state, [])
  const line = state.doc.line(Math.min(Math.max(error.line, 1), state.doc.lines))
  const from = Math.min(line.from + Math.max((error.column ?? 1) - 1, 0), line.to)
  return setDiagnostics(state, [
    { from, to: Math.max(from, line.to), severity: "error", message: error.message },
  ])
}

/** A small CodeMirror 6 editor: line numbers, history, and an error marker. */
export function CodeEditor({
  value,
  onChange,
  language,
  labelId,
  describedBy,
  invalid,
  error,
  className,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const attributes = useRef(new Compartment())
  // The text last reported through onChange, so echoing it back as `value`
  // does not cost a comparison with the whole document.
  const emitted = useRef(value)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          indentOnInput(),
          bracketMatching(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          language === "json" ? json() : yaml(),
          theme,
          attributes.current.of([]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            emitted.current = update.state.doc.toString()
            onChangeRef.current(emitted.current)
          }),
        ],
      }),
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
    // The editor is created once per language; later values are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // Keep the document in step with outside changes (template, reset) without
  // disturbing the cursor while the user types.
  useEffect(() => {
    const editor = view.current
    if (!editor || value === emitted.current) return
    emitted.current = value
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    const editor = view.current
    if (!editor) return
    const attrs: Record<string, string> = { "aria-labelledby": labelId, "aria-multiline": "true" }
    if (describedBy) attrs["aria-describedby"] = describedBy
    if (invalid) attrs["aria-invalid"] = "true"
    editor.dispatch({
      effects: attributes.current.reconfigure(EditorView.contentAttributes.of(attrs)),
    })
  }, [labelId, describedBy, invalid])

  useEffect(() => {
    const editor = view.current
    if (editor) editor.dispatch(diagnostics(editor.state, error))
  }, [error])

  return (
    <div
      ref={host}
      className={cn(
        "border-input dark:bg-input/30 overflow-hidden rounded-md border shadow-xs",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        invalid && "border-destructive",
        className,
      )}
    />
  )
}
