import { EditorProvider } from '@/editor/EditorContext'
import { AppShell } from '@/ui/AppShell'

export function App() {
  return (
    <EditorProvider>
      <AppShell />
    </EditorProvider>
  )
}
