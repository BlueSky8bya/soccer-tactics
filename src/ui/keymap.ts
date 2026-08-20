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
  { label: '겹친 곳 다시 클릭', hint: '겹쳐 있는 다음 대상 선택 (선수→고스트→경로 순환)' },
  { label: '공 → 선수 드롭', hint: '그 선수가 공 보유' },
  { label: '선수 클릭', hint: '등번호·이름·포지션 편집' },
]

/** 경로 그리기·다듬기·재생. */
export const ANIM_BINDINGS: Binding[] = [
  { label: 'Alt+드래그', hint: '선수는 이동 경로, 공은 패스' },
  { label: '흐린 토큰 Alt+드래그', hint: '그 위치에서 이어서 그리기' },
  { label: '흐린 토큰 드래그', hint: '그 움직임의 끝 위치 미세조정' },
  { label: '경로 클릭', hint: '선택 후 Delete 삭제, 숫자키로 단계 변경' },
  { label: '경로 드래그', hint: '잡은 지점을 당겨 곡선으로 휘기' },
  { label: '배지/경로 클릭', hint: '움직임 선택 — 단계·재생·삭제 카드 표시' },
  { label: '단계 1~9', hint: '같은 번호는 같이, 다음 번호는 이어서' },
]

/** 자유 그리기(주석) — PLAN-008. */
export const DRAW_BINDINGS: Binding[] = [
  { label: 'D', hint: '그리기 모드 켜기/끄기 (하단 바가 그리기 바로 전환)' },
  { label: 'V / P / E', hint: '선택(선수·공 이동) / 펜 / 지우개' },
  { label: '드래그', hint: '펜: 자유 곡선 · 지우개: 스친 획 통째 삭제' },
  { label: 'Esc', hint: '그리기 모드 종료' },
  { label: 'Ctrl+Z', hint: '획 하나 되돌리기' },
]

export const KEYMAP_GROUPS: { title: string; items: Binding[] }[] = [
  { title: '배치', items: PLACE_BINDINGS },
  { title: '경로 그리기·다듬기', items: ANIM_BINDINGS },
  { title: '자유 그리기', items: DRAW_BINDINGS },
  { title: '재생', items: Object.values(KEYMAP.playback) },
  { title: '편집', items: Object.values(KEYMAP.edit) },
]
