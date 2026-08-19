import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createEmptyDocument } from '@/domain'
import { EditorCore, type EditorSnapshot } from './editorCore'
import { ensureDefaultTeams } from './commands'
import { loadAutosave, startAutosave } from './persistence'

const EditorCtx = createContext<EditorCore | null>(null)

export function EditorProvider({ core, children }: { core?: EditorCore; children: ReactNode }) {
  const value = useMemo(() => {
    const c =
      core ?? new EditorCore(loadAutosave() ?? createEmptyDocument({ title: 'Untitled tactic' }))
    ensureDefaultTeams(c)
    return c
  }, [core])
  useEffect(() => (core ? undefined : startAutosave(value)), [core, value])
  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>
}

export function useEditor(): EditorCore {
  const core = useContext(EditorCtx)
  if (!core) throw new Error('useEditor outside EditorProvider')
  return core
}

export function useEditorSnapshot(): EditorSnapshot {
  const core = useEditor()
  return useSyncExternalStore(
    (cb) => core.subscribe(cb),
    () => core.getSnapshot(),
    () => core.getSnapshot(),
  )
}
