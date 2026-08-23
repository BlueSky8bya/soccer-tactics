import { memo } from 'react'
import type { Id, Path, Segment, TacticDocument, Vec2 } from '@/domain/types'
import { buildPathLUT, pathToSvgD, pointAtDistance } from '@/engine/path'
import { trimPathEndD, type StepLayer } from '@/ui/pitch/pathPresentation'
import styles from './pitch.module.css'

export interface PathLayerProps {
  doc: TacticDocument
  teamColorOf: (playerId: Id) => string
  selectedEntityIds: readonly Id[]
  selectedSegmentId: Id | null
  hoverSegmentId?: Id | null
  /**
   * Presentation-only: for the selected ball travel that follows a possession, the first waypoint is
   * drawn at the compiled release point and locked (not draggable). Plain data from the UI layer.
   */
  attachedStart?: { segmentId: Id; waypointId: Id; p: Vec2; delta: Vec2 } | null
  /** Freehand trail being drawn (metres). */
  draft?: { points: Vec2[]; color: string; dashed: boolean } | null
  /** Dim unrelated paths while editing/playing. */
  dimOthers?: boolean
  /** Segments whose ARROWHEAD is hidden (mid-chain junctions — only the final pass keeps it). */
  noHeadIds?: Readonly<Record<Id, boolean>>
  /** Playback focus (PLAN-005 M4): per-segment phase; active paths pop, past/future recede. */
  pathPhase?: Readonly<Record<Id, 'past' | 'active' | 'future'>>
  /**
   * Step layer per segment (PLAN-015). 'hidden' is not drawn AT ALL — the caller must drop the
   * same segments from its hit-testing input, or the board keeps catching presses for a line
   * nobody can see. 'muted' is the old rest hierarchy (PLAN-006 M3b, A-05a).
   */
  stepLayer?: Readonly<Record<Id, StepLayer>>
}

/**
 * ONE DIRECTION LANGUAGE for players and the ball (user 2026-08-24: 선수 이동 동선 표시랑 통일이면
 * 좋으니까 더 가독성 좋은 걸로 두개 통일).
 *
 * A run was a solid line and a pass a dashed one, so "which way does this go" was answered only by
 * the arrowhead at the far end — and on a crowded board the far end is the busiest pixel there is.
 * Now every path is dashed and every dash MARCHES toward the destination at the same speed, so
 * direction reads anywhere along the line, at a glance, for both kinds of mark.
 *
 * What stays different is the RHYTHM, and deliberately: a run is a long stride, a pass is quick
 * ticks, a loose ball a dribble of dots. That is the football-diagram convention (continuous for a
 * carry, dotted for a kick) kept as texture rather than as two unrelated grammars.
 *
 * `period` is the dash+gap sum; the flow distance is a whole number of periods or the loop visibly
 * jumps. Speed is constant, so a long path does not race a short one.
 */
const FLOW_SPEED = 26 // stroke units per second

function dashFor(seg: Segment): { dash: string; period: number } {
  if (seg.kind === 'travel') {
    if (seg.implicit) return { dash: '2 4', period: 6 }
    if (seg.travelKind === 'shot') return { dash: '9 5', period: 14 }
    if (seg.flight === 'lofted' || seg.travelKind === 'cross') return { dash: '3 6', period: 9 }
    return { dash: '6 5', period: 11 }
  }
  return { dash: '11 5', period: 16 }
}

/** Display-d caches: immer keeps unchanged segments identical, so trims compute once per edit. */
const trimCache = new WeakMap<object, string>()
const casingCache = new WeakMap<object, string>()

/**
 * How long the soft ENTRY of a stroke is (m). A chain is one movement told in legs, but every leg
 * used to begin with a full-weight blunt end, so each junction read as a cut (user 2026-08-23:
 * 이어지는 경로 중간중간 끊긴 지점). Fading the first stretch in lets a leg emerge from the token
 * it starts at, the way an Apple route line grows out of its pin.
 */
const ENTRY_FADE_M = { player: 2.2, ball: 1.4 }

/** Tapered dart head, drawn in the marker's 10×10 box: fine tip, deeply concave back. */
const ARROW_D = 'M 9.5 5 L 1.2 9.3 C 3.5 7.2 3.5 2.8 1.2 0.7 Z'

/** The axis a stroke's entry fade runs along: its start, and a point that far along the path. */
function entryAxis(path: Path, len: number): { a: Vec2; b: Vec2 } | null {
  const a = path.waypoints[0]?.p
  if (!a) return null
  const lut = buildPathLUT(path)
  if (lut.length < 0.05) return null
  const b = pointAtDistance(lut, Math.min(len, lut.length))
  if (Math.hypot(b.x - a.x, b.y - a.y) < 0.05) return null
  return { a, b }
}

function displayD(
  seg: object,
  path: Path,
  fullD: string,
  trimM: number,
  cacheable: boolean,
  startTrimM = 0,
  cache: WeakMap<object, string> = trimCache,
): string {
  if (cacheable) {
    const hit = cache.get(seg)
    if (hit) return hit
  }
  const d = trimPathEndD(path, trimM, startTrimM) ?? fullD
  if (cacheable) cache.set(seg, d)
  return d
}

function segClass(seg: Segment): string | undefined {
  if (seg.kind === 'travel') {
    // A takeaway's consequence roll shows like every other movement — dashed line + badge
    // (user 2026-08-22: 점선이랑 단계 배지도 다른 것들처럼) — but fainter: the ball ROLLS
    // loose there, nobody kicked it.
    if (seg.implicit) return styles.pathLoose
    if (seg.travelKind === 'shot') return styles.pathShot
    if (seg.flight === 'lofted' || seg.travelKind === 'cross') return styles.pathLofted
    return styles.pathPass
  }
  return styles.pathMove
}

/** Pure: draws every path segment in the scene; selected segment exposes waypoints. */
export const PathLayer = memo(function PathLayer(p: PathLayerProps) {
  const scene = p.doc.scenes[0]
  if (!scene) return null
  const items: React.ReactNode[] = []
  for (const track of scene.timeline.tracks) {
    const isBall = track.entityKind === 'ball'
    const color = isBall ? 'var(--st-ball-path, #f5f5f7)' : p.teamColorOf(track.entityId)
    const entitySelected = p.selectedEntityIds.includes(track.entityId)
    for (const seg of track.segments) {
      if (!('path' in seg) || seg.path.waypoints.length < 2) continue
      const att = p.attachedStart && p.attachedStart.segmentId === seg.id ? p.attachedStart : null
      const shown: Path =
        att && seg.path.waypoints[0]?.id === att.waypointId
          ? {
              waypoints: seg.path.waypoints.map((w, i) =>
                i === 0
                  ? {
                      ...w,
                      p: { x: w.p.x + att.delta.x, y: w.p.y + att.delta.y },
                      handleOut: w.handleOut
                        ? { x: w.handleOut.x + att.delta.x, y: w.handleOut.y + att.delta.y }
                        : undefined,
                    }
                  : w,
              ),
            }
          : seg.path
      const d = pathToSvgD(shown)
      // Arrowhead clearance: player ends host a 1.7m ghost, ball ends a small ball ghost.
      // ball passes also trim their TAIL 0.55m so a chained pass never sits on the previous
      // arrowhead (user 2026-08-21: 화살표와 꽁무늬 겹침)
      // Head clearance: the dart is longer than the old chevron, so the line stops closer in and
      // the TIP ends just short of the token's edge — near enough to read as arrival, clear enough
      // never to cover the number.
      const trimM = isBall ? 1.0 : 1.9
      const startTrimM = isBall ? 0.5 : 0
      const strokeD = displayD(seg, shown, d, trimM, !att, startTrimM)
      // The casing stops a head-length earlier: its wide soft cap used to peek out around the
      // arrowhead as a pale collar, which is exactly the kind of seam this pass is removing.
      const casingD = displayD(
        seg,
        shown,
        d,
        trimM + (isBall ? 1.1 : 1.3),
        !att,
        startTrimM,
        casingCache,
      )
      const selected = p.selectedSegmentId === seg.id
      const emphasized = selected || entitySelected
      const phase = p.pathPhase?.[seg.id]
      const dim = p.dimOthers && !emphasized && !phase
      const phaseClass =
        phase === 'active'
          ? styles.pathActive
          : phase === 'past'
            ? styles.pathPast
            : phase === 'future'
              ? styles.pathFuture
              : ''
      const layer = selected ? 'focus' : (p.stepLayer?.[seg.id] ?? 'focus')
      if (layer === 'hidden') continue
      const mutedClass = layer === 'muted' ? styles.pathStepMuted : ''
      const flow = dashFor(seg)
      const markerId = isBall ? 'arrow-ball' : `arrow-${track.entityId}`
      const axis = entryAxis(shown, isBall ? ENTRY_FADE_M.ball : ENTRY_FADE_M.player)
      const maskId = axis ? `entry-${seg.id}` : null
      items.push(
        <g
          key={seg.id}
          data-segment={seg.id}
          data-entity-of={track.entityId}
          data-phase={phase}
          className={`${styles.pathGroup} ${selected ? styles.pathSelected : ''} ${dim ? styles.pathDim : ''} ${phaseClass} ${mutedClass}`}
          /* every mark inside this group belongs to ONE entity, so the colour is set once here and
             inherited — see entityColorOf for the rule. The dash lives here too, because the white
             casing UNDER the line has to break in exactly the same places: a solid casing beneath a
             dashed stroke shows through every gap as a pale smear. */
          style={
            {
              '--st-entity': color,
              '--st-dash': flow.dash,
              '--st-flow': -flow.period * 2,
              '--st-flow-ms': `${Math.round(((flow.period * 2) / FLOW_SPEED) * 1000)}ms`,
            } as React.CSSProperties
          }
        >
          {/* wide invisible hit path for easy selection (full length) — NEVER masked, or the
              faded entry would be unclickable */}
          <path d={d} className={styles.pathHit} />
          {maskId && axis && (
            <defs>
              <linearGradient
                id={`${maskId}-g`}
                gradientUnits="userSpaceOnUse"
                x1={axis.a.x}
                y1={axis.a.y}
                x2={axis.b.x}
                y2={axis.b.y}
              >
                <stop offset="0" stopColor="#000" />
                <stop offset="0.55" stopColor="#9a9a9a" />
                <stop offset="1" stopColor="#fff" />
              </linearGradient>
              <mask id={maskId} maskUnits="userSpaceOnUse" x={-20} y={-20} width={160} height={120}>
                <rect x={-20} y={-20} width={160} height={120} fill={`url(#${maskId}-g)`} />
              </mask>
            </defs>
          )}
          <g className={styles.pathBody} mask={maskId ? `url(#${maskId})` : undefined}>
            {/* translucent casing under the colored line keeps thin paths readable on pitch markings (B-04) */}
            <path d={casingD} className={styles.pathCasing} />
            <path
              d={strokeD}
              className={`${styles.path} ${segClass(seg)}`}
              style={{ stroke: color }}
              markerEnd={p.noHeadIds?.[seg.id] ? undefined : `url(#${markerId})`}
            />
          </g>
          {selected &&
            shown.waypoints.map((w, i) => (
              <g key={w.id}>
                {w.handleIn && (
                  <line
                    x1={w.p.x}
                    y1={w.p.y}
                    x2={w.handleIn.x}
                    y2={w.handleIn.y}
                    className={styles.handleLine}
                  />
                )}
                {w.handleOut && (
                  <line
                    x1={w.p.x}
                    y1={w.p.y}
                    x2={w.handleOut.x}
                    y2={w.handleOut.y}
                    className={styles.handleLine}
                  />
                )}
                {att && i === 0 ? (
                  <g data-attached-start={seg.id} className={styles.attachedStart}>
                    <circle cx={w.p.x} cy={w.p.y} r={1.1} className={styles.attachedRing} />
                    <circle cx={w.p.x} cy={w.p.y} r={0.45} className={styles.attachedDot} />
                  </g>
                ) : (
                  <>
                    <circle
                      cx={w.p.x}
                      cy={w.p.y}
                      r={1.4}
                      className={styles.waypointHit}
                      data-waypoint={w.id}
                      data-segment={seg.id}
                    />
                    <circle
                      cx={w.p.x}
                      cy={w.p.y}
                      r={i === 0 ? 0.38 : 0.48}
                      className={i === 0 ? styles.waypointStart : styles.waypoint}
                    />
                  </>
                )}
                {w.hold ? (
                  <text x={w.p.x} y={w.p.y - 1.4} className={styles.waypointLabel}>
                    ⏸ {w.hold}s
                  </text>
                ) : null}
              </g>
            ))}
        </g>,
      )
    }
  }
  return (
    <g className={styles.pathLayer}>
      <defs>
        {/*
          The head is a TAPERED DART, not an open V: a solid tip whose back curves inward, so it
          reads as the line coming to a point rather than as two sticks glued on (user 2026-08-23:
          화살표 디자인 애플 형식으로). Rounded joins keep every corner soft at any zoom, and the
          concave back lets the stroke flow into it without a visible seam.
        */}
        {p.doc.players.map((pl) => (
          <marker
            key={pl.id}
            id={`arrow-${pl.id}`}
            viewBox="0 0 10 10"
            refX="8.7"
            refY="5"
            markerWidth="1.9"
            markerHeight="1.9"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path
              d={ARROW_D}
              style={{ fill: p.teamColorOf(pl.id), stroke: p.teamColorOf(pl.id) }}
              strokeWidth="0.7"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </marker>
        ))}
        <marker
          id="arrow-ball"
          viewBox="0 0 10 10"
          refX="8.7"
          refY="5"
          markerWidth="1.65"
          markerHeight="1.65"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path
            d={ARROW_D}
            style={{
              fill: 'var(--st-ball-path, #f5f5f7)',
              stroke: 'var(--st-ball-path, #f5f5f7)',
            }}
            strokeWidth="0.7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </marker>
      </defs>
      {items}
      {p.draft && p.draft.points.length > 1 && (
        <path
          d={`M ${p.draft.points.map((q) => `${q.x} ${q.y}`).join(' L ')}`}
          className={`${styles.path} ${styles.pathDraft} ${p.draft.dashed ? styles.pathPass : ''}`}
          style={{ stroke: p.draft.color }}
        />
      )}
    </g>
  )
})
