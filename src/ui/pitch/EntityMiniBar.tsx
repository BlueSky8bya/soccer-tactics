import { useEffect, useRef, type RefObject } from 'react'
import { removeEntities } from '@/editor/commands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { giveBallTo } from '@/editor/segmentCommands'
import { useUiStore } from '@/editor/uiStore'
import { useResolvedState } from '@/editor/useCompiled'
import { t } from '../i18n'
import { SPRINGS } from '../motion/spring'
import { useSpringAnimator } from '../motion/useSpring'
import styles from './miniBar.module.css'
import { useSvgMetrics } from './useSvgMetrics'

/**
 * Contextual mini-bar above the selected entity (ADR-0006 D4-3 / D9 Discovery Delight):
 * shows the next sensible actions where the hand already is.
 */
export function EntityMiniBar({
  svgRef,
  pad,
}: {
  svgRef: RefObject<SVGSVGElement | null>
  pad: number
}) {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const resolved = useResolvedState()
  const selection = useUiStore((s) => s.selection)
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  const select = useUiStore((s) => s.select)
  const drag = useUiStore((s) => s.drag)
  const pathDraft = useUiStore((s) => s.pathDraft)
  const playing = useUiStore((s) => s.playback.playing)
  const metrics = useSvgMetrics(svgRef, pad, doc.pitch.length, doc.pitch.width)
  const el = useRef<HTMLDivElement>(null)

  const id = selection.length === 1 ? selection[0]! : null
  const isBall = id === doc.ball.id
  const player = id && !isBall ? doc.players.find((p) => p.id === id) : undefined
  const visible = !!id && !drag && !pathDraft && !playing && (!!player || isBall)

  const anim = useSpringAnimator(0, SPRINGS.miniBar, (v) => {
    const node = el.current
    if (!node) return
    node.style.opacity = String(Math.max(0, Math.min(1, v)))
    node.style.transform = `translate(-50%, calc(-100% - 14px)) scale(${0.9 + 0.1 * v})`
    node.style.pointerEvents = v > 0.6 ? 'auto' : 'none'
  })
  useEffect(() => {
    anim.to(visible ? 1 : 0)
  }, [visible, anim])

  if (!id || !metrics) return null
  const pos = isBall ? resolved.ball.pos : (resolved.players[id]?.pos ?? player?.home)
  if (!pos) return null
  const left = metrics.ox + pos.x * metrics.scale
  const top = metrics.oy + pos.y * metrics.scale - 1.6 * metrics.scale

  const holderId = resolved.ball.holderId
  const hasBall = !!player && holderId === player.id

  return (
    <div
      ref={el}
      className={styles.bar}
      style={{ left, top, opacity: 0, pointerEvents: 'none' }}
      role="toolbar"
      aria-label={t('minibar.label')}
      inert={!visible}
      aria-hidden={!visible}
    >
      {player && (
        <>
          <button
            type="button"
            className={`${styles.btn} ${tool === 'path' ? styles.btnActive : ''}`}
            onClick={() => setTool(tool === 'path' ? 'select' : 'path')}
            title={t('minibar.drawPath')}
          >
            ↝ {t('minibar.path')} <kbd>E</kbd>
          </button>
          {hasBall ? (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                select([doc.ball.id])
                setTool('path')
              }}
              title={t('minibar.drawPass')}
            >
              ⚽ {t('minibar.pass')}
            </button>
          ) : (
            <button
              type="button"
              className={styles.btn}
              onClick={() => giveBallTo(core, player.id)}
              title={t('minibar.giveBall')}
            >
              ⚽ {t('minibar.give')}
            </button>
          )}
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              removeEntities(core, [player.id])
              useUiStore.getState().clearSelection()
            }}
            title={t('inspector.delete')}
          >
            🗑
          </button>
        </>
      )}
      {isBall && (
        <>
          <button
            type="button"
            className={`${styles.btn} ${tool === 'path' ? styles.btnActive : ''}`}
            onClick={() => setTool(tool === 'path' ? 'select' : 'path')}
            title={t('minibar.drawPass')}
          >
            ↝ {t('minibar.pass')} <kbd>E</kbd>
          </button>
          {holderId && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => giveBallTo(core, null)}
              title={t('minibar.release')}
            >
              {t('minibar.release')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
