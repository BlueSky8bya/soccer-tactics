/**
 * UI state (not undoable): selection, tool, hover, drag, panels, snap toggle.
 * Playback state arrives in M2. See ADR-0005.
 */
import { create } from 'zustand'
import type { Id, Vec2 } from '@/domain/types'

export type Tool = 'select' | 'add-player' | 'add-ball' | 'path' | 'zone' | 'text' | 'arrow'

export interface PlaybackState {
  /** Playhead (seconds, tactical clock). */
  t: number
  playing: boolean
  speed: number
  loop: boolean
}

export interface PathDraft {
  /** Entity the path belongs to (player move, or ball travel). */
  entityId: Id
  /** Raw pointer trail in metres. */
  points: Vec2[]
}

export interface SnapGuide {
  kind: 'h' | 'v' | 'point'
  /** For h: y value; for v: x value; for point: x,y. */
  x?: number
  y?: number
  label?: string
}

export interface DragState {
  id: Id
  /** Grab offset (metres) so the token does not jump under the cursor. */
  grab: Vec2
  /** Where the pointer currently is (metres), before snapping. */
  raw: Vec2
  guides: SnapGuide[]
  snapped: boolean
}

export interface UiState {
  tool: Tool
  selection: Id[]
  hover: Id | null
  drag: DragState | null
  /** Team used when adding players via the add-player tool. */
  activeTeamId: Id | null
  snapEnabled: boolean
  inspectorPinned: boolean
  timelineExpanded: boolean
  reducedMotion: boolean
  playback: PlaybackState
  selectedSegmentId: Id | null
  /** Waypoint being dragged (segmentId + waypointId). */
  waypointDrag: { segmentId: Id; waypointId: Id } | null
  pathDraft: PathDraft | null
  shortcutsOpen: boolean
  onboardingDismissed: boolean
  helpOpen: boolean
  theme: 'light' | 'dark'
  selectedDrawingIds: Id[]
  drawDraft: { kind: 'rect' | 'ellipse' | 'arrow'; a: Vec2; b: Vec2 } | null
  textEdit: { at: Vec2; id?: Id; value: string } | null
  autoReactOpen: boolean

  setTool: (tool: Tool) => void
  select: (ids: Id[]) => void
  toggleSelect: (id: Id) => void
  clearSelection: () => void
  setHover: (id: Id | null) => void
  setDrag: (drag: DragState | null) => void
  setActiveTeam: (id: Id | null) => void
  setSnapEnabled: (on: boolean) => void
  setInspectorPinned: (on: boolean) => void
  setTimelineExpanded: (on: boolean) => void
  setReducedMotion: (on: boolean) => void
  setPlayhead: (t: number) => void
  setPlaying: (on: boolean) => void
  setSpeed: (speed: number) => void
  setLoop: (on: boolean) => void
  selectSegment: (id: Id | null) => void
  setWaypointDrag: (d: { segmentId: Id; waypointId: Id } | null) => void
  setPathDraft: (d: PathDraft | null) => void
  setShortcutsOpen: (on: boolean) => void
  dismissOnboarding: () => void
  setHelpOpen: (on: boolean) => void
  setTheme: (theme: 'light' | 'dark') => void
  selectDrawings: (ids: Id[]) => void
  setDrawDraft: (d: { kind: 'rect' | 'ellipse' | 'arrow'; a: Vec2; b: Vec2 } | null) => void
  setTextEdit: (t: { at: Vec2; id?: Id; value: string } | null) => void
  setAutoReactOpen: (on: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  tool: 'select',
  selection: [],
  hover: null,
  drag: null,
  activeTeamId: null,
  snapEnabled: true,
  inspectorPinned: false,
  timelineExpanded: false,
  reducedMotion: false,
  playback: { t: 0, playing: false, speed: 1, loop: false },
  selectedSegmentId: null,
  waypointDrag: null,
  pathDraft: null,
  shortcutsOpen: false,
  helpOpen: typeof localStorage === 'undefined' || localStorage.getItem('st.helpOpen') !== '0',
  theme:
    typeof localStorage !== 'undefined' && localStorage.getItem('st.theme') === 'dark'
      ? 'dark'
      : 'light',
  selectedDrawingIds: [],
  drawDraft: null,
  textEdit: null,
  autoReactOpen: false,
  onboardingDismissed:
    typeof localStorage !== 'undefined' && localStorage.getItem('st.onboardingDismissed') === '1',

  setTool: (tool) => set({ tool }),
  select: (ids) => set({ selection: ids, selectedSegmentId: null, selectedDrawingIds: [] }),
  toggleSelect: (id) =>
    set((s) => ({
      selection: s.selection.includes(id)
        ? s.selection.filter((x) => x !== id)
        : [...s.selection, id],
    })),
  clearSelection: () => set({ selection: [], selectedSegmentId: null, selectedDrawingIds: [] }),
  setHover: (hover) => set({ hover }),
  setDrag: (drag) => set({ drag }),
  setActiveTeam: (activeTeamId) => set({ activeTeamId }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setInspectorPinned: (inspectorPinned) => set({ inspectorPinned }),
  setTimelineExpanded: (timelineExpanded) => set({ timelineExpanded }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setPlayhead: (t) => set((s) => ({ playback: { ...s.playback, t: Math.max(0, t) } })),
  setPlaying: (playing) => set((s) => ({ playback: { ...s.playback, playing } })),
  setSpeed: (speed) => set((s) => ({ playback: { ...s.playback, speed } })),
  setLoop: (loop) => set((s) => ({ playback: { ...s.playback, loop } })),
  selectSegment: (selectedSegmentId) => set({ selectedSegmentId }),
  setWaypointDrag: (waypointDrag) => set({ waypointDrag }),
  setPathDraft: (pathDraft) => set({ pathDraft }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  selectDrawings: (selectedDrawingIds) => set({ selectedDrawingIds }),
  setDrawDraft: (drawDraft) => set({ drawDraft }),
  setTextEdit: (textEdit) => set({ textEdit }),
  setAutoReactOpen: (autoReactOpen) => set({ autoReactOpen }),
  setTheme: (theme) => {
    try {
      localStorage.setItem('st.theme', theme)
    } catch {
      /* ignore */
    }
    set({ theme })
  },
  setHelpOpen: (helpOpen) => {
    try {
      localStorage.setItem('st.helpOpen', helpOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
    set({ helpOpen })
  },
  dismissOnboarding: () => {
    try {
      localStorage.setItem('st.onboardingDismissed', '1')
    } catch {
      /* ignore */
    }
    set({ onboardingDismissed: true })
  },
}))
