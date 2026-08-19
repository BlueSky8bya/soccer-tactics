import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import { KEYMAP, KEYMAP_GROUPS, type Binding } from './keymap'
import styles from './shell.module.css'

const TOOL_TIPS: Record<string, { title: string; items: Binding[] }> = {
  select: {
    title: '선택 / 이동',
    items: [
      KEYMAP.mouse.altDrag,
      KEYMAP.mouse.pathScrub,
      KEYMAP.mouse.fling,
      KEYMAP.mouse.marquee,
      KEYMAP.mouse.toggleSelect,
      KEYMAP.mouse.ctrlDrag,
      KEYMAP.mouse.dropBall,
      KEYMAP.mouse.dragAtTime,
    ],
  },
  'add-player': {
    title: '선수 추가',
    items: [
      { key: '', label: '필드 클릭', hint: '활성 팀 선수 추가' },
      KEYMAP.tools.team1,
      KEYMAP.tools.team2,
    ],
  },
  path: {
    title: '경로 그리기',
    items: [
      { key: '', label: '선수 위 드래그', hint: '이동 (시작 = 재생 위치)' },
      { key: '', label: '공 선택 후 드래그', hint: '패스 (끝점 선수가 받음 · 도착 시각으로 이동)' },
      KEYMAP.mouse.shiftDraw,
      { key: '', label: '경로 클릭', hint: '점 드래그로 수정' },
      KEYMAP.edit.cancel,
    ],
  },
  zone: { title: '구역', items: [{ key: '', label: '드래그', hint: '사각형 · Shift: 타원' }] },
  arrow: { title: '화살표', items: [{ key: '', label: '드래그', hint: '화살표' }] },
  text: { title: '텍스트', items: [{ key: '', label: '클릭', hint: '입력 후 Enter' }] },
}

/** Docked help (bottom of the right column): current-tool tips, then the full keymap. Collapsible, remembered. */
export function HelpPanel() {
  const open = useUiStore((s) => s.helpOpen)
  const setOpen = useUiStore((s) => s.setHelpOpen)
  const tool = useUiStore((s) => s.tool)
  const tip = TOOL_TIPS[tool] ?? TOOL_TIPS.select!

  const row = (b: Binding, i: number) => (
    <div key={b.label + i} className={styles.helpRow}>
      <span className={styles.kbd}>{b.label}</span>
      <span>{b.hint}</span>
    </div>
  )

  return (
    <section className={styles.help} aria-label={t('help.title')}>
      <button
        type="button"
        className={styles.helpHead}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>⌨ {t('help.title')}</span>
        <span className={styles.muted}>{open ? '⌄' : '⌃'}</span>
      </button>
      {open && (
        <div className={styles.helpBody}>
          <div>
            <div className={styles.helpGroupTitle}>
              {t('help.now')} · {tip.title}
            </div>
            {tip.items.map(row)}
          </div>
          {KEYMAP_GROUPS.filter((g) => g.title !== '마우스 + 모디파이어').map((g) => (
            <div key={g.title}>
              <div className={styles.helpGroupTitle}>{g.title}</div>
              {g.items.map(row)}
            </div>
          ))}
          <button
            type="button"
            className={styles.btn}
            onClick={() => useUiStore.getState().setShortcutsOpen(true)}
          >
            {t('help.all')} <span className={styles.kbd}>?</span>
          </button>
        </div>
      )}
    </section>
  )
}
