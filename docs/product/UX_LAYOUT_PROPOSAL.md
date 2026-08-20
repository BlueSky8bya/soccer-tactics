# UX Layout Proposal — Editor Shell

> Status: Proposed (사용자 선택 대기, Open Decision A-06 in ACTIVE_PLAN)
> 평가 기준: Harmony / Immersion / Fun / Pitch 가시성 / 초보 사용성 / 고급 편집 확장성 (각 1–5)

## Option 1 — Classic 3-Pane (Tools L · Pitch C · Inspector R · Timeline B)

```text
┌──────────────────────────────────────────────┐
│ Top Bar: Doc · Formation · Undo/Redo · Play  │
├────────┬───────────────────────┬─────────────┤
│ Tools  │                       │ Inspector   │
│ Players│       Pitch           │ (always on) │
│ Shapes │                       │             │
├────────┴───────────────────────┴─────────────┤
│ Timeline (tracks always visible)             │
└──────────────────────────────────────────────┘
```

Harmony 4 · Immersion 2 · Fun 2 · Pitch 2 · Beginner 2 · Advanced 5
장점: 고급 사용자 익숙(영상편집 멘탈모델). 단점: 상시 패널이 pitch를 잠식, 초보에게 "관리자 패널" 인상, 빈 인스펙터가 주의 분산.

## Option 2 — Canvas-First Floating (pitch 전면, 떠 있는 컨트롤)

```text
┌──────────────────────────────────────────────┐
│        ╭ Select · Move · Path · Ball · Draw ╮ │  ← 상단 중앙 floating pill
│                                              │
│                  Pitch (full)                │
│          ╭ 선택 엔티티 popover ╮              │  ← 선택 근처 contextual
│                                              │
│   ╭ ▶ ❚❚ ↺  ━━━●━━━━━━━  1.0× ⌃ ╮           │  ← 하단 floating 재생 바, ⌃로 확장
└──────────────────────────────────────────────┘
```

Harmony 4 · Immersion 5 · Fun 5 · Pitch 5 · Beginner 5 · Advanced 2
장점: 몰입·Apple-like 최상, 초보 최상. 단점: 다중 track 편집·길어진 timeline을 popover/overlay로 감당하기 어려움, 고급 편집 시 화면 겹침.

## Option 3 — Focused Hybrid (추천)

```text
┌──────────────────────────────────────────────────────┐
│ Top Bar (얇음): Title · Formation ▾ · ↶ ↷ · ▶ · ⋯      │
├──┬───────────────────────────────────────┬───────────┤
│T │                                       │ Inspector │
│o │                                       │ (선택 시만 │
│o │              Pitch (center,           │  슬라이드 │
│l │               always ≥ 65% width)     │  인, 접기 │
│s │                                       │  가능)    │
│  │                                       │           │
├──┴───────────────────────────────────────┴───────────┤
│ ▶ ❚❚ ↺   ━━━━━━●━━━━━━━━━━━   1.0×   ⌃ Tracks        │  ← 기본: 한 줄
│ ┌ Blue 2  ▓▓▓▓▓▓░░░░░░░░  ┐                         │  ← ⌃ 펼치면 entity tracks
│ │ Ball    ▓▓░░▓▓▓░░░░░░░  │ (block drag/resize)     │
│ └ Red 2   ░░░░░░░▓▓▓▓░░░  ┘                         │
└──────────────────────────────────────────────────────┘
```

- 좌측: 아이콘 전용 슬림 tool rail (≈48px). 라벨은 hover/tooltip.
- 우측 Inspector: 선택이 있을 때만 슬라이드 인(spring). 미선택 시 pitch가 그 폭을 차지. 고정(pin) 가능.
- 하단 Timeline: 기본 1줄(Play/Pause/Restart/Scrubber/Speed). `⌃`로 entity tracks 펼침(progressive disclosure). 펼쳐도 pitch 높이 ≥ 55%.
- 선택 엔티티 위 작은 contextual 미니바(경로 추가·공 주기·삭제) → Option 2의 직접성 흡수.

Harmony 5 · Immersion 4 · Fun 4 · Pitch 4 · Beginner 4 · Advanced 4

### 9-criteria 매핑

- Visual Harmony: 단일 토큰 체계, 패널 radius/spacing 통일.
- Functional Harmony: pitch 위 미니바와 Inspector의 같은 행동은 같은 command.
- Contextual Harmony: 선택 → Inspector+track 하이라이트 동시(선택 링 색 = track 색).
- Attention Focus: 미선택 시 pitch만. 빈 패널 없음.
- Continuity: 배치→경로→timeline 전환 시 레이아웃 점프 없음(패널 슬라이드만).
- Sense of Control: Undo/Redo 상단 고정, Esc cancel, scrubber 항상 보임.
- Response Delight: 도구 선택/토큰 pickup/패널 등장 spring(UI motion만).
- Discovery Delight: 선택 시 미니바가 "다음 행동"을 보여줌.
- Completion Delight: Play 시 패널 자동 접힘(옵션) + 전체 pitch 재생.

## 추천

**Option 3**. 이유: Pitch 중심 유지 + 초보 기본 화면 단순 + 고급 track 편집 확장 가능. Option 2의 강점(contextual 미니바, 1줄 재생바)을 흡수.

## 대상 디바이스 가정 (Open Decision A-03)

데스크톱 ≥1280px 1차. 태블릿 가로(≥1024) 2차(Inspector 오버레이화). 모바일 세로는 v1 비대상(읽기 전용 재생 정도 추후).
