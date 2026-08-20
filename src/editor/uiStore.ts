/**
 * UI state (not undoable): selection, playback (scope/range/completion), gesture drafts,
 * tour, toast. See ADR-0005 / ADR-0009; legacy mode fields were removed in PLAN-005 M7.
 */
import { create } from 'zustand'
import type { Id, Vec2 } from '@/domain/types'
import { MAX_STEP } from './stepCommands'

export type Tool = 'select' | 'add-player' | 'add-ball' | 'path' | 'zone' | 'text' | 'arrow'

export interface PlaybackState {
  /** Playhead (seconds, tactical clock). */
  t: number
  playing: boolean
  speed: number
  loop: boolean
}

/** What the clock is currently bounded to (PLAN-005 M1): full play, one step, or from a step on. */
export type PlaybackScope = 'all' | 'step' | 'from-step'

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
  reducedMotion: boolean
  playback: PlaybackState
  /** True once playback was started at least once this session (getting-started checklist). */
  hasPlayed: boolean
  /** Scope of the running/last playback (PLAN-005 M1). Footer Play/Space always use 'all'. */
  playScope: PlaybackScope
  /** Where the current scope starts (seconds). Loop returns here. */
  rangeStart: number
  /** Where the current scope ends; null = full duration. */
  rangeEnd: number | null
  /**
   * 'held-result' after a natural finish: the frame stays so the user can study the outcome
   * (A-02). Home or any document-changing edit returns to the authoring start.
   */
  completion: 'idle' | 'held-result'
  /** Start playing `scope` from `start`; `end` bounds the clock (null = document duration). */
  startRange: (scope: PlaybackScope, start: number, end: number | null) => void
  /** Natural finish: freeze the frame at `t` and flag the held-result state (A-02). */
  holdResult: (t: number) => void
  /** Explicit return to the authoring view: t=0, stopped, scope reset (Home / first edit). */
  returnToAuthoringStart: () => void
  /** Simple mode (ADR-0009): step number newly drawn movements get. */
  currentStep: number
  setCurrentStep: (n: number) => void
  /** Transient status line ("다운로드 시작" …), shown by DocMenu; auto-clears. */
  toast: string | null
  flashToast: (msg: string, ms?: number) => void
  /** Interactive first-visit tour (src/ui/tour). `step` indexes the active step set. */
  tour: { active: boolean; step: number; set: 'main' | 'mini' }
  startTour: (step?: number, set?: 'main' | 'mini') => void
  setTourStep: (step: number) => void
  endTour: () => void
  selectedSegmentId: Id | null
  /** Waypoint being dragged (segmentId + waypointId). */
  waypointDrag: { segmentId: Id; waypointId: Id } | null
  pathDraft: PathDraft | null
  shortcutsOpen: boolean
  onboardingDismissed: boolean
  helpOpen: boolean
  selectedDrawingIds: Id[]
  drawDraft: { kind: 'rect' | 'ellipse' | 'arrow'; a: Vec2; b: Vec2 } | null
  textEdit: { at: Vec2; id?: Id; value: string } | null
  /** Freehand annotation mode (PLAN-008): footer bar swaps to the draw bar, board gestures stop.
   *  'select' keeps the NORMAL board pointer (move players/ball) while staying in the draw bar. */
  annotate: {
    on: boolean
    tool: 'pen' | 'eraser' | 'select'
    color: string
    width: number
  }

  setTool: (tool: Tool) => void
  select: (ids: Id[]) => void
  toggleSelect: (id: Id) => void
  clearSelection: () => void
  setHover: (id: Id | null) => void
  setDrag: (drag: DragState | null) => void
  setActiveTeam: (id: Id | null) => void
  setSnapEnabled: (on: boolean) => void
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
  selectDrawings: (ids: Id[]) => void
  setDrawDraft: (d: { kind: 'rect' | 'ellipse' | 'arrow'; a: Vec2; b: Vec2 } | null) => void
  setTextEdit: (t: { at: Vec2; id?: Id; value: string } | null) => void
  setAnnotateOn: (on: boolean) => void
  setAnnotate: (patch: Partial<Omit<UiState['annotate'], 'on'>>) => void
}

export const useUiStore = create<UiState>((set) => ({
  tool: 'select',
  selection: [],
  hover: null,
  drag: null,
  activeTeamId: null,
  snapEnabled: true,
  reducedMotion: false,
  playback: { t: 0, playing: false, speed: 1, loop: false },
  hasPlayed: false,
  playScope: 'all',
  rangeStart: 0,
  rangeEnd: null,
  completion: 'idle',
  tour: { active: false, step: 0, set: 'main' },
  toast: null,
  currentStep: 1,
  selectedSegmentId: null,
  waypointDrag: null,
  pathDraft: null,
  shortcutsOpen: false,
  helpOpen: typeof localStorage === 'undefined' || localStorage.getItem('st.helpOpen') !== '0',
  selectedDrawingIds: [],
  drawDraft: null,
  textEdit: null,
  // VIC reference defaults: PEN_COLORS[0] black, PEN_WIDTHS[2] = 5px
  annotate: { on: false, tool: 'pen', color: '#000000', width: 5 },
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
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setPlayhead: (t) =>
    set((s) => ({ playback: { ...s.playback, t: Math.max(0, t) }, completion: 'idle' })),
  startRange: (scope, start, end) =>
    set((s) => ({
      playScope: scope,
      rangeStart: Math.max(0, start),
      rangeEnd: end,
      completion: 'idle',
      playback: { ...s.playback, t: Math.max(0, start), playing: true },
      hasPlayed: true,
    })),
  holdResult: (t) =>
    set((s) => ({
      playback: { ...s.playback, t: Math.max(0, t), playing: false },
      completion: 'held-result',
    })),
  returnToAuthoringStart: () =>
    set((s) => ({
      playback: { ...s.playback, t: 0, playing: false },
      playScope: 'all',
      rangeStart: 0,
      rangeEnd: null,
      completion: 'idle',
    })),
  setCurrentStep: (currentStep) =>
    set({ currentStep: Math.max(1, Math.min(MAX_STEP, currentStep)) }),
  flashToast: (msg, ms = 1800) => {
    set({ toast: msg })
    setTimeout(() => set((s) => (s.toast === msg ? { toast: null } : {})), ms)
  },
  startTour: (step = 0, set_ = 'main') => set({ tour: { active: true, step, set: set_ } }),
  setTourStep: (step) => set((s) => ({ tour: { ...s.tour, step } })),
  endTour: () => set({ tour: { active: false, step: 0, set: 'main' } }),
  setPlaying: (playing) =>
    set((s) => ({
      // Pause HOLDS the frame (A-02); returning to the authoring start is explicit
      // (returnToAuthoringStart via Home or the first document-changing edit).
      playback: { ...s.playback, playing },
      completion: playing ? 'idle' : s.completion,
      hasPlayed: s.hasPlayed || playing,
    })),
  setSpeed: (speed) => set((s) => ({ playback: { ...s.playback, speed } })),
  setLoop: (loop) => set((s) => ({ playback: { ...s.playback, loop } })),
  selectSegment: (selectedSegmentId) => set({ selectedSegmentId }),
  setWaypointDrag: (waypointDrag) => set({ waypointDrag }),
  setPathDraft: (pathDraft) => set({ pathDraft }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  selectDrawings: (selectedDrawingIds) => set({ selectedDrawingIds }),
  setDrawDraft: (drawDraft) => set({ drawDraft }),
  setTextEdit: (textEdit) => set({ textEdit }),
  setAnnotateOn: (on) => set((s) => ({ annotate: { ...s.annotate, on } })),
  setAnnotate: (patch) => set((s) => ({ annotate: { ...s.annotate, ...patch } })),
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
