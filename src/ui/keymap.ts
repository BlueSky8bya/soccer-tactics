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
  { label: 'Ctrl+클릭', hint: '우리팀 선수 추가' },
  { label: 'Ctrl+우클릭', hint: '상대팀 선수 추가' },
  { label: '드래그', hint: '옮기기 (여러 명이면 같이)' },
  { label: '빈 잔디 드래그', hint: '박스로 여러 명 선택' },
  { label: '공 → 선수 드롭', hint: '그 선수가 공 보유' },
  { label: '선수 클릭', hint: '등번호·이름·포지션 편집' },
]

/** 애니메이션 모드에서만. */
export const ANIM_BINDINGS: Binding[] = [
  { label: 'Shift+드래그', hint: '선수는 이동 경로, 공은 패스' },
  { label: '흐린 토큰 Shift+드래그', hint: '그 위치에서 이어서 그리기' },
  { label: '경로 클릭', hint: '선택 후 Delete 삭제, 숫자키로 단계 변경' },
  { label: '배지 클릭', hint: '단계 +1' },
  { label: '단계 1~9', hint: '같은 번호는 같이, 다음 번호는 이어서' },
]

export const KEYMAP_GROUPS: { title: string; items: Binding[] }[] = [
  { title: '배치', items: PLACE_BINDINGS },
  { title: '애니메이션 모드', items: ANIM_BINDINGS },
  { title: '재생', items: Object.values(KEYMAP.playback) },
  { title: '편집', items: Object.values(KEYMAP.edit) },
]
