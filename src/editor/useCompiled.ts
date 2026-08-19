import { useMemo } from 'react'
import { compile, type CompiledTimeline } from '@/engine/compile'
import { stateAt, type ResolvedState } from '@/engine/stateAt'
import { useEditorSnapshot } from './EditorContext'
import { useUiStore } from './uiStore'

/** Compiled timeline memoized by document revision (ADR-0003: never recompile per frame). */
export function useCompiled(): CompiledTimeline {
  const { doc, revision } = useEditorSnapshot()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => compile(doc), [revision])
}

/** Resolved entity state at the current playhead. */
export function useResolvedState(): ResolvedState {
  const { doc, revision } = useEditorSnapshot()
  const compiled = useCompiled()
  const t = useUiStore((s) => s.playback.t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => stateAt(compiled, doc, t), [compiled, revision, t])
}
