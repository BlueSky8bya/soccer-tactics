import { useEffect, useState, useSyncExternalStore } from 'react'
import { attachAutosave, restoreCore } from '@/editor/autosave'
import { EditorProvider, VariantProvider } from '@/editor/EditorContext'
import { VariantSession } from '@/editor/variantSession'
import { AppShell } from '@/ui/AppShell'

export function App() {
  // A/B/C variants are session-only (PLAN-005 M5): independent in-memory cores, gone on refresh.
  // The board you are LOOKING AT is not — it is autosaved to one slot and comes back as A
  // (user 2026-08-22, superseding ADR-0009 "새로고침 = 완전 클린").
  const [session] = useState(() => new VariantSession(restoreCore() ?? undefined))
  const active = useSyncExternalStore(
    session.subscribe,
    () => session.activeId,
    () => session.activeId,
  )
  // Switching variants hands over a DIFFERENT core, so the slot follows the board on screen.
  const core = session.cores[active]!
  useEffect(() => attachAutosave(core), [core])
  return (
    <VariantProvider session={session}>
      {/* key remounts the editor subtree so no component keeps a stale core subscription */}
      <EditorProvider key={active} core={session.activeCore}>
        <AppShell />
      </EditorProvider>
    </VariantProvider>
  )
}
