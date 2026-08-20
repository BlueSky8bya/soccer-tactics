import { memo } from 'react'
import type { Id, Path, Segment, TacticDocument, Vec2 } from '@/domain/types'
import { pathToSvgD } from '@/engine/path'
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
  /** Playback focus (PLAN-005 M4): per-segment phase; active paths pop, past/future recede. */
  pathPhase?: Readonly<Record<Id, 'past' | 'active' | 'future'>>
}

function segClass(seg: Segment): string | undefined {
  if (seg.kind === 'travel') {
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
      const markerId = isBall ? 'arrow-ball' : `arrow-${track.entityId}`
      items.push(
        <g
          key={seg.id}
          data-segment={seg.id}
          data-entity-of={track.entityId}
          data-phase={phase}
          className={`${styles.pathGroup} ${selected ? styles.pathSelected : ''} ${dim ? styles.pathDim : ''} ${phaseClass}`}
        >
          {/* wide invisible hit path for easy selection */}
          <path d={d} className={styles.pathHit} />
          {/* translucent casing under the colored line keeps thin paths readable on pitch markings (B-04) */}
          <path d={d} className={styles.pathCasing} />
          <path
            d={d}
            className={`${styles.path} ${segClass(seg)}`}
            style={{ stroke: color }}
            markerEnd={`url(#${markerId})`}
          />
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
                      r={i === 0 ? 0.55 : 0.7}
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
        {/* Slim open-chevron heads (coaching-board style): stroke-only, sized to the line. */}
        {p.doc.players.map((pl) => (
          <marker
            key={pl.id}
            id={`arrow-${pl.id}`}
            viewBox="0 0 10 10"
            refX="7.5"
            refY="5"
            markerWidth="1.4"
            markerHeight="1.4"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path
              d="M 2 1.5 L 8.5 5 L 2 8.5"
              style={{ fill: 'none', stroke: p.teamColorOf(pl.id) }}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        ))}
        <marker
          id="arrow-ball"
          viewBox="0 0 10 10"
          refX="7.5"
          refY="5"
          markerWidth="1.2"
          markerHeight="1.2"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path
            d="M 2 1.5 L 8.5 5 L 2 8.5"
            style={{ fill: 'none', stroke: 'var(--st-ball-path, #f5f5f7)' }}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
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
