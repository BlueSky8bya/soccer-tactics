import { createEmptyDocument } from '@/domain'
import { applyFormations, placeBallCenter, seedDefaultTeams } from '@/editor/commands'
import { replaceDocument } from '@/editor/moreCommands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { useUiStore } from '@/editor/uiStore'
import { AutoReactPanel } from './AutoReactPanel'
import { t } from './i18n'
import { ANIM_BINDINGS, KEYMAP, PLACE_BINDINGS, type Binding } from './keymap'
import styles from './shell.module.css'

/** Left panel: the feature buttons (always visible). */
export function ActionsPanel() {
  const core = useEditor()
  const { doc } = useEditorSnapshot()
  const flashToast = useUiStore((s) => s.flashToast)
  const home = doc.teams[0]
  const away = doc.teams[1]
  return (
    <aside className={styles.sideLeft} aria-label={t('panel.actions')}>
      <div className={styles.sectionLabel}>{t('panel.actions')}</div>
      <button
        type="button"
        className={`${styles.btn} ${styles.panelBtn}`}
        onClick={() => {
          const picks = [
            home ? { teamId: home.id, formationId: '4-3-3' } : null,
            away ? { teamId: away.id, formationId: '4-4-2' } : null,
          ].filter((x): x is { teamId: string; formationId: string } => !!x)
          if (picks.length) applyFormations(core, picks)
        }}
        title={`${home?.name ?? 'Home'} 4-3-3 · ${away?.name ?? 'Away'} 4-4-2`}
        data-tour="fill"
      >
        ⚽ {t('panel.fill')}
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.panelBtn}`}
        onClick={() => {
          placeBallCenter(core)
          flashToast(t('panel.ball'))
        }}
        data-tour="ball-btn"
      >
        ● {t('panel.ball')}
      </button>
      <AutoReactPanel />
      <button
        type="button"
        className={`${styles.btn} ${styles.panelBtn}`}
        onClick={() => {
          replaceDocument(core, seedDefaultTeams(createEmptyDocument({ title: t('doc.untitled') })))
          const u = useUiStore.getState()
          u.clearSelection()
          u.setPlaying(false)
          u.setPlayhead(0)
        }}
      >
        🗑 {t('panel.reset')}
      </button>
      <div className={styles.muted}>{t('panel.clearHint')}</div>
    </aside>
  )
}

function Row({ b }: { b: Binding }) {
  return (
    <div className={styles.guideRow}>
      <span className={styles.kbd}>{b.label}</span>
      <span>{b.hint}</span>
    </div>
  )
}

/** Right panel: always-visible gesture guide, split by mode. */
export function GuidePanel() {
  const animMode = useUiStore((s) => s.animMode)
  return (
    <aside className={styles.sideRight} aria-label={t('panel.guide')}>
      <div className={styles.sectionLabel}>{t('panel.guide')}</div>
      <div className={styles.guideGroup}>
        <div className={styles.guideTitle}>{t('panel.place')}</div>
        {PLACE_BINDINGS.map((b) => (
          <Row key={b.label} b={b} />
        ))}
      </div>
      <div className={`${styles.guideGroup} ${animMode ? '' : styles.guideDim}`}>
        <div className={styles.guideTitle}>
          🎬 {t('panel.anim')} {animMode ? '' : '(꺼짐)'}
        </div>
        {!animMode && <div className={styles.muted}>{t('panel.animOffNote')}</div>}
        {ANIM_BINDINGS.map((b) => (
          <Row key={b.label} b={b} />
        ))}
      </div>
      <div className={styles.guideGroup}>
        <div className={styles.guideTitle}>{t('tl.play')}</div>
        <Row b={KEYMAP.playback.toggle} />
        <Row b={KEYMAP.edit.undo} />
        <Row b={KEYMAP.edit.del} />
      </div>
    </aside>
  )
}
