import { useEffect } from 'react'
import { useEditor } from '@/editor/EditorContext'
import { nudgeEntities, removeEntities } from '@/editor/commands'
import { removeDrawings } from '@/editor/moreCommands'
import { exportJson, parseDocument, pickJsonFile } from '@/editor/persistence'
import { giveBallTo, removeSegment } from '@/editor/segmentCommands'
import { useUiStore } from '@/editor/uiStore'
import { compile } from '@/engine/compile'
import { KEYMAP } from './keymap'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Focused native controls own Space/Enter (a11y): do not also toggle global playback. */
function isActivatableControl(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true
  const role = el.getAttribute('role')
  return role === 'button' || role === 'slider' || role === 'menuitem'
}

/** Global editor shortcuts — bindings live in keymap.ts (ADR-0006 D7, amended). Gesture-cancel Esc lives in PitchStage. */
export function useEditorKeyboard(): void {
  const core = useEditor()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState()
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

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
      const mod = e.ctrlKey || e.metaKey

      if (mod) {
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
          case 'a': {
            e.preventDefault()
            const doc = core.getDocument()
            ui.select([...doc.players.map((p) => p.id), doc.ball.id])
            return
          }
          case 's':
            e.preventDefault()
            exportJson(core.getDocument())
            return
          case 'o':
            e.preventDefault()
            void pickJsonFile().then((json) => {
              if (!json) return
              try {
                core.load(parseDocument(json))
                ui.clearSelection()
                ui.setPlayhead(0)
              } catch {
                /* ignored: the menu path reports errors */
              }
            })
            return
          default:
            return
        }
      }
      if (e.altKey) return // Alt is reserved for Alt+drag (path) — never a key command

      const duration = () => compile(core.getDocument()).duration
      const T = KEYMAP.tools
      const P = KEYMAP.playback

      switch (key) {
        case P.toggle.key: {
          if (isActivatableControl(e.target)) return
          e.preventDefault()
          if (ui.playback.playing) ui.setPlaying(false)
          else {
            if (ui.playback.t >= duration() - 1e-6) ui.setPlayhead(0)
            ui.setPlaying(true)
          }
          return
        }
        case P.home.key:
        case P.restart.key:
          e.preventDefault()
          ui.setPlayhead(0)
          return
        case P.end.key:
          e.preventDefault()
          ui.setPlaying(false)
          ui.setPlayhead(duration())
          return
        case P.stepBack.key:
          e.preventDefault()
          ui.setPlaying(false)
          ui.setPlayhead(ui.playback.t - (e.shiftKey ? 1 : 0.1))
          return
        case P.stepFwd.key:
          e.preventDefault()
          ui.setPlaying(false)
          ui.setPlayhead(Math.min(duration(), ui.playback.t + (e.shiftKey ? 1 : 0.1)))
          return
        case P.loop.key:
          ui.setLoop(!ui.playback.loop)
          return
        case P.tracks.key:
          ui.setTimelineExpanded(!ui.timelineExpanded)
          return

        case T.select.key:
          ui.setTool('select')
          return
        case T.addPlayer.key:
          ui.setTool('add-player')
          return
        case T.path.key:
          ui.setTool(ui.tool === 'path' ? 'select' : 'path')
          return
        case T.arrow.key:
          ui.setTool(ui.tool === 'arrow' ? 'select' : 'arrow')
          return
        case T.zone.key:
          ui.setTool(ui.tool === 'zone' ? 'select' : 'zone')
          return
        case T.text.key:
          ui.setTool(ui.tool === 'text' ? 'select' : 'text')
          return
        case T.giveBall.key: {
          const doc = core.getDocument()
          const pid = ui.selection.find((id) => id !== doc.ball.id)
          if (pid) giveBallTo(core, pid)
          return
        }
        case T.team1.key:
        case T.team2.key: {
          const doc = core.getDocument()
          const team = doc.teams[key === T.team1.key ? 0 : 1]
          if (team) {
            ui.setActiveTeam(team.id)
            ui.setTool('add-player')
          }
          return
        }

        case 'Escape':
          if (ui.drag || ui.pathDraft || ui.waypointDrag || ui.drawDraft) return // stage handles cancel
          if (ui.textEdit) return
          if (ui.selectedDrawingIds.length) ui.selectDrawings([])
          else if (ui.selectedSegmentId) ui.selectSegment(null)
          else if (ui.tool !== 'select') ui.setTool('select')
          else ui.clearSelection()
          return
        case 'Delete':
        case 'Backspace': {
          if (ui.selectedDrawingIds.length) {
            e.preventDefault()
            removeDrawings(core, ui.selectedDrawingIds)
            ui.selectDrawings([])
            return
          }
          if (ui.selectedSegmentId) {
            e.preventDefault()
            removeSegment(core, ui.selectedSegmentId)
            ui.selectSegment(null)
            return
          }
          if (ui.selection.length) {
            e.preventDefault()
            const doc = core.getDocument()
            removeEntities(
              core,
              ui.selection.filter((id) => id !== doc.ball.id),
            )
            ui.clearSelection()
          }
          return
        }
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          if (!ui.selection.length) return
          e.preventDefault()
          const step = e.shiftKey ? 2 : 0.5
          const d =
            key === 'ArrowLeft'
              ? { x: -step, y: 0 }
              : key === 'ArrowRight'
                ? { x: step, y: 0 }
                : key === 'ArrowUp'
                  ? { x: 0, y: -step }
                  : { x: 0, y: step }
          nudgeEntities(core, ui.selection, d)
          return
        }
        case 'Tab': {
          const active = document.activeElement
          if (!(active instanceof SVGSVGElement)) return
          e.preventDefault()
          const doc = core.getDocument()
          const ids = [...doc.players.map((p) => p.id), doc.ball.id]
          if (!ids.length) return
          const cur = ui.selection[0]
          const idx = cur ? ids.indexOf(cur) : -1
          const next = ids[(idx + (e.shiftKey ? -1 : 1) + ids.length) % ids.length]!
          ui.select([next])
          return
        }
        default:
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [core])
}
