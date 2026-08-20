import { createEmptyDocument } from '@/domain'
import { applyFormations, placeBallCenter, seedDefaultTeams } from '@/editor/commands'
import { replaceDocument } from '@/editor/moreCommands'
import { clearAllMovements } from '@/editor/stepCommands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { FORMATIONS } from '@/presets/formations'
import { useState } from 'react'
import { useUiStore } from '@/editor/uiStore'
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
  const [homeF, setHomeF] = useState('4-3-3')
  const [awayF, setAwayF] = useState('4-4-2')
  const formationSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <label className={styles.panelField}>
      <span>{label}</span>
      <select
        className={styles.panelSelect}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {FORMATIONS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.id}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <aside className={styles.sideLeft} aria-label={t('panel.actions')}>
      <div className={styles.sectionLabel}>{t('panel.actions')}</div>
      {formationSelect(homeF, setHomeF, home?.name ?? 'Home')}
      {formationSelect(awayF, setAwayF, away?.name ?? 'Away')}
      <button
        type="button"
        className={`${styles.btn} ${styles.panelBtn}`}
        onClick={() => {
          const picks = [
            home ? { teamId: home.id, formationId: homeF } : null,
            away ? { teamId: away.id, formationId: awayF } : null,
          ].filter((x): x is { teamId: string; formationId: string } => !!x)
          if (picks.length) applyFormations(core, picks)
        }}
        title={`${home?.name ?? 'Home'} ${homeF} · ${away?.name ?? 'Away'} ${awayF}`}
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
      <button
        type="button"
        className={`${styles.btn} ${styles.panelBtn}`}
        onClick={() => {
          const n = clearAllMovements(core)
          flashToast(n > 0 ? t('panel.clearAllDone', { n }) : t('panel.clearHint'))
        }}
        title={t('panel.clearAll')}
      >
        ⌫ {t('panel.clearAll')}
      </button>
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
      <span className={styles.guideHint}>{b.hint}</span>
    </div>
  )
}

/** Right panel: always-visible gesture guide, split by mode. */
export function GuidePanel() {
  return (
    <aside className={styles.sideRight} aria-label={t('panel.guide')}>
      <div className={styles.sectionLabel}>{t('panel.guide')}</div>
      <div className={styles.guideGroup}>
        <div className={styles.guideTitle}>{t('panel.place')}</div>
        {PLACE_BINDINGS.map((b) => (
          <Row key={b.label} b={b} />
        ))}
      </div>
      <div className={styles.guideGroup}>
        <div className={styles.guideTitle}>{t('panel.anim')}</div>
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
