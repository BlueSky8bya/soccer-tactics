import { createEmptyDocument } from '@/domain'
import { compile } from '@/engine/compile'
import { applyFormations, seedDefaultTeams } from '@/editor/commands'
import { replaceDocument } from '@/editor/moreCommands'
import { clearAllMovements } from '@/editor/stepCommands'
import { playableEnd, playWindow } from '@/editor/usePlayback'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { FORMATIONS } from '@/presets/formations'
import { SCENARIOS } from '@/presets/scenarios'
import { SelectMenu } from './SelectMenu'
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
  const formationSelect = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    color?: string,
  ) => (
    <label className={styles.panelField}>
      <span className={styles.teamName}>
        {color && <span className={styles.teamDotSmall} style={{ background: color }} />}
        {label}
      </span>
      <SelectMenu
        value={value}
        options={FORMATIONS.map((f) => ({ id: f.id }))}
        onChange={onChange}
        ariaLabel={label}
      />
    </label>
  )
  return (
    <aside className={styles.sideLeft} aria-label={t('panel.actions')}>
      <div className={styles.panelCard}>
        <div className={styles.sectionLabel}>{t('panel.team')}</div>
        {formationSelect(homeF, setHomeF, home?.name ?? 'Home', home?.color)}
        {formationSelect(awayF, setAwayF, away?.name ?? 'Away', away?.color)}
        <button
          type="button"
          className={`${styles.btn} ${styles.panelBtn} ${styles.btnTintBlue} ${styles.panelPrimary}`}
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
        <div className={styles.panelHintLine}>
          <span className={styles.kbd}>Ctrl+좌클릭</span>
          <span>{t('panel.hintHomeDo')}</span>
        </div>
        <div className={styles.panelHintLine}>
          <span className={styles.kbd}>Ctrl+우클릭</span>
          <span>{t('panel.hintAwayDo')}</span>
        </div>
      </div>

      <div className={styles.panelCard}>
        <div className={styles.sectionLabel}>{t('panel.cleanup')}</div>
        <button
          type="button"
          className={`${styles.btn} ${styles.panelBtn} ${styles.btnQuietDanger}`}
          onClick={() => {
            const n = clearAllMovements(core)
            flashToast(n > 0 ? t('panel.clearAllDone', { n }) : t('panel.clearHint'))
          }}
          title={`${t('panel.clearAll')} (X)`}
        >
          ⌫ {t('panel.clearAll')}
          <span className={styles.btnKbd}>X</span>
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.panelBtn} ${styles.btnQuietDanger}`}
          onClick={() => {
            replaceDocument(
              core,
              seedDefaultTeams(createEmptyDocument({ title: t('doc.untitled') })),
            )
            const u = useUiStore.getState()
            u.clearSelection()
            u.returnToAuthoringStart()
          }}
          title={`${t('panel.reset')} (Shift+R)`}
        >
          🗑 {t('panel.reset')}
          <span className={styles.btnKbd}>⇧R</span>
        </button>
        <div className={styles.panelHintLine}>
          <span className={styles.kbd}>Ctrl+Z</span>
          <span>{t('panel.undoDo')}</span>
        </div>
      </div>

      <div className={styles.panelCard}>
        <div className={styles.sectionLabel}>{t('panel.examples')}</div>
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.btn} ${styles.panelBtn}`}
            title={s.description}
            onClick={() => {
              const next = s.build()
              replaceDocument(core, next)
              useUiStore.getState().clearSelection()
              // Load-and-play: the preset's point IS the animation, so it starts right away.
              playWindow('all', 0, playableEnd(compile(next)))
              flashToast(t('panel.exampleLoaded', { name: s.name }))
            }}
          >
            ▶ {s.name}
          </button>
        ))}
        <div className={styles.panelHintLine}>
          <span className={styles.kbd}>Ctrl+Z</span>
          <span>{t('panel.exampleUndoHint')}</span>
        </div>
      </div>
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
