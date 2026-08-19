# Product Brief — Soccer Tactics

> Status: Accepted (사용자 확정 요구사항, 2026-08-19 초기화 프롬프트에서 재구성)
> 이 문서는 "무엇을 만드는가"의 기준. 아키텍처 결정은 `docs/agent/decisions/`, 현재 진행 상태는 `docs/agent/CURRENT_STATE.md`.

## 1. Mission

사용자가 실제 축구 또는 EA SPORTS FC 계열 게임에서 발생할 수 있는 축구 상황을 자유롭게 구성하고,
선수·공·공간·움직임·패스·오프더볼 움직임을 **시간축 위에서 직접 설계**하여,
전술이 어떻게 전개되는지를 직관적인 애니메이션으로 설명할 수 있는 **Interactive Football Tactics Sequencer**.

공식: **Tactical Board + Motion Path Editor + Timeline Sequencer + Scenario Player**.
최우선 핵심 = **Motion / Animation / Timeline 시스템**. 정적 전술판으로 MVP를 끝내지 않는다.

## 2. Primary Users

| 사용자 | 특징 | 요구 |
|---|---|---|
| 초보 (전술 설명하고 싶은 일반 팬·스트리머·FC 유저) | Timeline 개념 모름 | 몇 번 클릭으로 장면 완성 |
| 고급 (코치·분석가·콘텐츠 제작자) | 세밀한 타이밍·경로 통제 원함 | 개별 track·delay·curve·trigger 편집 |

원칙: **Simple by default, powerful when needed.**

## 3. Core Jobs

1. 축구 상황(11v11 ~ 2v2, 세트피스, 전환, 압박 등)을 자유롭게 배치한다.
2. 선수·공에 이동 경로와 타이밍을 부여한다.
3. 재생해서 전개를 확인하고, 멈추고, 고치고, 다시 재생한다.
4. 완성된 전술을 저장·공유·설명에 쓴다 (v1 범위는 Open Decision A-01).

## 4. Core Interaction Loop

`Formation 선택 → 선수/공 배치 → 상황 구성 → 움직일 선수 선택 → 경로 지정 → 공 움직임/소유권 지정 → 시작 시점/순서 조정 → 재생 → 일시정지/탐색/수정 → 재생 → 완성`

초기 UX 성공 조건 (매뉴얼 없이 수행 가능해야 함):
Formation 선택 → 선수 이동 → 공 배치 → 선수 A 경로 → 선수 B 다른 시작 시점 경로 → 공 패스 경로 → Play → Timeline 확인 → Pause/수정 → Undo → Play.
"어디를 눌러야 하지?"가 잦으면 UX 결함.

## 5. Tactical Board 요구

- formation·11v11에 종속되지 않음. 임의 인원(2v2, 3v2, 4v3 …), 세트피스, 전환, 세컨볼, 루즈볼 등 자유 구성.
- Formation은 **Preset이지 Constraint가 아니다**. 적용 후 모든 선수 자유 이동.
- Formation/Preset은 **data-driven** (컴포넌트 하드코딩 금지). EA FC 버전 의존 preset은 버전 확정 전 추측 금지 (Open Decision A-04).
- 지원 상황 예: overload, counter, build-up, pressing, block, transition, corner/free kick/penalty/throw-in, cross, second ball, loose ball, off-ball run, overlap/underlap, third-man, decoy, line-breaking pass, switch, GK build-up, 자유 구성.

## 6. Animation / Timeline 요구 (최우선)

- `모두 Start → 동시에 End` 금지. 시간 관계 자체가 의미.
- Player·Ball 각각 **독립 Animation Track**.
- 개념 필수: Global Timeline, Entity Track, Keyframe/Waypoint, Start Time, Duration, Delay, Hold, Speed, Easing, Sequential/Parallel/Triggered, Path interpolation, Editable path, Playback state.
- **Ball ≠ Player**: Loose / Possessed / Pass / Through ball / Cross / Shot / Clearance / Deflection / Receive. Possession attach/detach 모델. 공을 선수 위치에 단순 종속시키지 않음.
- **Trigger**: 시간뿐 아니라 이벤트 관계 표현 가능한 데이터 구조 (예: "B는 A가 waypoint 2 도달 시 출발", "C는 공 release 시", "수비수는 A receive 0.3s 후"). v1 UI 전부 구현 안 해도 데이터 구조가 막지 않아야 함.
- **Tactical Motion ≠ Interface Motion**: 전술 모션은 deterministic·time/path-accurate·reproducible, 지정 안 한 overshoot/bounce 없음. UI 모션은 spring/feedback 허용.
- `getStateAtTime(t)` 형태로 임의 시점 상태 재구성 가능 (scrub/seek/pause/replay/export/debug).
- Renderer는 애니메이션의 진실이 아님. Engine ↔ Render 분리.
- Scene/Phase 개념 확장 가능 (v1 필수 아님).
- 같은 Document + 같은 설정 재생 = 같은 결과.

### Acceptance Scenario A — 2 vs 2
Blue1(공 보유), Blue2, Red1, Red2, Ball 임의 배치.
1. Blue1 공 보유 시작. 2. Blue2 0.4s 대기. 3. Blue2 측면으로 이동 시작. 4. Red1은 Blue2 움직임 이후 반응. 5. Blue1 t=1.2s 패스. 6. Ball detach. 7. Ball 별도 path로 Blue2에게. 8. Blue2 receive. 9. Red2는 receive 이벤트 이후 압박 시작.

### Playback 필수 UX
Play / Pause / Restart / Scrub / Replay / Speed / 재생 후 편집 / 편집 후 재실행.

## 7. Path Editor 요구

선수 클릭 → Movement tool → 필드 위에 경로 그리기 → waypoint drag 수정 → curve handle → 시작 시점/속도 → preview.
검토: linear/curved/bezier-spline, waypoint editing, drag-to-edit, snap/guide, direction arrow, ghost preview, selected path emphasis. 기존 path 직접 수정 가능 (재생성 불필요).

## 8. UX 요구

- **직접 조작 우선**: 선수/공 drag, path 그리기, waypoint/handle/arrow endpoint drag, 영역 resize, timeline block drag/resize. Inspector는 정밀 조정용.
- **Timeline Progressive Disclosure**: 기본 = Play/Pause/Restart/Scrubber/Speed. Advanced = Entity tracks, start/duration/delay, keyframe, event, sequence.
- **Undo/Redo 필수**: transactional (drag start~end = 1 step), reversible command/state history.
- Pitch가 항상 시각 중심. 패널 때문에 Pitch 축소 금지.
- Tactical Annotation 확장 가능: movement/pass arrow, dashed run, pressing line, zone, circle/rect, freehand, text, highlight. Annotation ↔ Animation Path 내부 구분 검토.
- 반응형: Canvas pixel에 데이터 종속 금지. normalized/domain 좌표.
- Serializable Domain Model (JSON) — Save/Load/Duplicate/Share/Export/Preset/Versioning/Undo/Scenario Library 기반.

### Harmony / Immersion / Fun (3×3 평가 틀)
- Harmony: Visual / Functional / Contextual
- Immersion: Attention Focus / Continuity / Sense of Control
- Fun: Response Delight / Discovery Delight / Completion Delight
주요 UX 결정은 이 9개 중 무엇을 개선하는지 설명 가능해야 함.

### Apple-like
시각 복제 아님. visual hierarchy, whitespace, progressive disclosure, direct manipulation, contextual controls, 즉각 feedback, spatial continuity, spring interaction, typography, 최소 상시 컨트롤, predictable, polish, accessibility, reduced-motion. glass/blur 남발 금지. **Interaction quality > 장식.**

## 9. Non-goals (v1)

로그인, 소셜, 복잡한 서버, 실시간 협업, AI 전술 자동생성, 3D, 실경기 tracking, DB, 영상 렌더링 서버, 과도한 WebGL.
단, Domain Model은 이들 확장을 막지 않는다.

## 10. 최우선 판단 기준

> 이 기능이 사용자가 축구 상황을 더 쉽고 정확하고 즐겁게 설명하도록 도와주는가?

Animation 설계 시:
> "이 선수는 먼저, 이 선수는 그 다음, 그 순간 공이, 이후 다른 선수가 반응한다"는 장면을 거의 그대로 Timeline 위에 표현할 수 있는가?

## 11. Project-Owned Evidence

- 레퍼런스 전술보드 이미지 → `docs/agent/decisions/VDR-0001-reference-tactical-board.md` (canonical artifact: `docs/agent/decision-assets/VDR-0001/reference-tactical-board.png` — 사용자 저장 필요).
- 본 문서 = 2026-08-19 초기화 프롬프트 재구성.
