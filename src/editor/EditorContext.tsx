import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { createEmptyDocument } from '@/domain'
import { EditorCore, type EditorSnapshot } from './editorCore'
import { seedDefaultTeams } from './commands'

const EditorCtx = createContext<EditorCore | null>(null)

export function EditorProvider({ core, children }: { core?: EditorCore; children: ReactNode }) {
  const value = useMemo(() => {
    // Refresh = a clean pitch, no persistence (user decision 2026-08-20: lightweight site).
    const c =
      core ?? new EditorCore(seedDefaultTeams(createEmptyDocument({ title: '제목 없는 전술' })))
    if (c.getDocument().teams.length === 0) c.load(seedDefaultTeams(c.getDocument()))
    return c
  }, [core])
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
