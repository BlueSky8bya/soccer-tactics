import { memo } from 'react'
import type { Drawing, Id, Vec2 } from '@/domain/types'
import { penSegments } from '@/ui/pitch/inking'
import styles from './pitch.module.css'

/**
 * Variable-width pen stroke (VIC grammar): midpoint quadratic segments, each with its own
 * pressure-scaled width. Widths are CSS px (non-scaling), exactly like the reference.
 */
export function PenStroke(p: {
  points: readonly Vec2[]
  pressures?: readonly number[]
  color: string
  width: number
  opacity?: number
}) {
  return (
    <g opacity={p.opacity}>
      {penSegments(p.points, p.pressures).map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill="none"
          stroke={p.color}
          strokeWidth={p.width * s.f}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

export interface DrawingLayerProps {
  drawings: readonly Drawing[]
  selectedIds: readonly Id[]
  /** Current playhead — drawings with `visible` ranges hide outside. */
  t: number
  /** In-progress shape while drawing. */
  draft?: { kind: 'rect' | 'ellipse' | 'arrow'; a: Vec2; b: Vec2; color?: string } | null
}

const DEFAULT_COLOR = 'rgba(255, 235, 59, 0.95)' // annotation yellow — distinct from team colours

function ZoneShape({ dr }: { dr: Extract<Drawing, { kind: 'zone' }> }) {
  const color = dr.style?.color ?? DEFAULT_COLOR
  const common = { className: styles.zone, style: { stroke: color, fill: color } }
  if (dr.shape.type === 'rect')
    return (
      <rect
        x={dr.shape.at.x}
        y={dr.shape.at.y}
        width={dr.shape.size.x}
        height={dr.shape.size.y}
        rx={0.6}
        {...common}
      />
    )
  if (dr.shape.type === 'ellipse')
    return (
      <ellipse
        cx={dr.shape.center.x}
        cy={dr.shape.center.y}
        rx={dr.shape.radius.x}
        ry={dr.shape.radius.y}
        {...common}
      />
    )
  return <polygon points={dr.shape.points.map((p) => `${p.x},${p.y}`).join(' ')} {...common} />
}

/** Pure annotation renderer (zones, arrows, text, lines). Not animation paths. */
export const DrawingLayer = memo(function DrawingLayer(p: DrawingLayerProps) {
  return (
    <g className={styles.drawingLayer}>
      <defs>
        <marker
          id="arrow-annot"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="2.4"
          markerHeight="2.4"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: DEFAULT_COLOR }} />
        </marker>
      </defs>
      {p.drawings.map((dr) => {
        if (dr.visible && (p.t < dr.visible.from || p.t > dr.visible.to)) return null
        const selected = p.selectedIds.includes(dr.id)
        const color = dr.style?.color ?? DEFAULT_COLOR
        let body: React.ReactNode
        switch (dr.kind) {
          case 'zone':
            body = <ZoneShape dr={dr} />
            break
          case 'arrow':
            body = (
              <>
                <line
                  x1={dr.from.x}
                  y1={dr.from.y}
                  x2={dr.to.x}
                  y2={dr.to.y}
                  className={styles.annotHit}
                />
                <line
                  x1={dr.from.x}
                  y1={dr.from.y}
                  x2={dr.to.x}
                  y2={dr.to.y}
                  className={`${styles.annotArrow} ${dr.style?.dashed ? styles.pathPass : ''}`}
                  style={{ stroke: color }}
                  markerEnd="url(#arrow-annot)"
                />
              </>
            )
            break
          case 'text':
            body = (
              <>
                <rect
                  x={dr.at.x - dr.text.length * 0.55 - 0.8}
                  y={dr.at.y - 1.4}
                  width={dr.text.length * 1.1 + 1.6}
                  height={2.8}
                  rx={0.6}
                  className={styles.annotTextBg}
                />
                <text
                  x={dr.at.x}
                  y={dr.at.y}
                  className={styles.annotText}
                  style={{ fill: dr.style?.color ?? '#fff' }}
                >
                  {dr.text}
                </text>
              </>
            )
            break
          case 'freehand':
            body = (
              <>
                <polyline
                  points={dr.points.map((q) => `${q.x},${q.y}`).join(' ')}
                  className={styles.annotHit}
                />
                <PenStroke
                  points={dr.points}
                  pressures={dr.pressures}
                  color={color}
                  width={dr.style?.width ?? 5}
                  opacity={dr.style?.opacity}
                />
              </>
            )
            break
          case 'line':
            body = (
              <>
                <polyline
                  points={dr.points.map((q) => `${q.x},${q.y}`).join(' ')}
                  className={styles.annotHit}
                />
                <polyline
                  points={dr.points.map((q) => `${q.x},${q.y}`).join(' ')}
                  className={styles.annotArrow}
                  style={{
                    stroke: color,
                    strokeWidth: dr.style?.width ?? 3,
                    opacity: dr.style?.opacity,
                  }}
                />
              </>
            )
            break
        }
        return (
          <g
            key={dr.id}
            data-drawing={dr.id}
            className={`${styles.drawing} ${selected ? styles.drawingSelected : ''}`}
          >
            {body}
          </g>
        )
      })}
      {p.draft && (
        <g className={styles.drawingDraft}>
          {p.draft.kind === 'rect' && (
            <rect
              x={Math.min(p.draft.a.x, p.draft.b.x)}
              y={Math.min(p.draft.a.y, p.draft.b.y)}
              width={Math.abs(p.draft.b.x - p.draft.a.x)}
              height={Math.abs(p.draft.b.y - p.draft.a.y)}
              rx={0.6}
              className={styles.zone}
              style={{ stroke: DEFAULT_COLOR, fill: DEFAULT_COLOR }}
            />
          )}
          {p.draft.kind === 'ellipse' && (
            <ellipse
              cx={(p.draft.a.x + p.draft.b.x) / 2}
              cy={(p.draft.a.y + p.draft.b.y) / 2}
              rx={Math.abs(p.draft.b.x - p.draft.a.x) / 2}
              ry={Math.abs(p.draft.b.y - p.draft.a.y) / 2}
              className={styles.zone}
              style={{ stroke: DEFAULT_COLOR, fill: DEFAULT_COLOR }}
            />
          )}
          {p.draft.kind === 'arrow' && (
            <line
              x1={p.draft.a.x}
              y1={p.draft.a.y}
              x2={p.draft.b.x}
              y2={p.draft.b.y}
              className={styles.annotArrow}
              style={{ stroke: DEFAULT_COLOR }}
              markerEnd="url(#arrow-annot)"
            />
          )}
        </g>
      )}
    </g>
  )
})
