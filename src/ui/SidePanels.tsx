import { createEmptyDocument } from '@/domain'
import { applyFormations, seedDefaultTeams } from '@/editor/commands'
import { replaceDocument } from '@/editor/moreCommands'
import { clearAllMovements } from '@/editor/stepCommands'
import { useEditor, useEditorSnapshot } from '@/editor/EditorContext'
import { FORMATIONS } from '@/presets/formations'
import { SelectMenu } from './SelectMenu'
import { useState } from 'react'
import { useUiStore } from '@/editor/uiStore'
import { t } from './i18n'
import {
  CTRL_BINDINGS,
  GUIDE_ANIM_BINDINGS,
  GUIDE_PLACE_BINDINGS,
  GUIDE_PLAY_BINDINGS,
  isCued,
  visibleBindings,
  type Binding,
} from './keymap'
import { useActiveCues } from './useActiveCues'
import styles from './shell.module.css'

/** Left panel: the feature buttons (always visible). */
export function ActionsPanel() {
  const cues = useActiveCues()
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
      </div>

      {/* The three Ctrl chords in one box (user 2026-08-22): they were scattered across the team
          and cleanup cards, where they read as footnotes to those buttons rather than as the
          keyboard's own vocabulary. */}
      <div className={styles.panelCard}>
        <div className={styles.sectionLabel}>{t('panel.ctrl')}</div>
        <div className={styles.shortcutList}>
          {CTRL_BINDINGS.map((b) => (
            <ShortcutRow key={b.label} b={b} active={isCued(b, cues)} />
          ))}
        </div>
      </div>

      {/* Playback keys live here, not in the right-hand 조작법 panel: this column had the room
          once the example card went, and the play controls are what a first-timer reaches for
          (user 2026-08-21: 빈 공간인 왼쪽 사이드바에 넣어줘). */}
      <div className={styles.panelCard}>
        <div className={styles.sectionLabel}>{t('tl.play')}</div>
        <div className={styles.shortcutList}>
          {GUIDE_PLAY_BINDINGS.map((b) => (
            <ShortcutRow key={b.label} b={b} active={isCued(b, cues)} />
          ))}
        </div>
      </div>
    </aside>
  )
}

/**
 * ONE shortcut row for every panel.
 *
 * The two columns used to disagree: the left one laid the keycap inline with its hint, the right
 * one stacked a keycap over its hint and hairlined every row. Both capped GESTURES ("경로 드래그")
 * as if they were keys, so no two rows started at the same x and the panel read as a heap of
 * pills (user 2026-08-22: 정렬 없이 너무 들쭉날쭉 · 조잡함).
 *
 * The rule now: a keycap is for a KEY. Gestures are plain text. Label and hint both start at the
 * card's left edge, so every row shares one straight edge, and rhythm does the separating instead
 * of a hairline under each line.
 */
export function ShortcutRow({ b, active }: { b: Binding; active?: boolean }) {
  // A keycap is a compact token and reads inline; a gesture is a phrase and needs its own line.
  // One rule, and it also buys back the height the stacked-everything version cost — the left
  // column ran off the bottom of a 900px window with its last hint cut in half.
  return (
    <div
      className={`${b.chip ? styles.shortcutRowInline : styles.shortcutRow} ${
        active ? styles.shortcutRowOn : ''
      }`}
    >
      {b.chip ? (
        <span className={styles.kbd}>{b.label}</span>
      ) : (
        <span className={styles.shortcutLabel}>{b.label}</span>
      )}
      <span className={styles.shortcutHint}>{b.hint}</span>
    </div>
  )
}

/** Right panel: always-visible gesture guide, split by mode. */
export function GuidePanel() {
  const cues = useActiveCues()
  const ballFling = useUiStore((s) => s.ballFling)
  return (
    <aside className={styles.sideRight} aria-label={t('panel.guide')}>
      <div className={styles.panelCard}>
        <div className={styles.sectionLabel}>{t('panel.place')}</div>
        <div className={styles.shortcutList}>
          {visibleBindings(GUIDE_PLACE_BINDINGS, { ballFling }).map((b) => (
            <ShortcutRow key={b.label} b={b} active={isCued(b, cues)} />
          ))}
        </div>
      </div>
      <div className={styles.panelCard}>
        <div className={styles.sectionLabel}>{t('panel.anim')}</div>
        <div className={styles.shortcutList}>
          {GUIDE_ANIM_BINDINGS.map((b) => (
            <ShortcutRow key={b.label} b={b} active={isCued(b, cues)} />
          ))}
        </div>
      </div>
    </aside>
  )
}
