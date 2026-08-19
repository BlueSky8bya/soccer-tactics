import { useEffect, useRef, type RefObject } from 'react'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { addText, updateDrawingText } from '@/editor/moreCommands'
import { useUiStore } from '@/editor/uiStore'
import styles from './miniBar.module.css'
import { useSvgMetrics } from './useSvgMetrics'

/** Inline text input placed on the pitch for the text tool / editing a text annotation. */
export function TextEditOverlay({
  svgRef,
  pad,
}: {
  svgRef: RefObject<SVGSVGElement | null>
  pad: number
}) {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const edit = useUiStore((s) => s.textEdit)
  const setEdit = useUiStore((s) => s.setTextEdit)
  const metrics = useSvgMetrics(svgRef, pad, doc.pitch.length, doc.pitch.width)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (edit) setTimeout(() => input.current?.focus(), 0)
  }, [edit])

  if (!edit || !metrics) return null
  const left = metrics.ox + edit.at.x * metrics.scale
  const top = metrics.oy + edit.at.y * metrics.scale

  const commit = () => {
    const value = edit.value.trim()
    if (value) {
      if (edit.id) updateDrawingText(core, edit.id, value)
      else {
        const id = addText(core, edit.at, value)
        useUiStore.getState().selectDrawings([id])
      }
    }
    setEdit(null)
    useUiStore.getState().setTool('select')
  }

  return (
    <div className={styles.textEdit} style={{ left, top }}>
      <input
        ref={input}
        className={styles.textInput}
        value={edit.value}
        placeholder="텍스트 입력 후 Enter"
        onChange={(e) => setEdit({ ...edit, value: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            setEdit(null)
          }
        }}
        onBlur={commit}
      />
    </div>
  )
}
