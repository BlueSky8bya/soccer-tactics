/**
 * UI state (not undoable): selection, playback (scope/range/completion), gesture drafts,
 * tour, toast. See ADR-0005 / ADR-0009; legacy mode fields were removed in PLAN-005 M7.
 */
import { create } from 'zustand'
import type { Id, Vec2 } from '@/domain/types'
import { NORMAL_SPEED } from './playbackRates'
import { MAX_STEP } from './stepCommands'

export type Tool = 'select' | 'add-player' | 'add-ball' | 'path' | 'zone' | 'text' | 'arrow'

/** A persisted UI preference — never part of the document. Storage can be absent or refuse. */
function loadFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function saveFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* private mode / disabled storage — the preference just does not survive the session */
  }
}

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
  /**
   * Throwing the ball (user 2026-08-24: 공 굴러가는거 키고 끄는 토글, 기본 디폴트는 없게).
   *
   * A fast release used to launch a physics roll on its own, which is a delightful feature exactly
   * when it is wanted and a surprise every other time (2026-08-21 급발진, 2026-08-22 지 혼자 슉
   * 지나가고 — the constants were tightened twice and the gesture still fires unasked). So it is
   * OPT-IN now: off, the ball is placed where it was let go. The double-click slingshot is a
   * deliberate gesture and is not gated by this.
   */
  ballFling: boolean
  setBallFling: (on: boolean) => void
  /**
   * Step isolation (user 2026-08-24: 처음부터 끝까지 모든걸 보여줄 필욘 없음). On, the clock sits at
   * the moment the current step opens and ONLY that step's arrows, badges and destination ghosts
   * are drawn — everything earlier is already standing on the board as solid tokens. Off, every
   * authored path stays visible as before. See deriveStepLayers and the anchor pin in SimplePitch.
   */
  stepIsolate: boolean
  setStepIsolate: (on: boolean) => void
  playback: PlaybackState
  /** Space-HOLD factor (0.5 / 2 / 3), picked by sliding the play button (user 2026-08-22). */
  boostFactor: number
  setBoostFactor: (n: number) => void
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
  /**
   * WHERE "the authoring start" IS (PLAN-015 v2). It used to be 0, full stop. With one step
   * isolated the board has to sit at the moment that step OPENS — that frame is what makes the
   * earlier steps' outcome visible as solid tokens instead of a pile of ghosts — and every press
   * calls `returnToAuthoringStart`, so a hard-coded 0 would snap the board back to kickoff on
   * every touch. The board owns this value (only it can compile the step's opening time).
   */
  authoringT: number
  setAuthoringT: (t: number) => void
  /** Start playing `scope` from `start`; `end` bounds the clock (null = document duration). */
  startRange: (scope: PlaybackScope, start: number, end: number | null) => void
  /** Natural finish: freeze the frame at `t` and flag the held-result state (A-02). */
  holdResult: (t: number) => void
  /** Explicit return to the authoring view: `authoringT`, stopped, scope reset (Home / first edit). */
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
  /**
   * Chrome hidden, board only. Every professional canvas tool ships docked chrome plus a
   * one-key escape to full canvas (Sketch ⌘., Figma ⌘⇧\, VS Code Zen) — four decades of
   * unanimous precedent, and the cheapest way to hand the board the whole window.
   */
  zen: boolean
  setZen: (on: boolean) => void
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
  ballFling: loadFlag('st.ballFling', false),
  stepIsolate: loadFlag('st.stepIsolate', true),
  playback: { t: 0, playing: false, speed: NORMAL_SPEED, loop: false },
  boostFactor: 3,
  hasPlayed: false,
  playScope: 'all',
  rangeStart: 0,
  rangeEnd: null,
  completion: 'idle',
  authoringT: 0,
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
  zen: false,
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
  setBallFling: (ballFling) => {
    saveFlag('st.ballFling', ballFling)
    set({ ballFling })
  },
  setStepIsolate: (stepIsolate) => {
    saveFlag('st.stepIsolate', stepIsolate)
    set({ stepIsolate })
  },
  setBoostFactor: (boostFactor) => set({ boostFactor }),
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
  setAuthoringT: (authoringT) => set({ authoringT: Math.max(0, authoringT) }),
  returnToAuthoringStart: () =>
    set((s) => ({
      playback: { ...s.playback, t: s.authoringT, playing: false },
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
  setZen: (zen) => set({ zen }),
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
