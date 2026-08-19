/**
 * Single source of truth for shortcuts (user request 2026-08-20: left-hand cluster + mouse).
 * Keyboard hook, tool rail, help panel and overlay all read from here — change it in ONE place.
 *
 * Design: left hand rests on Q W E R / A S D F / Z X C V + Space + Alt/Ctrl/Shift;
 * right hand stays on the mouse. Modifier-drags do the most frequent jobs without switching tools.
 */
export type Binding = { key: string; label: string; hint?: string }

export const KEYMAP = {
  tools: {
    select: { key: 'q', label: 'Q', hint: '선택 / 이동' },
    addPlayer: { key: 'w', label: 'W', hint: '선수 추가 (필드 클릭)' },
    path: { key: 'e', label: 'E', hint: '경로 도구 (토글)' },
    arrow: { key: 'r', label: 'R', hint: '화살표 주석' },
    zone: { key: 'a', label: 'A', hint: '구역 주석 (Shift: 타원)' },
    text: { key: 's', label: 'S', hint: '텍스트 주석' },
    giveBall: { key: 'd', label: 'D', hint: '선택한 선수에게 공 주기' },
    team1: { key: '1', label: '1', hint: '선수 추가 팀 = 홈' },
    team2: { key: '2', label: '2', hint: '선수 추가 팀 = 어웨이' },
  },
  mouse: {
    altDrag: {
      key: 'Alt+드래그',
      label: 'Alt+드래그',
      hint: '선수·공 위에서 → 경로/패스 그리기 (도구 전환 없이)',
    },
    pathScrub: {
      key: 'Shift+드래그',
      label: 'Shift+드래그',
      hint: '경로 있는 선수·공을 경로 따라 끌면 재생 위치가 그 시각으로 (선택 도구)',
    },
    shiftDraw: { key: 'Shift(그리는 중)', label: 'Shift+그리기', hint: '직선으로' },
    ctrlDrag: { key: 'Ctrl(드래그 중)', label: 'Ctrl+드래그', hint: '스냅 일시 해제' },
    toggleSelect: {
      key: 'Ctrl+클릭',
      label: 'Ctrl+클릭',
      hint: '선택 추가·제거 (Ctrl/Cmd만 — Shift는 스크럽·직선·타원 전용)',
    },
    marquee: { key: '빈 곳 드래그', label: '빈 곳 드래그', hint: '영역 선택' },
    fling: {
      key: '빠르게 놓기',
      label: '휙 던지기',
      hint: '공: 감속하며 굴러감(패스/루즈볼) · 선수: 그 방향으로 달리기',
    },
    dbl: { key: '더블클릭', label: '더블클릭', hint: '경로 도구 켜기' },
    dropBall: { key: '공→선수 드롭', label: '공→선수 드롭', hint: '그 선수가 공 보유' },
    dragAtTime: {
      key: '재생 중 드래그',
      label: '재생 위치에서 드래그',
      hint: '그 시각의 위치(경로 끝) 수정',
    },
  },
  playback: {
    toggle: { key: ' ', label: 'Space', hint: '재생 / 일시정지' },
    stepBack: { key: 'z', label: 'Z', hint: '0.1s 뒤로 (Shift 1s)' },
    stepFwd: { key: 'x', label: 'X', hint: '0.1s 앞으로 (Shift 1s)' },
    restart: { key: 'c', label: 'C', hint: '처음으로' },
    tracks: { key: 'v', label: 'V', hint: '트랙 패널' },
    loop: { key: 'g', label: 'G', hint: '반복' },
    home: { key: 'Home', label: 'Home', hint: '처음' },
    end: { key: 'End', label: 'End', hint: '끝' },
  },
  edit: {
    undo: { key: 'Ctrl+Z', label: 'Ctrl+Z', hint: '실행 취소' },
    redo: { key: 'Ctrl+Shift+Z', label: 'Ctrl+Shift+Z / Ctrl+Y', hint: '다시 실행' },
    delete: { key: 'Delete', label: 'Delete', hint: '선택 삭제 (선수 / 움직임 / 주석)' },
    selectAll: { key: 'Ctrl+A', label: 'Ctrl+A', hint: '전체 선택' },
    save: { key: 'Ctrl+S', label: 'Ctrl+S', hint: 'JSON 저장' },
    open: { key: 'Ctrl+O', label: 'Ctrl+O', hint: 'JSON 열기' },
    nudge: { key: 'Arrows', label: '← ↑ → ↓', hint: '0.5m 이동 (Shift 2m)' },
    cancel: { key: 'Escape', label: 'Esc', hint: '취소 / 선택 해제 / 선택 도구로' },
    cycle: { key: 'Tab', label: 'Tab', hint: '다음 선수 (필드 포커스)' },
    help: { key: '?', label: '?', hint: '단축키 전체' },
  },
} as const

/** Pointer-modifier policy used by PitchStage — same source as the help text. */
export const MOUSE_POLICY = {
  /** Additive selection / marquee: Ctrl or Cmd only. */
  isAdditive: (e: { ctrlKey: boolean; metaKey: boolean }) => e.ctrlKey || e.metaKey,
  /** Snap off while dragging. */
  isSnapOff: (e: { ctrlKey: boolean; metaKey: boolean }) => e.ctrlKey || e.metaKey,
  /** Path drawing from any tool. */
  isDraw: (e: { altKey: boolean }) => e.altKey,
  /** Path-scrub: Shift alone (no Alt/Ctrl/Meta), select tool, token with a path. */
  isScrub: (e: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }) =>
    e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey,
} as const

export const KEYMAP_GROUPS: { title: string; items: Binding[] }[] = [
  { title: '마우스 + 모디파이어', items: Object.values(KEYMAP.mouse) },
  { title: '도구 (왼손)', items: Object.values(KEYMAP.tools) },
  { title: '재생 (왼손 아래줄)', items: Object.values(KEYMAP.playback) },
  { title: '편집', items: Object.values(KEYMAP.edit) },
]
