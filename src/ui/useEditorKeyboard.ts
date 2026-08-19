import { useEffect, useRef } from 'react'
import { useEditor } from '@/editor/EditorContext'
import { removeEntities } from '@/editor/commands'
import { removeStepSegment, setSegmentStep } from '@/editor/stepCommands'
import { useUiStore } from '@/editor/uiStore'
import { compile } from '@/engine/compile'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

/** Focused native controls own Space/Enter when reached BY KEYBOARD (a11y). */
function isActivatableControl(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (isTypingTarget(el)) return true
  const tag = el.tagName
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || tag === 'SELECT') return true
  const role = el.getAttribute('role')
  return role === 'button' || role === 'slider' || role === 'menuitem'
}

/**
 * Simple-mode shortcuts (ADR-0009): Space, Home, G, Delete, Esc, 1-0 (step), Ctrl+Z/Y/S/O, ?.
 * Gesture-cancel Esc lives in SimplePitch.
 */
export function useEditorKeyboard(): void {
  const core = useEditor()
  const inputModality = useRef<'pointer' | 'keyboard'>('pointer')
  useEffect(() => {
    const onPointer = () => {
      inputModality.current = 'pointer'
    }
    window.addEventListener('pointerdown', onPointer, true)
    return () => window.removeEventListener('pointerdown', onPointer, true)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key.startsWith('Arrow')) inputModality.current = 'keyboard'
      const ui = useUiStore.getState()
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const duration = () => compile(core.getDocument()).duration

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        ui.setShortcutsOpen(!ui.shortcutsOpen)
        return
      }
      if (ui.shortcutsOpen) {
        if (e.key === 'Escape') ui.setShortcutsOpen(false)
        return
      }
      if (isTypingTarget(e.target)) return

      if (e.ctrlKey || e.metaKey) {
        switch (key) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) core.redo()
            else core.undo()
            return
          case 'y':
            e.preventDefault()
            core.redo()
            return
          default:
            return
        }
      }

      switch (key) {
        case ' ': {
          if (isActivatableControl(e.target)) {
            if (inputModality.current === 'keyboard') return
            ;(e.target as HTMLElement).blur()
          }
          e.preventDefault()
          if (ui.playback.playing) ui.setPlaying(false)
          else {
            if (ui.playFrom !== null) ui.setPlayhead(ui.playFrom)
            else if (ui.playback.t >= duration() - 1e-6) ui.setPlayhead(0)
            ui.setPlaying(true)
          }
          return
        }
        case 'Home':
          e.preventDefault()
          ui.setPlayhead(0)
          return
        case 'g':
          ui.setLoop(!ui.playback.loop)
          return
        case 'Escape':
          if (ui.drag || ui.pathDraft) return // pitch handles gesture cancel
          if (ui.selectedSegmentId) ui.selectSegment(null)
          else ui.clearSelection()
          return
        case 'Delete':
        case 'Backspace': {
          if (ui.selectedSegmentId) {
            e.preventDefault()
            removeStepSegment(core, ui.selectedSegmentId)
            ui.selectSegment(null)
            return
          }
          if (ui.selection.length) {
            e.preventDefault()
            removeEntities(
              core,
              ui.selection.filter((id) => id !== core.getDocument().ball.id),
            )
            ui.clearSelection()
          }
          return
        }
        default: {
          // 1-9 → step select; with a movement selected → move it to that step.
          if (/^[1-9]$/.test(key)) {
            const n = Number(key)
            ui.setCurrentStep(n)
            if (ui.selectedSegmentId) setSegmentStep(core, ui.selectedSegmentId, n)
          }
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [core])
}
