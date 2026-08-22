/**
 * Tactic Domain Model — serializable (JSON) source of truth.
 * See docs/agent/decisions/ADR-0003-animation-engine-and-domain-model.md
 * and ADR-0004 (coordinates are metres, origin top-left, x along pitch length).
 *
 * Rules: plain data only. No classes, no functions, no DOM/React types.
 */

export const SCHEMA_VERSION = 1 as const

export type Id = string
export type Seconds = number
export type Metres = number
export type MetresPerSecond = number

export interface Vec2 {
  x: Metres
  y: Metres
}

export interface TacticDocument {
  schemaVersion: typeof SCHEMA_VERSION
  id: Id
  meta: DocumentMeta
  pitch: Pitch
  teams: Team[]
  players: Player[]
  ball: Ball
  /** Provenance only — which preset was applied. Never a constraint. */
  formationRefs?: Record<Id, string>
  drawings: Drawing[]
  /** v1: exactly one scene. Array kept for Phase/Scene chaining. */
  scenes: Scene[]
}

export interface DocumentMeta {
  title: string
  description?: string
  tags?: string[]
  createdAt: string // ISO-8601
  updatedAt: string // ISO-8601
  author?: string
}

export type PitchView = 'full' | 'half-left' | 'half-right'

export interface Pitch {
  length: Metres // default 105
  width: Metres // default 68
  unit: 'm'
  view: PitchView
}

export type TeamSide = 'left' | 'right'

export interface Team {
  id: Id
  name: string
  color: string // CSS color token or hex
  side: TeamSide
}

export interface Player {
  id: Id
  teamId: Id
  number: number
  label?: string
  role?: string
  /** Scene start position. */
  home: Vec2
}

export interface Ball {
  id: Id
  home: Vec2
  initialHolderId?: Id
}

// ---------- Drawings (visual annotation, not animation) ----------

export interface TimeRange {
  from: Seconds
  to: Seconds
}

export type Drawing =
  | { id: Id; kind: 'arrow'; from: Vec2; to: Vec2; style?: DrawingStyle; visible?: TimeRange }
  | { id: Id; kind: 'line'; points: Vec2[]; style?: DrawingStyle; visible?: TimeRange }
  | { id: Id; kind: 'zone'; shape: ZoneShape; style?: DrawingStyle; visible?: TimeRange }
  | {
      id: Id
      kind: 'freehand'
      points: Vec2[]
      /** Per-point width factor 0..1 (VIC pen grammar): stylus pressure, or mouse-speed inverse. */
      pressures?: number[]
      style?: DrawingStyle
      visible?: TimeRange
    }
  | { id: Id; kind: 'text'; at: Vec2; text: string; style?: DrawingStyle; visible?: TimeRange }

export type ZoneShape =
  | { type: 'rect'; at: Vec2; size: Vec2 }
  | { type: 'ellipse'; center: Vec2; radius: Vec2 }
  | { type: 'polygon'; points: Vec2[] }

export interface DrawingStyle {
  color?: string
  dashed?: boolean
  width?: number
  opacity?: number
}

// ---------- Scenes & Timeline ----------

export interface Scene {
  id: Id
  name: string
  timeline: Timeline
}

export interface Timeline {
  tracks: Track[]
  markers: Marker[]
}

export type EntityKind = 'player' | 'ball'

export interface Track {
  id: Id
  entityId: Id
  entityKind: EntityKind
  segments: Segment[]
}

export interface Marker {
  id: Id
  name: string
  trigger: Trigger
}

export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

/**
 * duration — fixed time; speed — constant speed; speed+decel — launch speed with constant
 * deceleration (kinematics: s(t)=v0·t−½a·t², stops when v=0 or at path end). Used for flung balls.
 */
export type Timing =
  { duration: Seconds } | { speed: MetresPerSecond } | { speed: MetresPerSecond; decel: number }

export interface SegmentBase {
  id: Id
  trigger: Trigger
  timing: Timing
  easing?: Easing
  /**
   * Authoring step (1-10, simple mode / ADR-0009). Segments with the same step start together;
   * step n+1 starts when the slowest segment of step n ends. Triggers are DERIVED from steps by
   * `relayoutStepsInDraft`; the trigger remains the engine truth (old documents stay playable).
   */
  step?: number
}

export type Segment = PlayerSegment | BallSegment

export type PlayerSegment =
  | (SegmentBase & {
      kind: 'move'
      path: Path
      facing?: 'path' | 'ball' | 'fixed'
      /** Carry side pinned at THIS run's end junction (ball-ghost orbit) — junction-local. */
      carryEnd?: Vec2
    })
  | (SegmentBase & { kind: 'hold' })

export type BallTravelKind =
  'pass' | 'throughBall' | 'cross' | 'shot' | 'clearance' | 'deflection' | 'loose'

export type BallSegment =
  | (SegmentBase & {
      kind: 'possessed'
      holderId: Id
      offset?: Vec2
      /** User pinned the carry side by orbiting the ball ghost — the dribble front-rest yields. */
      offsetLocked?: boolean
    })
  | (SegmentBase & {
      kind: 'travel'
      travelKind: BallTravelKind
      path: Path
      receiverId?: Id
      flight?: 'ground' | 'lofted'
      /**
       * The DESTINATION MOMENT the user aimed at: this pass arrives exactly when `entityId`'s
       * step-`step` movement ends, at that junction. Written when the pass was aimed at a future
       * spot (a faded token); absent for a pass to a point on the grass. Additive-optional —
       * older documents simply have plain flights (ADR-0010 D4/D9).
       */
      target?: { entityId: Id; step: number }
      /**
       * A CONSEQUENCE roll, not an authored movement: written by a takeaway so playback stays
       * continuous (the ball rolls from the holder's feet to where it was dropped). Rendered
       * without a path line or step badge — the user placed a ball, they did not draw a path
       * (user 2026-08-22: Alt 없이 경로가 그려져). Additive-optional.
       */
      implicit?: boolean
    })
  | (SegmentBase & { kind: 'loose'; position?: Vec2 })

export interface Path {
  /** ≥ 2 waypoints. If no handles anywhere → polyline. */
  waypoints: Waypoint[]
}

export interface Waypoint {
  id: Id
  p: Vec2
  handleIn?: Vec2
  handleOut?: Vec2
  /** Pause at this waypoint before continuing. */
  hold?: Seconds
}

export type Trigger =
  | { type: 'at'; t: Seconds }
  | { type: 'afterSegment'; segmentId: Id; anchor: 'start' | 'end'; offset: Seconds }
  | { type: 'atWaypoint'; segmentId: Id; waypointIndex: number; offset: Seconds }
  | { type: 'onEvent'; event: EventRef; offset: Seconds }
  | { type: 'atMarker'; markerId: Id; offset: Seconds }

export type EventRef =
  | { kind: 'ball.released'; segmentId: Id }
  | { kind: 'ball.received'; segmentId: Id }
  | { kind: 'segment.start'; segmentId: Id }
  | { kind: 'segment.end'; segmentId: Id }
