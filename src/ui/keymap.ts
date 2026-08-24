/**
 * Simple-mode bindings (ADR-0009 v2) — shown in the right side panel and the ? overlay.
 * The mouse does the authoring; the keyboard only plays, deletes and undoes.
 */
import type { Cue } from './cueHighlight'

export interface Binding {
  key?: string
  label: string
  hint: string
  /**
   * Shown in the always-visible 조작법 panel. The panel is a standing reminder, not a manual, so
   * it carries only what the board itself cannot tell you (user 2026-08-21) — anything already
   * printed on the left panel's buttons, or obvious from dragging, is left to the ? overlay,
   * which keeps the FULL reference.
   */
  compact?: boolean
  /**
   * The label is a literal KEY, so it is drawn as a keycap. Gestures ("경로 드래그") are drawn as
   * plain text: capping them made the panel a wall of mismatched pills with no straight edge
   * anywhere (user 2026-08-22: 정렬 없이 너무 들쭉날쭉). One rule — keycaps are for keys.
   */
  chip?: boolean
  /**
   * Which states this row belongs to. While the user is in ANY of them — Ctrl held, the play
   * running, the ball selected, a movement being edited — the row lights up, so the panel answers
   * what you are doing instead of listing everything at one volume (user 2026-08-22).
   *
   * A list, because a row can belong to more than one: drawing from a faded token is both an Alt
   * gesture and part of editing a movement, and it should light either way.
   */
  cues?: readonly Cue[]
  /**
   * The gesture only exists while this preference is ON. A standing panel that teaches a gesture
   * the board will not perform is worse than silence, so the row goes with the feature.
   */
  flag?: 'ballFling'
}

/** Does this row belong to any state the user is currently in? */
export function isCued(b: Binding, active: ReadonlySet<Cue>): boolean {
  return !!b.cues?.some((c) => active.has(c))
}

/** Drop the rows whose feature is switched off. Pure. */
export function visibleBindings(
  list: readonly Binding[],
  flags: { ballFling: boolean },
): Binding[] {
  return list.filter((b) => !b.flag || flags[b.flag])
}

export const KEYMAP = {
  playback: {
    toggle: { key: ' ', label: 'Space', hint: '처음부터 재생·정지', chip: true, cues: ['space'] },
    // its own row, not a tail on the Space hint — the hold was undiscoverable buried there
    // (user 2026-08-21: space 꾹 누르는 키도 안내하게)
    // one line beside its keycap — a wrapped hint hangs indented under the cap and breaks the
    // card's single left edge (user 2026-08-22: 들여쓰기가 됐잖아). Where the factor is picked is
    // its own GESTURE row below, in the stacked layout gestures already use.
    boost: {
      key: ' ',
      label: 'Space 꾹',
      hint: '배속 재생',
      chip: true,
      cues: ['space'],
    },
    restart: { key: 'Home', label: 'Home', hint: '처음으로', chip: true, cues: ['space'] },
    loop: { key: 'g', label: 'G', hint: '반복', chip: true, cues: ['space'] },
    zen: { key: 'f', label: 'F', hint: '패널 접기·펴기', chip: true },
  },
  edit: {
    undo: { label: 'Ctrl+Z', hint: '실행 취소' },
    redo: { label: 'Ctrl+Shift+Z / Ctrl+Y', hint: '다시 실행' },
    del: { label: 'Delete', hint: '선택한 것 삭제' },
    esc: { label: 'Esc', hint: '취소 / 선택 해제' },
    // Two keys, two jobs (ADR-0009 v28). The bare number LOOKS; it used to also re-file whatever
    // movement was selected, and reading a finished tactic step by step then rewrote it
    // (user 2026-08-24: 계속 누르니까 단계들이 서로 섞여서 보임).
    step: { label: '1~9', hint: '그 단계 보기' },
    stepAll: { label: '0', hint: '전체 보기' },
    moveStep: { label: 'Shift+1~9', hint: '선택한 경로를 그 단계로 옮기기' },
    clearAll: { label: 'X', hint: '움직임 전체 지우기' },
    reset: { label: 'Shift+R', hint: '새로 시작 (전체 초기화)' },
  },
} as const

/** 배치 (always available). */
export const PLACE_BINDINGS: Binding[] = [
  { label: 'Ctrl+좌클릭', hint: '우리팀 선수 추가' },
  { label: 'Ctrl+우클릭', hint: '상대팀 선수 추가' },
  /*
   * The hint has to name what CHANGES, not just who moves. Dragging a starting spot means two
   * different things depending on how many are selected — one token stretches its first leg and
   * leaves everything downstream where it was; a group carries the whole chain — and the panel
   * said only "여러 명이면 같이", which reads as "the players come along" and says nothing about
   * the paths (user 2026-08-25: 왜 어쩔 땐 전체 단계가 움직이고 어쩔 땐 0단계만 움직여). Both
   * behaviours are wanted and were each asked for: ADR-0009 v16b settles it by selection size, and
   * `pw/home-drag` holds the contract in metres.
   */
  { label: '드래그', hint: '한 명 = 시작점만 · 여러 명 = 경로까지 통째로' },
  { label: '빈 잔디 드래그', hint: '박스로 여러 명 선택' },
  { label: 'Shift+잔디 드래그', hint: '선택에 더하기', compact: true, cues: ['shift'] },
  { label: 'Ctrl+선수 클릭', hint: '선택에 넣기·빼기', cues: ['ctrl'] },
  /*
   * NO "클릭 = 대상 고르기" row. Clicking a thing to work on it is the one gesture nobody has to
   * be told, and spending the panel's scarcest space on it pushed the rows that DO teach something
   * off the fold (user 2026-08-22: 클릭 설명은 뭐하러 둔거야).
   */
  { label: '겹친 곳 다시 클릭', hint: '차례로 고르기', compact: true },
  { label: '공 → 선수 드롭', hint: '그 선수가 공 보유', cues: ['ball'] },
  {
    label: '공 휙 던지기',
    hint: '빠르게 놓으면 굴러감',
    compact: true,
    cues: ['ball'],
    flag: 'ballFling',
  },
  { label: '공 더블클릭+드래그', hint: '당긴 반대로 발사', compact: true, cues: ['ball'] },
  { label: '선수 클릭', hint: '등번호·이름 편집', compact: true, cues: ['player'] },
]

/**
 * 경로 그리기·다듬기·재생 — ONE grammar (2026-08-22 대개편): a click picks the SUBJECT (any token,
 * live or faded), Alt+click sends it to the clicked point. Aiming at a faded token is a destination
 * MOMENT: the ball arrives exactly when that movement does. The old list said the same thing twice
 * (once for tokens, once for faded tokens) because faded tokens used to be a special state — they
 * no longer are, so the rows halved (user: 단축키 설명만 봐도 2배가 되어있잖아).
 */
export const ANIM_BINDINGS: Binding[] = [
  /*
   * ONE row for the drawing gesture, not two (user 2026-08-24: 걍 Alt + 클릭/드래그 로 합치고).
   * Click and drag were separate rows because they produce different SHAPES — a straight leg and a
   * curve. But the panel is read to answer "how do I draw a path", and the answer is one modifier
   * on one subject; which shape comes out is what the hand already decides. Two rows spent the
   * fold on a distinction nobody has to be told, and the hints narrated the MECHANISM
   * ("잔상은 그 타이밍") instead of naming the action.
   *
   * 경로 드래그 sits directly under it (user: 바로 아래에 위치해줘) — bending the line you
   * just drew is the next thing you do, so it belongs beside drawing it, not after the rows about
   * picking an existing one.
   */
  {
    label: 'Alt+클릭/드래그',
    hint: '경로 지정',
    compact: true,
    cues: ['alt', 'ball', 'player', 'path'],
  },
  { label: '경로 드래그', hint: '당겨서 휘기', compact: true, cues: ['path'] },
  { label: '잔상 드래그', hint: '도착 지점 조정', compact: true, cues: ['path'] },
  // Each key says what it DOES. "선택 — Delete·Shift+숫자" named two keys and left the reader to
  // guess which one deletes and which one re-files (user 2026-08-24).
  {
    label: '경로 선택',
    hint: 'Delete - 삭제/Shift+숫자 - 변경',
    compact: true,
    cues: ['path'],
  },
  { label: '단계 0~9', hint: '0 전체 / 1~9 그 단계 (그릴 때는 같은 번호는 같이, 다음 번호는 이어서)' },
]

/** 자유 그리기(주석) — PLAN-008. */
export const DRAW_BINDINGS: Binding[] = [
  { label: 'D', hint: '그리기 모드 켜기/끄기 (하단 바가 그리기 바로 전환)', chip: true },
  { label: 'V / P / E', hint: '선택(선수·공 이동) / 펜 / 지우개', chip: true },
  { label: '드래그', hint: '펜: 자유 곡선 · 지우개: 스친 획 통째 삭제' },
  { label: 'Ctrl+Z', hint: '획 하나 되돌리기', chip: true },
  { label: 'Delete', hint: '선택 도구로 고른 선수 삭제 (V로 선택 도구)', chip: true },
]

/**
 * What the always-visible 조작법 panel shows (user 2026-08-21: 아래만으로 걸러줘). Ctrl+클릭 팀
 * 추가, 잔디 드래그 선택, Ctrl+Z, Delete 등은 왼쪽 패널 버튼과 힌트가 이미 말해 주므로 뺐다.
 * 전체 목록은 `KEYMAP_GROUPS`(? 오버레이)가 계속 들고 있다.
 */
/**
 * The Ctrl chords, boxed together in the left panel (user 2026-08-22: Ctrl 삼형제 따로 묶어서).
 * Scattered under the team and cleanup buttons they read as footnotes to those buttons; together
 * they read as what they are — the modifier's own vocabulary.
 */
export const CTRL_BINDINGS: Binding[] = [
  { label: 'Ctrl+좌클릭', hint: '우리팀 선수 추가', chip: true, cues: ['ctrl'] },
  { label: 'Ctrl+우클릭', hint: '상대팀 선수 추가', chip: true, cues: ['ctrl'] },
  { label: 'Ctrl+Z', hint: '되돌리기', chip: true, cues: ['ctrl'] },
]

export const GUIDE_PLACE_BINDINGS: Binding[] = PLACE_BINDINGS.filter((b) => b.compact)
export const GUIDE_ANIM_BINDINGS: Binding[] = ANIM_BINDINGS.filter((b) => b.compact)
export const GUIDE_PLAY_BINDINGS: Binding[] = [
  KEYMAP.playback.toggle,
  KEYMAP.playback.boost,
  // no ▶ glyph: it means "play" everywhere else in the app, and this row is a drag, not a button
  { label: '재생 버튼 좌우 드래그', hint: '꾹 눌러서 배속 선택', cues: ['space'] },
  KEYMAP.playback.zen,
]

export const KEYMAP_GROUPS: { title: string; items: Binding[] }[] = [
  { title: '배치', items: PLACE_BINDINGS },
  { title: '경로 그리기·다듬기', items: ANIM_BINDINGS },
  { title: '자유 그리기', items: DRAW_BINDINGS },
  { title: '재생', items: Object.values(KEYMAP.playback) },
  { title: '편집', items: Object.values(KEYMAP.edit) },
]
