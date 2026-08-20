import { useState, useSyncExternalStore } from 'react'
import { EditorProvider, VariantProvider } from '@/editor/EditorContext'
import { VariantSession } from '@/editor/variantSession'
import { AppShell } from '@/ui/AppShell'

export function App() {
  // Session-only A/B variants (PLAN-005 M5): two in-memory cores, gone on refresh.
  const [session] = useState(() => new VariantSession())
  const active = useSyncExternalStore(
    session.subscribe,
    () => session.activeId,
    () => session.activeId,
  )
  return (
    <VariantProvider session={session}>
      {/* key remounts the editor subtree so no component keeps a stale core subscription */}
      <EditorProvider key={active} core={session.activeCore}>
        <AppShell />
      </EditorProvider>
    </VariantProvider>
  )
}
