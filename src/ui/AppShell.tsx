import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useEditor, useEditorSnapshot, useVariantSession } from '@/editor/EditorContext'
import { useCompiled } from '@/editor/useCompiled'
import { removeDrawings } from '@/editor/moreCommands'
import { PEN_COLORS, PEN_WIDTHS } from './pitch/inking'
import { ColorPicker } from './ColorPicker'
import { downloadBlob, exportGif } from './exportGif'
import { UiIcon } from './UiIcon'
import { BOOST_FACTORS, NORMAL_SPEED, speedFactor } from '@/editor/playbackRates'
import { playableEnd, usePlaybackController } from '@/editor/usePlayback'
import { useUiStore } from '@/editor/uiStore'
import { PlayerCard } from './PlayerCard'
import { SelectionActionBar } from './SelectionActionBar'
import { BoardHints } from './BoardHints'
import { BoardMenu, TeamMenu } from './ToolbarMenus'
import { ShortcutsOverlay } from './ShortcutsOverlay'
import { StepBar } from './StepBar'
import { t } from './i18n'
import { KEYMAP } from './keymap'
import { prefersReducedMotion } from './motion/spring'
import { SimplePitch } from './pitch/SimplePitch'
import styles from './shell.module.css'
import { StepPanel } from './StepPanel'
import { nextTheme, type ThemePref } from './theme'
import { TourOverlay } from './tour/TourOverlay'
import { hasSeenTour } from './tour/tourStorage'
import { useEditorKeyboard } from './useEditorKeyboard'
import { useTheme } from './useTheme'
import { useBoardBreath } from './useBoardBreath'

const THEME_LABEL: Record<
  ThemePref,
  'topbar.themeSystem' | 'topbar.themeLight' | 'topbar.themeDark'
> = {
  system: 'topbar.themeSystem',
  light: 'topbar.themeLight',
  dark: 'topbar.themeDark',
}
const THEME_ICON: Record<ThemePref, 'themeAuto' | 'sun' | 'moon'> = {
  system: 'themeAuto',
  light: 'sun',
  dark: 'moon',
}

/**
 * Single simple mode (ADR-0009, user decision 2026-08-20): pitch + play + steps. No tool rail,
 * no inspector, no tracks. Everything is authored with the mouse on the pitch.
 */

export function AppShell() {
  const core = useEditor()
  const { doc, canUndo, canRedo } = useEditorSnapshot()
  const compiled = useCompiled()
  const ui = useUiStore()
  const playEnd = playableEnd(compiled)
  const pb = usePlaybackController(playEnd)
  const setReducedMotion = useUiStore((s) => s.setReducedMotion)
  const startTour = useUiStore((s) => s.startTour)
  const variants = useVariantSession()
  /*
   * The stage, so a board that has BECOME A DIFFERENT BOARD can say so with one breath. See
   * `useBoardBreath`: a variant switch used to replace every token in silence.
   */
  const pitchFrameRef = useRef<HTMLDivElement>(null)
  useBoardBreath(pitchFrameRef)
  const [gifBusy, setGifBusy] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const theme = useTheme()
  const customCellRef = useRef<HTMLButtonElement>(null)
  useEditorKeyboard()

  const exportPlayGif = async () => {
    if (gifBusy) return
    setGifBusy(true)
    ui.flashToast(t('gif.start'), 90000)
    try {
      const blob = await exportGif(core.getDocument(), {
        onProgress: (d, n) => {
          if (d % 12 === 0)
            ui.flashToast(t('gif.progress', { p: Math.round((d / n) * 100) }), 90000)
        },
      })
      // A안_YYMMDD_HHMM.gif (user 2026-08-20)
      const now = new Date()
      const p2 = (n: number) => String(n).padStart(2, '0')
      const stamp = `${String(now.getFullYear()).slice(2)}${p2(now.getMonth() + 1)}${p2(now.getDate())}_${p2(now.getHours())}${p2(now.getMinutes())}`
      downloadBlob(blob, `${variants?.activeId ?? 'A'}안_${stamp}.gif`)
      // The encoder picks its own resolution to fit the size budget, so SAY which one it landed on
      // — otherwise "why is this one softer than the last one" has no answer.
      const head = new Uint8Array(await blob.slice(0, 10).arrayBuffer())
      const w = head[6]! | (head[7]! << 8)
      ui.flashToast(t('gif.done', { w, mb: (blob.size / 1024 / 1024).toFixed(1) }))
    } catch {
      ui.flashToast(t('gif.fail'))
    } finally {
      setGifBusy(false)
    }
  }

  const switchVariant = (id: 'A' | 'B' | 'C') => {
    if (!variants || !variants.has(id) || variants.activeId === id) return
    // Switching stops playback and drops the selection - they belong to the old board (M5).
    ui.returnToAuthoringStart()
    ui.clearSelection()
    variants.switchTo(id)
    // …and it SAYS SO. Two channels, because they answer different questions: the breath says
    // "the board changed", the toast says "to this one" (user 2026-08-25).
    ui.announceIdentitySwap()
    ui.flashToast(t('variant.switched', { v: id }))
  }
  const cloneInto = (target: 'A' | 'B' | 'C') => {
    if (!variants || variants.has(target)) return
    ui.returnToAuthoringStart()
    ui.clearSelection()
    variants.cloneActiveTo(target)
    ui.announceIdentitySwap()
    ui.flashToast(t('variant.cloned', { v: target }))
  }

  useEffect(() => {
    setReducedMotion(prefersReducedMotion())
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const on = () => setReducedMotion(!!mq?.matches)
    mq?.addEventListener?.('change', on)
    return () => mq?.removeEventListener?.('change', on)
  }, [setReducedMotion])

  // First visit (cookie/localStorage flag absent) → interactive tour.
  useEffect(() => {
    if (!hasSeenTour()) startTour(0)
  }, [startTour])

  const errors = compiled.issues.filter((i) => i.level === 'error')

  // Space-HOLD raises (or slows) the clock rate (useEditorKeyboard). Nothing said so out loud, so
  // the board just looked jumpy — these cues name it (user 2026-08-21: 눈으로 보이게).
  const boosted = ui.playback.playing && ui.playback.speed !== NORMAL_SPEED

  /*
   * The hold FACTOR is picked on the play button itself: grab it and slide left/right through
   * 0.5× / 2× / 3× (user 2026-08-22). A press that never travels stays a click — play/pause is
   * untouched. `null` = not scrubbing; `idx` follows the hand with a spring on each hop.
   */
  const [scrub, setScrub] = useState<{ idx: number; x: number; y: number } | null>(null)
  /**
   * Did the press that just ended actually travel? The click handler needs the answer BEFORE React
   * has re-rendered, and `scrub` is state — reading it there would see the row that pointerdown
   * has only just opened and swallow every play/pause.
   */
  const scrubMovedRef = useRef(false)
  const scrubRef = useRef<{
    startX: number
    startIdx: number
    idx: number
    moved: boolean
    pointerId: number
    anchor: { x: number; y: number }
  } | null>(null)
  const SCRUB_STEP_PX = 44
  const onPlayPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    const startIdx = Math.max(0, BOOST_FACTORS.indexOf(ui.boostFactor as 0.5 | 2 | 3))
    const r = e.currentTarget.getBoundingClientRect()
    const idx = startIdx < 0 ? BOOST_FACTORS.length - 1 : startIdx
    const anchor = { x: r.x + r.width / 2, y: r.y }
    scrubRef.current = {
      startX: e.clientX,
      startIdx: idx,
      idx,
      moved: false,
      pointerId: e.pointerId,
      anchor,
    }
    scrubMovedRef.current = false
    /*
     * The speed row opens on the PRESS, not on the first millimetre of travel (user 2026-08-24:
     * 마우스를 누르고 있을때부터 보여야지). It is the thing that tells you sliding is possible at
     * all, so showing it only once you already slid taught nothing. A press that never travels
     * closes it again on release and stays an ordinary play/pause.
     */
    setScrub({ idx, x: anchor.x, y: anchor.y })
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPlayPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const sc = scrubRef.current
    if (!sc || sc.pointerId !== e.pointerId) return
    const dx = e.clientX - sc.startX
    if (!sc.moved && Math.abs(dx) < 10) return
    sc.moved = true
    const idx = Math.max(
      0,
      Math.min(BOOST_FACTORS.length - 1, sc.startIdx + Math.round(dx / SCRUB_STEP_PX)),
    )
    if (idx !== sc.idx || !scrub) {
      sc.idx = idx
      setScrub({ idx, x: sc.anchor.x, y: sc.anchor.y })
    }
  }
  const onPlayPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const sc = scrubRef.current
    if (!sc || sc.pointerId !== e.pointerId) return
    scrubRef.current = null
    scrubMovedRef.current = sc.moved
    if (sc.moved) {
      ui.setBoostFactor(BOOST_FACTORS[sc.idx]!)
      // let the picked chip's pop be SEEN before the row leaves
      window.setTimeout(() => setScrub(null), 420)
    } else {
      setScrub(null)
    }
  }
  const onPlayClick = () => {
    // a scrub is not a click: the press travelled, so it picked a speed instead of toggling play
    if (scrubMovedRef.current) return
    pb.toggle()
  }

  // Bottom mode badge (user 2026-08-21): always shows WHICH mode the board is in, and toggles it.
  const modeToggle = (
    <span className={styles.modeToggle} role="group" aria-label={t('mode.label')}>
      <button
        type="button"
        className={`${styles.modeSeg} ${!ui.annotate.on ? styles.modeSegOn : ''}`}
        onClick={() => ui.setAnnotateOn(false)}
        aria-pressed={!ui.annotate.on}
      >
        {t('mode.anim')}
        {ui.annotate.on && <span className={styles.kbdMini}>D</span>}
      </button>
      <button
        type="button"
        className={`${styles.modeSeg} ${ui.annotate.on ? styles.modeSegOn : ''}`}
        onClick={() => {
          ui.returnToAuthoringStart()
          ui.setAnnotateOn(true)
        }}
        aria-pressed={ui.annotate.on}
      >
        {t('mode.draw')}
        {!ui.annotate.on && <span className={styles.kbdMini}>D</span>}
      </button>
    </span>
  )

  return (
    <div
      className={styles.shell}
      data-simple="true"
      data-playing={ui.playback.playing}
      data-zen={ui.zen}
    >
      <header className={styles.top}>
        {/* The toolbar's left cell is the DOCUMENT side: which board this is, what is on it, and
            what to do to all of it. Both menus used to be a 222px column standing there all
            session for four buttons (v31). */}
        <span className={styles.topLeft}>
        <button
          type="button"
          className={styles.versionBadge}
          onClick={() => {
            navigator.clipboard?.writeText(__APP_VERSION__).catch(() => {})
            ui.flashToast(t('app.versionCopied', { v: __APP_VERSION__ }))
          }}
          title={t('app.versionCopy')}
        >
          {__APP_VERSION__}
        </button>
          <TeamMenu />
          <BoardMenu />
        </span>
        <span className={styles.headerCenter}>
          <span className={styles.brand}>{t('app.brand')}</span>
          {variants && (
            <span className={styles.modeToggle} role="group" aria-label={t('variant.label')}>
              {(['A', 'B', 'C'] as const).map((v) =>
                variants.has(v) ? (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.modeSeg} ${styles.variantSeg} ${
                      variants.activeId === v ? styles.modeSegOn : ''
                    }`}
                    onClick={() => switchVariant(v)}
                    aria-pressed={variants.activeId === v}
                    title={t('variant.switchTo', { v })}
                  >
                    {v}
                  </button>
                ) : (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.modeSeg} ${styles.variantSeg} ${styles.variantSegEmpty}`}
                    onClick={() => cloneInto(v)}
                    title={t('variant.cloneInto', { v })}
                  >
                    {v}
                    <span className={styles.variantPlus} aria-hidden="true">
                      +
                    </span>
                  </button>
                ),
              )}
            </span>
          )}
        </span>
        <span className={styles.group}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => core.undo()}
            disabled={!canUndo}
            title={`${t('topbar.undo')} (Ctrl+Z)`}
            aria-label={t('topbar.undo')}
          >
            <UiIcon name="undo" />
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => core.redo()}
            disabled={!canRedo}
            title={`${t('topbar.redo')} (Ctrl+Shift+Z)`}
            aria-label={t('topbar.redo')}
          >
            <UiIcon name="redo" />
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={theme.cycle}
            title={t('topbar.themeCycle', {
              now: t(THEME_LABEL[theme.resolved]),
              next: t(THEME_LABEL[nextTheme(theme.resolved)]),
            })}
            aria-label={`${t('topbar.theme')}: ${t(THEME_LABEL[theme.resolved])}`}
            data-theme-pref={theme.pref}
            data-theme-shown={theme.resolved}
          >
            {/* the icon names what you are LOOKING AT, and pressing shows the other one */}
            <UiIcon name={THEME_ICON[theme.resolved]} size={17} />
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.helpBtn}`}
            onClick={() => ui.setShortcutsOpen(true)}
            data-tour="tour-restart"
            title={t('topbar.help')}
            aria-label={t('topbar.help')}
          >
            <UiIcon name="help" size={17} />
          </button>
        </span>
      </header>

      <main className={styles.pitchAreaSimple}>
        <div className={styles.pitchFrame} data-boost={boosted} ref={pitchFrameRef}>
          <SimplePitch />
        </div>
        {!ui.annotate.on && <StepPanel />}
        <BoardHints />
        {/* Zen hid every surface that named the key that undoes it, so the only way back was
            knowing F already (user 2026-08-22: 다시 펼치는 F 단축키 안내가 어디에도 없어서).
            A button, not a caption — a pointer user must not need the keyboard to get out. */}
        {ui.zen && (
          <button
            type="button"
            className={styles.zenExit}
            onClick={() => ui.setZen(false)}
            title={KEYMAP.playback.zen.hint}
          >
            <span className={styles.kbd}>{KEYMAP.playback.zen.label}</span>
            {t('zen.exit')}
          </button>
        )}
        {boosted ? (
          <div className={styles.speedPill} role="status" aria-live="polite">
            <UiIcon name="fastForward" size={14} filled />
            <span className={styles.speedPillRate}>{speedFactor(ui.playback.speed)}×</span>
            <span>{t('tl.boost')}</span>
          </div>
        ) : (
          ui.playback.playing && (
            <div className={styles.speedHintPill} aria-hidden="true">
              <UiIcon name="fastForward" size={12} filled />
              <span>
                <span className={styles.speedHintKbd}>{KEYMAP.playback.boost.label}</span>
                {t('tl.boostInvite', { n: ui.boostFactor })}
              </span>
            </div>
          )
        )}
        {/* An authoring form has no business being the brightest object on the board while the play
            runs — and the boost pill is anchored to the same top-centre slot, so it landed across
            the name field (lab review, 2026-08-24). Playback owns the board; the inspector waits. */}
        {!ui.playback.playing &&
          (ui.selectedSegmentId ? <SelectionActionBar /> : <PlayerCard />)}
        {errors.length > 0 && (
          <div className={styles.emptyHint} role="alert">
            ⚠ {t('tl.issue.cycle')}
          </div>
        )}
      </main>

      <footer className={styles.bottomWrap}>
        {ui.annotate.on ? (
          /* Draw bar (PLAN-008 D-01): replaces the playback bar while the pen owns the pitch. */
          <div className={styles.simpleBar}>
            {modeToggle}
            <span className={styles.barDivider} aria-hidden="true" />
            <span className={styles.barGroup}>
              {[
                {
                  tool: 'select' as const,
                  icon: 'cursor' as const,
                  key: 'V',
                  label: t('draw.select'),
                },
                { tool: 'pen' as const, icon: 'pen' as const, key: 'P', label: t('draw.pen') },
                {
                  tool: 'eraser' as const,
                  icon: 'eraser' as const,
                  key: 'E',
                  label: t('draw.eraser'),
                },
              ].map((d) => (
                <span key={d.tool} className={styles.toolCol}>
                  <span className={styles.toolKey} aria-hidden="true">
                    {d.key}
                  </span>
                  <button
                    type="button"
                    className={`${styles.btn} ${ui.annotate.tool === d.tool ? styles.btnActive : ''}`}
                    onClick={() => ui.setAnnotate({ tool: d.tool })}
                    title={`${d.label} (${d.key})`}
                    aria-label={d.label}
                    aria-pressed={ui.annotate.tool === d.tool}
                  >
                    <UiIcon name={d.icon} />
                  </button>
                </span>
              ))}
            </span>
            <span className={styles.barDivider} aria-hidden="true" />
            {/* VIC 그림판식 2줄 색 트레이(17색) + 마지막 칸 '직접 고르기'(네이티브 색상판) */}
            <span className={styles.colorTray} role="group" aria-label={t('draw.colors')}>
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorCell} ${ui.annotate.color === c ? styles.colorCellOn : ''}`}
                  style={{ background: c }}
                  onClick={() => ui.setAnnotate({ color: c, tool: 'pen' })}
                  title={t('draw.color', { c })}
                  aria-label={t('draw.color', { c })}
                  aria-pressed={ui.annotate.color === c}
                />
              ))}
              <span className={styles.colorCustomWrap}>
                <button
                  type="button"
                  ref={customCellRef}
                  className={`${styles.colorCell} ${styles.colorCustom} ${
                    PEN_COLORS.includes(ui.annotate.color) ? '' : styles.colorCellOn
                  }`}
                  title={t('draw.customColor')}
                  aria-label={t('draw.customColor')}
                  style={
                    PEN_COLORS.includes(ui.annotate.color)
                      ? undefined
                      : { background: ui.annotate.color }
                  }
                  onClick={() => setColorPickerOpen((o) => !o)}
                />
                {colorPickerOpen && (
                  <ColorPicker
                    color={ui.annotate.color}
                    onChange={(c) => ui.setAnnotate({ color: c, tool: 'pen' })}
                    onClose={() => setColorPickerOpen(false)}
                    anchorRef={customCellRef}
                  />
                )}
              </span>
            </span>
            <span className={styles.barDivider} aria-hidden="true" />
            <span className={styles.barGroup}>
              {PEN_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`${styles.btn} ${styles.swatchBtn} ${
                    ui.annotate.width === w ? styles.btnActive : ''
                  }`}
                  onClick={() => ui.setAnnotate({ width: w, tool: 'pen' })}
                  title={t('draw.width', { w })}
                  aria-label={t('draw.width', { w })}
                  aria-pressed={ui.annotate.width === w}
                >
                  <span
                    className={styles.widthDot}
                    style={{
                      width: Math.min(20, 3 + w),
                      height: Math.min(20, 3 + w),
                    }}
                  />
                </button>
              ))}
            </span>
            <span className={styles.barDivider} aria-hidden="true" />
            <span className={styles.barGroup}>
              <button
                type="button"
                className={styles.btn}
                disabled={doc.drawings.length === 0}
                onClick={() => {
                  const n = doc.drawings.length
                  removeDrawings(
                    core,
                    doc.drawings.map((d) => d.id),
                  )
                  ui.flashToast(t('draw.cleared', { n }))
                }}
                title={t('draw.clearAll')}
                aria-label={t('draw.clearAll')}
              >
                <UiIcon name="trash" />
              </button>
            </span>
          </div>
        ) : (
          <div className={styles.simpleBar}>
            {modeToggle}
            <span className={styles.barDivider} aria-hidden="true" />
            <span className={styles.barGroup}>
              <span className={`${styles.toolCol} ${styles.playCol}`}>
                {/* Names its own key like Home and G. Once the play is RUNNING it names the hold
                    instead — that is the only moment the boost is discoverable. */}
                <span className={styles.toolKey} aria-hidden="true">
                  {ui.playback.playing ? KEYMAP.playback.boost.label : KEYMAP.playback.toggle.label}
                </span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.playBtn} ${scrub ? styles.playBtnScrub : ''}`}
                  onClick={onPlayClick}
                  onPointerDown={onPlayPointerDown}
                  onPointerMove={onPlayPointerMove}
                  onPointerUp={onPlayPointerUp}
                  onPointerCancel={onPlayPointerUp}
                  data-tour="play"
                  data-boost={boosted}
                  data-boost-factor={ui.boostFactor}
                  title={
                    boosted
                      ? t('tl.boostTitle', { n: speedFactor(ui.playback.speed) })
                      : `${ui.playback.playing ? t('tl.pause') : t('tl.play')} (Space) · ${KEYMAP.playback.boost.label} = ${KEYMAP.playback.boost.hint}`
                  }
                  aria-label={ui.playback.playing ? t('tl.pause') : t('tl.play')}
                >
                  {boosted ? (
                    <UiIcon name="fastForward" size={18} filled />
                  ) : ui.playback.playing ? (
                    <UiIcon name="pause" size={18} />
                  ) : (
                    <UiIcon name="play" size={18} filled />
                  )}
                </button>
              </span>
              <span className={styles.toolCol}>
                <span className={styles.toolKey} aria-hidden="true">
                  Home
                </span>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={pb.restart}
                  title={`${t('tl.restart')} (Home)`}
                  aria-label={t('tl.restart')}
                >
                  <UiIcon name="home" />
                </button>
              </span>
              <span className={styles.toolCol}>
                <span className={styles.toolKey} aria-hidden="true">
                  G
                </span>
                <button
                  type="button"
                  className={`${styles.btn} ${ui.playback.loop ? styles.btnActive : ''}`}
                  onClick={() => ui.setLoop(!ui.playback.loop)}
                  title={`${t('tl.loop')} (G)`}
                  aria-label={t('tl.loop')}
                  aria-pressed={ui.playback.loop}
                >
                  <UiIcon name="loop" size={15} />
                </button>
              </span>
              <span className={styles.toolCol}>
                {/* the slot above a transport button names its KEY. "GIF" is a file format, and
                    styling it like Space/Home/G taught a shortcut that does not exist (craft
                    review, 2026-08-24) — the button says 내보내기 and its tooltip says the rest. */}
                <span className={styles.toolKey} aria-hidden="true" />
                <button
                  type="button"
                  className={`${styles.btn} ${styles.gifBtn}`}
                  onClick={exportPlayGif}
                  disabled={gifBusy || playEnd < 0.3}
                  title={t('gif.button')}
                  aria-label={t('gif.button')}
                >
                  {gifBusy ? '…' : '내보내기'}
                </button>
              </span>
            </span>
            <span className={styles.barDivider} aria-hidden="true" />
            <StepBar />
          </div>
        )}
      </footer>

      {ui.toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {ui.toast}
        </div>
      )}
      {scrub && (
        <span
          className={styles.speedScrub}
          role="status"
          aria-live="polite"
          style={{ left: scrub.x, top: scrub.y }}
        >
          {BOOST_FACTORS.map((f, i) => (
            <span
              key={f}
              className={`${styles.speedScrubOpt} ${i === scrub.idx ? styles.speedScrubOptOn : ''}`}
            >
              {f}×
            </span>
          ))}
        </span>
      )}
      <ShortcutsOverlay />
      <TourOverlay />
    </div>
  )
}
