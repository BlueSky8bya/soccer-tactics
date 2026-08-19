/**
 * Simple-mode bindings (ADR-0009 v2) — shown in the right side panel and the ? overlay.
 * The mouse does the authoring; the keyboard only plays, deletes and undoes.
 */
export interface Binding {
  key?: string
  label: string
  hint: string
}

export const KEYMAP = {
  playback: {
    toggle: { key: ' ', label: 'Space', hint: '재생 / 일시정지' },
    restart: { key: 'Home', label: 'Home', hint: '처음으로' },
    loop: { key: 'g', label: 'G', hint: '반복' },
  },
  edit: {
    undo: { label: 'Ctrl+Z', hint: '실행 취소' },
    redo: { label: 'Ctrl+Shift+Z / Ctrl+Y', hint: '다시 실행' },
    del: { label: 'Delete', hint: '선택한 것 삭제' },
    esc: { label: 'Esc', hint: '취소 / 선택 해제' },
    step: { label: '1~9', hint: '단계 선택 (경로를 선택했으면 그 경로의 단계 변경)' },
  },
} as const

/** 배치 (always available). */
export const PLACE_BINDINGS: Binding[] = [
  { label: 'Ctrl+클릭', hint: '우리팀 선수 투입 (잔디의 그 자리)' },
  { label: 'Ctrl+우클릭', hint: '상대팀 선수 투입' },
  { label: '드래그', hint: '선수·공 옮기기 (여러 명 선택했으면 같이 이동)' },
  { label: '빈 잔디 드래그', hint: '박스로 여러 명 선택 (Delete로 한꺼번에 삭제)' },
  { label: '공 → 선수', hint: '공을 선수 위에 놓으면 그 선수가 보유' },
]

/** 애니메이션 모드에서만. */
export const ANIM_BINDINGS: Binding[] = [
  { label: '더블클릭+드래그', hint: '선수 = 이동 경로 · 공 = 패스 (끝의 선수가 받음)' },
  { label: '휙 던지기', hint: '빠르게 놓으면 그 방향으로 달리기 / 패스' },
  { label: '경로 클릭', hint: '선택 (Delete 삭제 · 숫자키 = 단계 변경)' },
  { label: '경로 배지 클릭', hint: '단계 번호 +1' },
  { label: '단계 ①②③', hint: '같은 번호 = 같이 시작·같이 끝남 · 다음 번호 = 그다음' },
]

export const KEYMAP_GROUPS: { title: string; items: Binding[] }[] = [
  { title: '배치', items: PLACE_BINDINGS },
  { title: '애니메이션 모드', items: ANIM_BINDINGS },
  { title: '재생', items: Object.values(KEYMAP.playback) },
  { title: '편집', items: Object.values(KEYMAP.edit) },
]
