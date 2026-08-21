/**
 * Simple-mode bindings (ADR-0009 v2) — shown in the right side panel and the ? overlay.
 * The mouse does the authoring; the keyboard only plays, deletes and undoes.
 */
import { BOOST_FACTOR } from '@/editor/playbackRates'

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
}

export const KEYMAP = {
  playback: {
    toggle: { key: ' ', label: 'Space', hint: '재생 / 일시정지', chip: true },
    // its own row, not a tail on the Space hint — the hold was undiscoverable buried there
    // (user 2026-08-21: space 꾹 누르는 키도 안내하게)
    boost: {
      key: ' ',
      label: 'Space 꾹',
      hint: `누르는 동안 ${BOOST_FACTOR}배속`,
      chip: true,
    },
    restart: { key: 'Home', label: 'Home', hint: '처음으로', chip: true },
    loop: { key: 'g', label: 'G', hint: '반복', chip: true },
    zen: { key: 'f', label: 'F', hint: '패널 숨기기 / 되돌리기', chip: true },
  },
  edit: {
    undo: { label: 'Ctrl+Z', hint: '실행 취소' },
    redo: { label: 'Ctrl+Shift+Z / Ctrl+Y', hint: '다시 실행' },
    del: { label: 'Delete', hint: '선택한 것 삭제' },
    esc: { label: 'Esc', hint: '취소 / 선택 해제' },
    step: { label: '1~9', hint: '단계 선택 (경로를 선택했으면 그 경로의 단계 변경)' },
    clearAll: { label: 'X', hint: '움직임 전체 지우기' },
    reset: { label: 'Shift+R', hint: '새로 시작 (전체 초기화)' },
  },
} as const

/** 배치 (always available). */
export const PLACE_BINDINGS: Binding[] = [
  { label: 'Ctrl+좌클릭', hint: '우리팀 선수 추가' },
  { label: 'Ctrl+우클릭', hint: '상대팀 선수 추가' },
  { label: '드래그', hint: '옮기기 (여러 명이면 같이)' },
  { label: '빈 잔디 드래그', hint: '박스로 여러 명 선택' },
  { label: 'Shift+잔디 드래그', hint: '기존 선택에 박스 추가' },
  { label: 'Ctrl+선수 클릭', hint: '선택에 추가/빼기 (그대로 드래그 = 같이 이동)' },
  {
    label: '겹친 곳 다시 클릭',
    hint: '겹쳐 있는 다음 대상 선택 (선수→고스트→경로 순환)',
    compact: true,
  },
  { label: '공 → 선수 드롭', hint: '그 선수가 공 보유' },
  {
    label: '공 휙 던지기',
    hint: '빠르게 놓으면 관성으로 굴러감 (경계선 튕김, 선수 근처 정지 시 보유)',
    compact: true,
  },
  {
    label: '공 더블클릭+드래그',
    hint: '당긴 반대 방향으로 발사 — 점선 길이는 세기 (공은 그보다 더 나감)',
    compact: true,
  },
  { label: '선수 클릭', hint: '등번호·이름·포지션 편집', compact: true },
]

/** 경로 그리기·다듬기·재생. */
export const ANIM_BINDINGS: Binding[] = [
  { label: 'Alt+드래그', hint: '선수는 이동 경로, 공은 패스', compact: true },
  {
    label: '선수·공 선택 + Alt+클릭',
    hint: '클릭한 지점까지 직선 경로 — 중간에 뭐가 있든 상관없음 (휘는 건 나중에 선을 당겨서)',
    compact: true,
  },
  {
    label: 'Alt+클릭 → Alt+클릭',
    hint: '시작점을 직접 찍어서 (흐린 토큰에서도)',
    compact: true,
  },
  { label: '흐린 토큰 Alt+드래그', hint: '그 위치에서 이어서 그리기', compact: true },
  { label: '흐린 토큰 드래그', hint: '그 움직임의 끝 위치 미세조정', compact: true },
  { label: '경로 클릭', hint: '선택 후 Delete 삭제, 숫자키로 단계 변경', compact: true },
  { label: '경로 드래그', hint: '잡은 지점을 당겨 곡선으로 휘기', compact: true },
  { label: '배지/경로 클릭', hint: '움직임 선택 — 단계·재생·삭제 카드 표시' },
  { label: '단계 1~9', hint: '같은 번호는 같이, 다음 번호는 이어서' },
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
  { label: 'Ctrl+좌클릭', hint: '우리팀 선수 추가', chip: true },
  { label: 'Ctrl+우클릭', hint: '상대팀 선수 추가', chip: true },
  { label: 'Ctrl+Z', hint: '되돌리기', chip: true },
]

export const GUIDE_PLACE_BINDINGS: Binding[] = PLACE_BINDINGS.filter((b) => b.compact)
export const GUIDE_ANIM_BINDINGS: Binding[] = ANIM_BINDINGS.filter((b) => b.compact)
export const GUIDE_PLAY_BINDINGS: Binding[] = [
  KEYMAP.playback.toggle,
  KEYMAP.playback.boost,
  KEYMAP.playback.zen,
]

export const KEYMAP_GROUPS: { title: string; items: Binding[] }[] = [
  { title: '배치', items: PLACE_BINDINGS },
  { title: '경로 그리기·다듬기', items: ANIM_BINDINGS },
  { title: '자유 그리기', items: DRAW_BINDINGS },
  { title: '재생', items: Object.values(KEYMAP.playback) },
  { title: '편집', items: Object.values(KEYMAP.edit) },
]
