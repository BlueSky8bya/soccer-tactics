# Active ExecPlan

Plan ID: PLAN-20260821-006
Status: In Progress (사용자 승인 2026-08-20)
Task Risk: L2
Created: 2026-08-20
Updated: 2026-08-20
Execution Owner: Claude Code (사용자 승인 후)

## Objective

단일 간편 모드의 기능과 전술 의미는 그대로 두고, 앱을 여는 첫 3초부터 선수·경로를 누르고 끌고 놓는 모든 순간까지 하나의 시각·촉각 언어로 재설계한다. 목표는 “Apple처럼 보이기”가 아니라 **즉시 이해되는 계층, 직접 조작에 붙어오는 피드백, 짧고 중단 가능한 장식 모션, 22명에서도 전술이 먼저 읽히는 화면**이다.

성공 순서는 다음과 같다.

1. 1440×900 첫 화면에서 3초 안에 `피치 → 핵심 행동 → 재생` 순서가 읽힌다.
2. pointer down → drag → drop 각각에서 결과를 예고하는 피드백이 있고 문서 좌표와 시각 피드백이 어긋나지 않는다.
3. 색·그림자·radius·타이포·모션이 semantic token 한 체계에서 나오며 임의값이 남지 않는다.
4. 11v11 + 양 팀 다중 경로에서도 팀, 선택, 현재 단계, 공 소유가 색 외의 단서까지 포함해 구분된다.

## Scope, Invariants, Non-goals

- `ADR-0009-simple-mode-interaction.md`와 Amendment v2/v3/v4가 우선한다. 단일 간편 모드, 1~9 단계, Shift 경로 작성, path drag=bend, 세션 A/B/C, held-result를 유지한다.
- Amendment v4에 따라 **재생 중 모든 경로·화살촉은 숨긴다**. 과거의 “현재 경로만 강조”로 되돌리지 않는다.
- `src/engine`, `src/domain`은 변경하지 않는다. 전술 위치는 기존 `compile → stateAt(t)`만 사용하고 pickup/shadow/ring/cross-fade 같은 장식만 `src/ui/motion`에 둔다.
- document schema, `SCHEMA_VERSION`, migration 변화 없음. 새 상태는 ephemeral UI state 또는 파생 presentation state만 허용한다.
- 새로고침=클린 보드, 단일 화면, 새 의존성 없음. 작은 로컬 SVG 아이콘은 허용하되 icon/motion/design-system 패키지는 추가하지 않는다.
- 저장/계정/다크 모드/고급 모드/시간축/새 전술 기능은 범위 밖이다. GIF는 기능을 늘리지 않고 화면과의 시각 일치만 다룬다.
- 문서는 한국어, 식별자·타입·코드는 영어로 작성한다. 이 계획 작성 단계에서는 이 파일만 수정한다.

## Evidence Read and Audit Method

### Project-owned evidence

- 규칙·상태: `docs/agent/CONSTITUTION.md`, `docs/agent/CURRENT_STATE.md` 세션 12, `docs/agent/decisions/ADR-0009-simple-mode-interaction.md` 본문과 Amendment v2/v3/v4.
- 사용자 피드백: `docs/agent/CHANGELOG_AGENT.md` CHG-20260820-043~055. 재생 중 경로 완전 숨김(043), frosted shell/inline picker(044~045), 공 조작·부착(046~051/055), 중앙 브랜드·A/B/C(052), GIF(053), 광택 token·run bob·pitch depth(054)를 회귀 보호한다.
- 코드: `src/ui/*` 전체와 테스트, `src/renderer/*` 전체, `src/ui/tokens.css`.
- 현재 흐름: `AppShell`이 shell/panels/footer를 조립하고, `SimplePitch`가 pointer intent와 editor command를 연결하며, `PathLayer`/`Token`/`PitchMarkings`가 표시한다. 전술 좌표는 compiled state에서 오고 `AnimatedToken`과 CSS가 장식 반응만 덧붙인다.

### Screenshot evidence status and capture protocol

저장소에는 기준 스크린샷이 없고 계획 환경의 in-app browser에도 사용 가능한 브라우저 세션이 없어 실화면을 캡처할 수 없었다. 아래 위치는 꾸며 낸 근거가 아니라 **M0에서 구현 전에 생성할 evidence 계약**이다. 공통 조건은 Chromium, 100% zoom, light scheme, 1440×900/1280×800이며 정지 캡처와 motion trace를 분리한다.

| ID | 재현 상태 | 구현 전 / 후 위치 |
| --- | --- | --- |
| BASE-01 | 새로고침 직후 클린 보드 | `docs/agent/evidence/PLAN-20260821-006/BASE-01-empty-1440x900.png` / `M7-01-empty-1440x900.png` |
| BASE-02 | 양 팀 22명, 경로 없음 | `.../BASE-02-22p.png` / `.../M7-02-22p.png` |
| BASE-03 | 22명, 양 팀 run 각 3개+pass 2개, step 1~4, 비선택 | `.../BASE-03-22p-paths.png` / `.../M7-03-22p-paths.png` |
| BASE-04 | 선수 drag 중 snap 후보 존재 | `.../BASE-04-token-drag.png` / `.../M7-04-token-drag.png` |
| BASE-05 | path bend 중 ghost·badge·picker 표시 | `.../BASE-05-path-edit.png` / `.../M7-05-path-edit.png` |
| BASE-06/07 | 재생 중 / 종료 held-result | `.../BASE-06-playback.png`, `BASE-07-held.png` / 대응 `M7-*` |
| BASE-08 | 200% zoom 및 reduced-motion | `.../BASE-08-zoom200.png` / `.../M7-08-zoom200.png` |

## External Research and Sources

Apple 자료는 형태 복제가 아니라 interaction quality 기준으로 사용한다. 현 HIG의 material 설명도 기능적 navigation/control 층에 제한하고 content 위에 남용하지 말라는 경계까지 적용한다. 축구 제품은 공개 페이지에서 직접 확인되는 것만 사실로 쓰며 내부 조작감은 M0 확인 전 추론으로 표시한다.

- Apple HIG: [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Spatial layout](https://developer.apple.com/design/human-interface-guidelines/spatial-layout), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures), [Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
- Keynote 직접 조작: [keyboard shortcuts](https://support.apple.com/guide/keynote/keyboard-shortcuts-tanfde4a3e6d/mac), [alignment guides](https://support.apple.com/guide/keynote/use-alignment-guides-tan738df74cb/mac), [layer/group/lock](https://support.apple.com/guide/keynote/layer-group-and-lock-objects-tan003ee8980/mac).
- Apple Maps: [keyboard shortcuts and gestures](https://support.apple.com/en-us/126616). Pan/zoom/rotate 결과가 content에 연속 반영되는 직접 조작 원칙만 참고한다.
- HCI: MacKenzie, [Fitts' law as a research and design tool in HCI](https://www.lri.fr/~mbl/ENS/FundHCI/2013/papers/Mackenzie-HCI92.pdf). 자주 쓰는 목표는 크고 가까워야 하며 보이는 크기보다 hit target을 넓히는 근거다.
- 전술보드: [TacticalPad](https://www.tacticalpad.com/new/), [update notes](https://tacticalpad.com/update/info/en.php), [Táctica](https://tactica.football/), [Tactic Studio](https://www.tactic-studio.com/), [Soccer Tactic Board](https://play.google.com/store/apps/details?id=com.jenda.footballboard), [CoachFX](https://www.coachfxelements.com/about).
- 분석/방송: [Hudl StatsBomb](https://instat.hudl.com/products/statsbomb), [Opta Vision](https://www.statsperform.com/products/opta-vision/), [Opta Graphics](https://www.statsperform.com/products/opta-graphics/), [BBC Sports graphics R&D](https://downloads.bbc.co.uk/rd/pubs/whp/whp-pdf-files/WHP220.pdf), [Sky Tactical Cam](https://www.skysports.com/football/news/29840/10004247/introducing-tactical-cam-your-chance-to-watch-mnf-like-the-professionals), [Sky studio/AR](https://www.skygroup.sky/article/gary-neville-jamie-carragher-karen-carney-and-david-jones-unveil-new-sky-sports-studio-).

`InStat`은 현재 Hudl 계열 페이지에서 독립 UI의 공식 공개 근거가 충분하지 않아 Hudl StatsBomb 공개 diagram만 비교하고 “InStat 고유 스타일” 주장은 하지 않는다. 특정 화면을 기준으로 삼으려면 A-06의 참조 이미지를 받아야 한다.

## Harness and Visual-System Audit

| ID | 문제 | 코드·문서 근거 | 계획상 통제 |
| --- | --- | --- | --- |
| AUD-01 | Constitution은 glass/blur 남용을 금지하지만 header, 양 side card, footer가 모두 유사한 blur/흰 테두리를 쓴다. | `.simpleHeader`, `.sideCard`, `.simpleBar`; CHG-044/054 | M1에서 pitch/content는 solid, overlay/footer만 제한적 translucent로 둔다. |
| AUD-02 | token 체계가 있어도 CSS/SVG에 색·radius·shadow·curve 임의값이 대량 남는다. | `shell.module.css`, `pitch.module.css`, `DrawingLayer.DEFAULT_COLOR`, `exportGif` 상수 | M1 semantic token contract와 static test로 모은다. |
| AUD-03 | 모든 카드/피치의 강한 depth 반복 때문에 상태 계층이 평평하다. | side cards·pitch frame·footer·overlay shadow | rest/raised/floating/overlay 4단계로 재매핑한다. |
| AUD-04 | drag state와 CSS animation이 분리돼 press/drag/drop 피드백이 한 상태 모델을 쓰지 않는다. | `resolvePointerIntent`, `gestureRef`, `AnimatedToken`, attach CSS | M4 UI-only visual state helper를 둔다. |
| AUD-05 | 22명에서 ghost·badge·casing·gloss가 누적된다. | `ghostOpacityForStep`, `placeStepBadges`, `.tokenGloss`, `.pathCasing` | M3 semantic layering과 foreground 수 제한. |
| AUD-06 | 화면과 GIF가 pitch/token 표현을 별도 하드코딩한다. | `exportGif.ts`의 GRASS/LINE/TOKEN_R | M5 무상태 visual constants로 parity를 맞춘다. |
| AUD-07 | motion vocabulary가 제각각이다. | token 0.32/.45, attach 0.55s, CSS 220ms, token 120/200/320, run bob | M1 duration/curve/spring 의미를 고정한다. |
| AUD-08 | CSS와 `src/ui/AGENTS.md`에 제거된 legacy UI 흔적이 남는다. | rail/scrub/inspector selector와 stale routing | M1은 reference 0인 CSS만 제거; 문서 부채는 후속 memory update. |
| AUD-09 | a11y smoke가 name/tab/focus restore는 보지만 visual focus/contrast/forced-colors는 보지 않는다. | `accessibility.test.tsx` | M6 보강. |
| AUD-10 | tour-seen marker는 storage/cookie에 남아 baseline 재현을 방해할 수 있다. | `tourStorage.ts` | M0 fixture가 tour state를 명시; 정책 변경은 범위 밖. |

## Current vs Apple Principles Gap Table

| 요소 | 현재 | Apple/HCI 원칙 적용 시 | 근거 | 증거 | 난이도/우선순위 |
| --- | --- | --- | --- | --- | --- |
| shell 첫 3초 | header·양 panel·footer·pitch가 모두 떠 있어 경쟁 | pitch는 안정된 기준면, controls는 가까우나 조용한 보조층 | HIG Materials/Depth; shell CSS | BASE-01 | M/P0 |
| header·A/B/C | 브랜드/version/variants가 작은 pill로 경쟁 | 브랜드는 정적, variant는 단일 selection indicator, metadata는 저대비 | `AppShell`, CHG-052 | BASE-01/02 | S/P1 |
| 왼쪽 actions | 3색 action과 정리 버튼이 비슷한 무게 | 빈번한 행동은 크고 가까이, destructive는 필요할 때만 강조 | Fitts; `ActionsPanel` | BASE-01 | M/P0 |
| pitch frame | triple shadow/round card가 전술보다 먼저 보임 | 작업 공간 기준 surface로 두고 edge/depth 한 단계 | HIG Spatial layout; `.pitchFrame` | BASE-01/03 | S/P0 |
| 선수 token | gloss·white rim·shadow·ring·bob 중첩 | rest는 깨끗하고 번호 우선, 잡는 순간만 lift; 상태는 색+형태 | HIG Drag/Feedback; `Token`, `AnimatedToken` | BASE-02/04 | M/P0 |
| 공/보유자 | ball·holder ring·attach pulse/toast 강도 불일치 | 관계는 지속 단서, attach 순간만 짧은 confirm | CHG-051/055 | BASE-02/04 | S/P0 |
| token drag/snap | 위치는 연속이나 lift/valid/failed 공통 언어 약함 | Keynote guide처럼 후보를 조작 중 예고하고 drop 뒤 selection 유지 | HIG Drag; Keynote guides; `SimplePitch` | BASE-04 | M/P0 |
| 경로 작성 | live path/snap은 있으나 press→ink→commit 차가 약함 | 시작 acknowledgement, live ink, magnet, commit feedback 연속 | HIG Gesture/Feedback; `finishDraw` | BASE-05 | M/P0 |
| bend/waypoint | handle·selection·casing이 모두 강해질 수 있음 | 잡은 국소 점/segment만 lift, release에 정돈 | Fitts; `PathLayer` | BASE-05 | M/P0 |
| ghost/badge | 비선택 ghost와 모든 badge가 남아 겹침 | 현재 문맥만 선명, 나머지는 최소 문맥; badge collision 회피 | presentation helpers | BASE-03/05 | L/P0 |
| step picker | 별도 흰 pill이 즉시 등장 | badge anchor에서 이어져 열리고 outside/Escape로 역전 | HIG Feedback; `SimplePitch` | BASE-05 | S/P1 |
| playback | path fade, bob, play glow가 따로 움직임 | play가 stage 전환을 시작하고 chrome은 물러나며 held로 복귀 | ADR v4; CHG-043/054 | BASE-06/07 | M/P0 |
| footer/StepBar | 여러 pill/ring/glow와 30/44px target 혼재 | Play는 크고 가까운 primary, step은 명확한 secondary | Fitts/HIG A11y | BASE-01/07 | M/P0 |
| contextual cards | PlayerCard/selection bar가 비슷한 floating pill로 교대 | 대상 가까운 inspector, focus와 위치 continuity 유지 | Keynote 원칙; 두 컴포넌트 | BASE-05 | M/P1 |
| guide/tour/help | 고정 guide와 overlay가 조작을 반복 설명 | 평상시는 조용하고 학습층은 첫 사용/요청 때만 | HIG progressive feedback | BASE-01/08 | M/P1 |
| toast/error/export | 위치·지속·역할이 불일치 | confirm/error/progress를 semantic feedback으로 분리 | HIG Feedback; `AppShell` | BASE-07 | M/P1 |
| keyboard/focus | 이름/tab은 있으나 focus-visible 대비 증거 부족 | modality별 focus와 모든 핵심 28px+ target | HIG A11y; a11y tests | BASE-08 | M/P0 |

## Football Benchmark Summary

| 기준 | 발견 | Soccer Tactics 적용 |
| --- | --- | --- |
| token 질감 | TacticalPad는 cleaner 2D object, round photo/name/jersey를 공개한다. Táctica는 club kit/marker, StatsBomb/Opta는 고밀도를 위해 작은 점·shape를 쓴다. | 사진/kit은 추가하지 않고 얕은 enamel puck, 번호 우선, 팀은 색+rim/pattern으로 표시한다. |
| 경로 | TacticalPad는 smooth curve/ball trail/frame highlight, Táctica는 lane/run/zone, 분석·방송은 한 장면에 제한된 굵은 mark를 쓴다. | move/pass/shot/ball을 pattern+team color+casing으로 구분하되 현재 step/selection 외는 억제한다. |
| 재생 | 전술보드는 step/play/reset, CoachFX는 생동감 있는 설명, 방송은 wide tactical view에서 한 순간 한 메시지에 집중한다. | v4대로 재생 중 route를 모두 숨기고 공·움직임·소유만 남긴 뒤 held-result에서 편집층을 복원한다. |
| 색 | 전술보드는 field/object customization과 club colors, 분석은 중립 pitch+red/blue/heatmap, 방송은 강조색 수를 제한한다. | pitch/home/away/selection/semantic feedback를 분리하고 selection과 team blue는 outline/shape로도 구분한다. |
| 취사선택 | 프로 도구의 판독성·곡선·단계 focus는 유효하지만 3D, 방대한 tool palette, 방송 AR은 제품 목표와 다르다. | “판독성+직접 조작 반응성”만 취하고 기능·장식 수는 늘리지 않는다. |

공개 페이지에서 확인되지 않은 drag feel, latency, exact color는 결론으로 쓰지 않는다.

## Proposed Design Token System

M1에서 `tokens.css`를 semantic source of truth로 만든다. 값은 A-01~A-04 승인 전 초안이다.

### Color

| 역할 | token / 초기값 | 제약 |
| --- | --- | --- |
| canvas/surface | `--st-color-canvas: #F2EFE7`, `--st-color-surface: #FBFAF6` | pitch와 명도 분리; content card blur 금지 |
| raised | `--st-color-surface-raised: rgba(255,255,255,.84)` | footer/단기 popover만 |
| text | `--st-color-text: #20231E`, `--st-color-text-muted: #676D63`, `--st-color-text-faint: #8B9187` | faint를 핵심 안내에 쓰지 않음 |
| borders | `--st-color-hairline: rgba(31,38,29,.12)`, `--st-color-border-strong: rgba(31,38,29,.22)` | 흰 glass border 반복 제거 |
| accent | `--st-color-accent: #0878D1`, `--st-color-accent-soft: rgba(8,120,209,.14)` | 선택/focus/primary 전용; team A와 표현 분리 |
| semantic | success `#247A45`, warning `#9A6400`, danger `#C53B35` | text contrast 4.5:1 목표 |
| pitch | pitch `#40945D`, alt `#3B8C56`, edge `#2F7046`, line `rgba(255,255,255,.78)` | BASE-03 CVD/contrast 뒤 확정 |
| teams | home `#1E66D0`, away `#D24845` | color+승인된 secondary cue |

### Depth, radius, type, spacing

- Shadow: `rest`(hairline+0 1px 2px), `raised`(0 6px 18px), `drag`(0 12px 28px), `overlay`(0 20px 56px). overlay 동시 1개 이하.
- Radius: control 8px, card 14px, stage 20px, pill 999px. 원형 외 임의 6/7/10/16/20/22px를 역할로 치환한다.
- Type: caption 11/1.35, control 12/1.2, body 13/1.45, title 15/1.25, brand 17/1.1. step/숫자는 tabular.
- Space: 4/8/12/16/24/32 유지. 핵심 mouse target ≥28px, Play 44px, SVG path hit stroke ≥14px.

### Motion

| 의미 | 값 | 용도 | reduced-motion |
| --- | --- | --- | --- |
| instant | 80ms, `cubic-bezier(.2,0,0,1)` | hover/focus color | 0ms |
| feedback | 140ms, `cubic-bezier(.16,1,.3,1)` | press/release, badge | transform 제거, color ≤80ms |
| transition | 220ms | panel/footer/held cross-fade | opacity ≤100ms |
| settle | 320ms | drop/selection continuity | 즉시 final |
| rare emphasis | 480ms 상한 | possession confirm 1회 | ring 없음, 정지 cue+text |
| springs | `SPRINGS.press/pickup/drop/overlay` | UI-only scalar | final state; `stateAt` 불변 |

모든 장식 모션은 입력에 1 frame 안에 반응하고 reverse/interruption 가능해야 한다. tactical playback 좌표에는 curve/spring을 적용하지 않는다.

## Microinteraction Contract

| 대상 | Trigger | Response | Release/cancel | Reduced motion |
| --- | --- | --- | --- | --- |
| button/chip | pointer/key down | surface darken, shadow compress, scale .98 | 140ms settle; leave/cancel 원복 | scale 없음, 색만 |
| 선수 | hover/select | thin halo; selected ring+marker, 번호 유지 | hover 해제/selection 유지 | 정지 상태 동일 |
| 선수 drag | down→threshold | 즉시 pickup scale/shadow, cursor/guide | valid settle; cancel/invalid 원복+이유 toast; selection 유지 | 좌표 즉시, ring만 |
| marquee | grass drag | 저대비 rectangle, 포함 token ring | rectangle 제거, selection 유지 | 즉시 |
| Shift 경로 | Shift+down | 시작 pulse 1회, live ink | valid arrow/casing reveal; 짧으면 fade+toast; Escape 취소 | pulse/reveal 없음 |
| snap/공 target | 후보 radius 진입 | candidate ring+endpoint magnet, 문서 불변 | commit 뒤 possession cue; 이탈 시 해제 | 정지 ring+toast |
| path bend | path drag | 해당 segment/corner만 전경·handle | 1 commit 후 정돈; Escape rollback | 즉시 |
| ghost | ghost drag | 선택 ghost solid, 관련 path 전경 | 단계 opacity 복귀 | 즉시 |
| badge picker | badge click | anchor에서 opacity/scale open | select/outside/Escape reverse, focus 복귀 | 즉시 |
| possession | ball drop 성공 | holder offset+subtle ring+`탁!` toast | ring ≤480ms, holder cue 유지 | ring animation 없음 |
| Play | press | state 즉시, route 160~220ms 숨김, chrome 저대비 | held frame 고정 후 편집층 복귀 | fade 즉시, 전술 동일 |
| step/variant | chip click | indicator/label만 cross-fade, 좌표 morph 금지 | 즉시 재입력 | 즉시 |
| toast/error/progress | event | confirm/error/progress별 역할 | dismiss/timeout/원인 해소 | slide 없이 fade/즉시 |
| overlay/tour | open | focus 이동+scale/opacity | Escape/close trigger focus 복귀 | opacity≤100ms |

## Execution Milestones

각 milestone 완료 후 다음 명령을 모두 실행하고 실제 결과를 기록한다.

`npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify`

### M0 — Baseline evidence and approval freeze (P0, S)

**목적:** 구현 전 비교 장면과 취향 결정을 고정한다.

**파일/함수:** 제품 코드 변경 없음. `AppShell`, `ActionsPanel`, `SimplePitch`, `StepBar`를 통해 BASE-01~08을 구성하고 `docs/agent/evidence/PLAN-20260821-006/`에 캡처한다.

**작업:** viewport, zoom, tour seen, reduced-motion, selection ID, formation/segment를 manifest에 고정한다. BASE-04 drag 5초와 BASE-06 playback 10초의 Chrome trace에서 pointer 반응, layout shift, long task를 기록한다. A-01~A-06을 Decision Log에 확정한 뒤 M1을 시작한다.

**테스트/수용:** 코드 diff 0, BASE-01~08 존재, manifest와 상태 일치, full gate PASS. 사용자는 BASE-01/03/04/06을 보고 Ambiguity를 승인한다. 시각 비교를 못 하면 M1 시작 금지.

**롤백:** evidence만 제거 가능. 제품 영향 없음.
**위험:** fixture 재현 차이. 저장 기능으로 노출하지 말고 test fixture 또는 기록된 pointer 절차를 쓴다.

### M1 — Semantic tokens and material hierarchy (P0, M)

**파일/함수:**

- `src/ui/tokens.css`: semantic color/depth/radius/type/duration/easing 추가. old token은 한 milestone 동안 alias 후 제거.
- `src/ui/shell.module.css`, `src/renderer/pitch.module.css`: literal visual value를 semantic token으로 교체; `rg` reference 0인 legacy selector만 삭제.
- `src/ui/motion/spring.ts`: `SPRINGS.press/pickup/drop/overlay` 의미로 정리하고 `stepSpring/simulate` 결정론 유지.
- `src/renderer/DrawingLayer.tsx`, `src/ui/exportGif.ts`: CSS variable을 못 쓰는 SVG/canvas 값은 무상태 visual constants로 공유. renderer가 ui를 import하지 않도록 `src/renderer/visualDefaults.ts`를 두고 UI가 소비한다.
- 테스트: `src/ui/designTokens.test.ts` 신규, `src/ui/motion/spring.test.ts` 보강.

**흐름:** CSS state/data attribute → semantic token → CSS/SVG. event→command→document→compile은 불변.

**테스트:**

- `describe('semantic design tokens') / it('defines every approved color, depth, radius and motion role')`.
- `it('keeps reduced-motion overrides for every decorative duration')`.
- `it('leaves no unapproved literal color or cubic-bezier in shell and pitch CSS')` — ball black/white와 dynamic team prop만 allowlist.
- `spring / it('is deterministic for identical steps')`, `it('settles immediately when reduced motion is requested')`.

**자동 수용:** dependency/schema/engine/domain diff 0, literal allowlist, full gate PASS.
**브라우저 수용:** BASE-01 대비 pitch만 primary depth, 강한 floating surface 동시 2개 이하, text/control WCAG AA.
**롤백:** token 정의+consumer 치환 한 단위; old alias로 소비자별 복귀.
**위험:** 대량 CSS 치환의 숨은 영향. selector별 diff와 CSS module reference 검색 후 삭제한다.

### M2 — First-three-seconds shell and control hierarchy (P0, M)

**파일/함수:**

- `src/ui/AppShell.tsx`: header/variant/undo/help, pitch stage, contextual card, footer landmark와 visual state 정리. callback 불변.
- `src/ui/SidePanels.tsx`: `ActionsPanel`, `GuidePanel`의 grouping/계층 재배치; destructive action 상시 강조 금지.
- `src/ui/StepBar.tsx`: play scope/active step/held-result 계층 명확화; timeline 금지.
- `src/ui/PlayerCard.tsx`, `SelectionActionBar.tsx`: contextual surface/class 공유, 위치 continuity.
- `src/ui/shell.module.css`, 필요 시 `src/ui/UiIcon.tsx`: undo/redo/help/play를 local SVG로 통일; 외부 dependency 금지.
- 테스트: `AppShell.test.tsx`, `accessibility.test.tsx`.

**흐름:** click/keyboard → 기존 handler/store action → editor/UI store. DOM/presentation만 바꾸고 command/document/compile 불변.

**테스트:**

- `AppShell / it('keeps the single simple-mode landmarks and all existing primary actions')` — timeline/mode toggle 없음.
- `it('preserves clean-board state across shell redesign')`.
- `it('does not mutate the document when visual controls receive focus')`.
- `accessibility / it('tabs in DOM order from header actions to board context to playback controls')`.

**자동 수용:** accessible names 유지, dependency diff 0, full gate PASS.
**브라우저 수용:** 3초 후 사용자가 placement와 Play를 지목; 1280×800에서 pitch가 fold 안이고 footer가 가리지 않음.
**롤백:** shell DOM, side panel, footer style을 분리; handlers는 이동하지 않는다.
**위험:** visual order와 keyboard order 불일치. CSS `order` 대신 DOM 의미 순서를 쓴다.

### M3 — 22-player readability system (P0, L)

#### M3a — Token, ball, ownership

**파일/함수:** `src/renderer/Token.tsx`의 `Token`/`BallPattern`, `src/ui/pitch/AnimatedToken.tsx`, `SimplePitch` token/holder render, `pitch.module.css`, `teamColor.ts`.

rest gloss를 단일 edge highlight로 낮추고 번호를 우선한다. home/away는 색+승인된 secondary cue를 쓴다. 복합 상태 우선순위는 `dragged > selected > possessed > playback > hover > rest`. ball 크기와 holder offset 의미는 바꾸지 않는다.

**테스트:** `src/renderer/Token.test.tsx / it('resolves combined flags to one semantic visual hierarchy')`; `AppShell / it('renders 22 identified players without always-on labels')`; held-ball 위치/연결 회귀 테스트.

#### M3b — Path, ghost, badge, drawing

**파일/함수:** `pathPresentation.ts`의 `derivePathPhase`, `ghostOpacityForStep`, `placeStepBadges`; `PathLayer.tsx`의 `segClass`; `DrawingLayer.tsx`; `SimplePitch` path/ghost/badge block; `pitch.module.css`.

move/pass/shot은 color+pattern, ball path는 casing+dash로 구분한다. selection/current step만 높은 대비, 나머지는 최소 문맥 opacity. badge 배치는 결정론을 유지한다. 재생 중 route/arrow 완전 숨김은 불변이다.

**흐름:** `doc + compiled + playback.t + selection/currentStep` → pure presentation helper → `SimplePitch` props → pure renderer. 문서 수정 없음.

**테스트:**

- `pathPresentation / it('orders selected, current-step and context paths deterministically')`.
- `it('places identical 22-player badge input identically across calls')`.
- `it('keeps readable nonzero context opacity while capping foreground layers')`.
- `it('hides every route and arrow during playback and restores them for pause/held/preview')`.
- `it('keeps an attached pass start at its holder and never exposes it as a draggable waypoint')`.

**자동 수용:** pure helper deep-equal, renderer에 store/DOM/wall-clock import 0, full gate PASS.
**브라우저 수용:** BASE-02/03에서 3초 내 양 팀·공 보유자·선택·현재 step 식별. CVD/grayscale에서 색 외 단서 유지, 100/125/200%에서 번호와 badge 판독.
**롤백:** M3a/M3b 분리; 새 props는 optional/default로 도입.
**위험:** 대비를 모두 높여 clutter가 늘 수 있다. foreground 수를 제한한다.

### M4 — Direct-manipulation microinteractions (P0, L)

#### M4a — Intent-to-visual-state

**파일/함수:** `gestureIntent.ts`의 `resolvePointerIntent`, `SimplePitch` pointer down/move/up/cancel과 `gestureRef`, `AnimatedToken`, `spring.ts`, `useSpring.ts`, pitch CSS.

UI-only 타입 `InteractionVisualState = { phase: 'idle'|'pressed'|'dragging'|'settling'|'cancelled'; intent: PointerIntent['kind']|null; subjectId?: Id; snapTargetId?: Id }`를 추가한다. schema 저장 금지. helper는 DOM 없이 테스트하고 pointer capture는 `SimplePitch`에 남긴다.

**흐름:** pointer event → `resolvePointerIntent` → ephemeral visual state 즉시 갱신 → preview → 기존 `EditorCore.transaction` 또는 begin/update/commit → document → compile → renderer → transient state 해제. visual state가 command를 대신하면 실패다.

#### M4b — Snap, route, possession feedback

**파일/함수:** `SimplePitch.finishDraw`, snap candidate/ball drop/attach, `PathLayer`, `AnimatedToken`, `AppShell` toast. keymap/gesture 의미 불변.

**테스트:**

- `interactionVisualState.test.ts`: `pressed→dragging→settling→idle`, `pointercancel→cancelled→idle`, reduced final state.
- 기존 `gestureIntent.test.ts`: selection toggle/Shift authoring/Ctrl group move/path bend 충돌 없음.
- `it('shows snap feedback before commit without changing revision')`.
- `it('commits one history entry on drop and clears transient state')`.
- `it('cancels without document mutation on Escape or pointercancel')`.
- `it('keeps plain path drag as bend, Shift drag as authoring and Ctrl player drag as group move')`.
- `it('shows a persistent ownership cue when attachment animation is reduced')`.

**자동 수용:** revision/history 변화가 기존과 동일, engine/domain diff 0, full gate PASS.
**브라우저 수용:** BASE-04/05 mouse/trackpad 10회 반복, 빠른 역방향/animation 중 재입력에도 lock/jump 없음. pointer→첫 feedback 목표 ≤50ms.
**롤백:** visual state/styles와 command를 분리. effect 제거 뒤 기존 gesture는 계속 작동해야 한다.
**위험:** pointermove 전역 rerender. 고빈도 preview는 현재 SVG/local state 경계를 유지한다.

### M5 — Playback, held-result, variants and GIF staging (P1, M)

**파일/함수:** `AppShell` playback/held/export state, `SimplePitch` route hiding와 deterministic bob, `StepBar`, `exportGif.ts`의 `drawPitch/drawFrame`, shell/pitch CSS.

**흐름:** Play → 기존 playback scope/controller → `stateAt(t)` → token/ball 좌표. `playing/held/preview` → chrome/path visibility만 전환. A/B/C는 기존 독립 core/history를 즉시 교체하고 좌표 morph 금지. GIF는 같은 compiled sample과 visual constants 사용.

**테스트:**

- `AppShell / it('keeps every path hidden for the complete playing state')`.
- `it('holds the final tactical frame before restoring authoring presentation')`.
- `it('accepts play/pause/replay while decorative transitions are in flight')`.
- `it('switches A/B/C without cross-document interpolation or persistence')`.
- `exportGif.test.ts / it('uses approved pitch and team visual constants')`.
- reduced on/off에서 동일 `stateAt(t)` 좌표 deep-equal.

**자동 수용:** tactical snapshots 동일, GIF 결정론, full gate PASS.
**브라우저 수용:** Play 후 220ms 내 route/arrow 0; 주변 UI는 위치 이동 없이 물러남. pause/finish 점프 없음, 즉시 bend→replay 가능, GIF가 같은 제품 언어.
**롤백:** playback chrome/token ornament/export styling 분리; v4 route hiding은 항상 유지.
**위험:** fade가 재생 시작을 늦추는 착시. clock은 즉시 시작하고 decoration만 병행한다.

### M6 — Context, feedback and accessibility (P1, M)

**파일/함수:** `ActionsPanel/GuidePanel`, `PlayerCard`, `SelectionActionBar`, `ShortcutsOverlay`, `TourOverlay/TourStepView`, `AppShell` toast/alert/progress, `keymap.ts` 표시 데이터, CSS, a11y/tour tests.

key binding 의미는 바꾸지 않는다. 필요 시 `keymap.ts`만 source of truth. Guide/Tour/Shortcuts를 핵심 동작→문맥 도움→전체 참조로 계층화한다. compile error=actionable alert, toast=confirm, export=progress로 역할을 나눈다.

**테스트:**

- `accessibility / it('shows focus-visible on every primary keyboard stop and no pointer-only focus ring')`.
- `it('keeps desktop controls at least 28px and path hit stroke at least 14px')`.
- `it('preserves focus when PlayerCard and SelectionActionBar swap')`.
- `it('keeps status/error/progress named and not motion-only')`.
- `tour / it('disables spotlight geometry transitions under reduced motion')`.
- forced-colors에서 native outline/control 유지 contract.

**자동 수용:** tab/name/focus/reduced tests와 full gate PASS.
**브라우저 수용:** keyboard-only로 formation→select/edit→step→play→help close. 200% zoom overlap 없음. reduce에서 tactical playback 유지, scale/bob/ring/large geometry 제거.
**롤백:** panel hierarchy/overlay motion/feedback styles 분리; accessible name/focus fix는 유지.
**위험:** guide를 정리하며 discoverability 상실. 첫 tour 또는 always-visible 최소 hint는 유지한다.

### M7 — Visual QA, performance, regression closure (P1, M)

**작업:**

1. M7-01~08을 BASE와 동일 조건으로 캡처하고 차이를 목적/부작용으로 annotate.
2. 22명+8 paths drag/playback trace. 목표: pointer feedback ≤50ms, 60Hz 연속 조작에 장기 stall 없음, 50ms 초과 long task 0(GIF export 별도).
3. 100/125/200% zoom, 1280×800/1440×900, mouse/trackpad/keyboard, reduced motion, forced colors, red-green/blue-yellow/grayscale 확인.
4. `rg`로 dependency, engine/domain UI import, literal visual values, legacy selector reference 감사.
5. full gate와 실제 test count 기록. 브라우저 감각은 `EXTERNAL-VERIFICATION-PENDING`으로 사용자에게 인계.

**자동 수용:** schema/dependency diff 0, purity/determinism/transaction/full gate PASS.
**사용자 수용:** 아래 checklist 전 항목 승인. 미승인은 token 수치/장식 layer 안에서만 조정; 기능/gesture 변경은 새 plan/ADR.
**롤백:** M1~M6 단위. 실패한 visual layer만 제거할 수 있어야 한다.
**위험:** 무한 polish. Ambiguity 승인과 BASE/M7 장면을 변경 예산 경계로 쓴다.

## Global Automated Verification Matrix

| 검증 | 방법 | 통과 조건 |
| --- | --- | --- |
| Product invariants | diff+tests | simple mode, refresh clean, schema unchanged, dependencies 0 |
| Purity/determinism | imports+harness+snapshots | engine/domain UI import 0; tactical coordinates deep-equal |
| Transactions | gesture/history tests | drag/draw/bend/drop 1 commit, cancel 0 commit |
| Token contract | test+`rg` allowlist | visual values semantic source에서만 소비 |
| Readability | presentation tests+BASE/M7 | deterministic layer order, browser checklist 통과 |
| Accessibility | jsdom+manual | names/order/focus/reduce/forced-colors/zoom 통과 |
| Performance | bundle diff+trace | dependency 0, duplicate renderer 없음, targets 달성 |
| Full gate | milestone마다 명령 | 모두 PASS; 미실행을 PASS로 기록 금지 |

## Browser Acceptance Checklist — User-owned

- [ ] BASE-01/M7-01을 3초씩 보고 pitch와 Play가 먼저 보이며 glass가 전술과 경쟁하지 않는다.
- [ ] 22명+8 paths에서 양 팀, 공 보유자, 선택 선수, 현재 step을 각각 3초 안에 찾는다.
- [ ] 선수 press→drag→snap→drop, path draw→bend→cancel을 각 10회 반복해 결과가 예측 가능하다.
- [ ] 재생 중 route/arrow가 완전히 사라지고, held-result에서 편집층이 갑자기 튀지 않는다.
- [ ] A/B/C를 빠르게 바꿔도 좌표가 섞이거나 transition 때문에 입력이 막히지 않는다.
- [ ] 공 부착 feedback은 만족스럽되 과장되지 않고 effect 뒤에도 소유가 읽힌다.
- [ ] 100/125/200% zoom, 1280×800/1440×900에서 핵심 control/pitch가 겹치지 않는다.
- [ ] CVD/grayscale에서 팀·선택·경로 종류를 색 외 단서로 구분한다.
- [ ] keyboard-only/reduced-motion에서 같은 핵심 loop를 완료하고 focus를 잃지 않는다.
- [ ] 화면과 GIF의 pitch/team/ball 표현이 같은 제품처럼 보인다.

## Ambiguity Register — Approval Required Before M1

| ID | 질문 | 선택지 | 추천 | 영향 |
| --- | --- | --- | --- | --- |
| A-01 | 전체 미감의 온도? | (a) warm editorial/ivory 유지 (b) cool neutral/white (c) dark broadcast | **(a)** 기존 정체성과 pitch 중심을 함께 살린다. | canvas/surface/text 전체; M1 뒤 변경 비용 큼 |
| A-02 | 팀의 색 외 구분? | (a) home solid, away inner keyline/notch (b) 원/사각 shape (c) 번호 서체만 | **(a)** 축구 token 문법을 유지한다. | SVG, CVD, GIF |
| A-03 | deterministic run bob? | (a) 30~40% 약화 (b) 제거 (c) 현행 | **(a)** 생동감은 남기고 22명 떨림을 줄인다. | `SimplePitch` ornament |
| A-04 | Material 범위? | (a) footer/popover만 translucent, panel solid (b) header/footer (c) 현행 모두 frosted | **(a)** HIG/Constitution의 절제에 맞다. | 첫인상/depth |
| A-05 | rest 경로 노출량? | (a) 모두 유지+계층 감쇠 (b) current step 외 숨김 (c) 선택 entity만 | **(a)** 전체 전술 맥락과 기능을 보존한다. | 22명 판독성/발견성 |
| A-06 | 특정 InStat/Wyscout/BBC/Sky 화면을 닮을까? | (a) 원칙만 차용 (b) 사용자 제공 1~3개 이미지를 mood target으로 | **(a)** 브랜드 모방 없이 고유 언어를 만든다. | (b)는 M0 이미지 필요 |

승인 전에는 M0 evidence만 수행한다. 선택이 없으면 추천안을 자동 확정하지 않는다.

## Out of Scope

- 고급 모드, timeline/scrubber/track panel, 새 annotation/path type, touch 전용 gesture.
- cloud/local save, 계정, 협업, 다크 모드, 새 export format, 3D/AR, 선수 사진/kit 라이선스.
- AI/physics/engine interpolation/schema 변경.
- Liquid Glass 복제, 과한 blur/refraction, haptic/audio, particle/confetti.
- Figma/design-system/icon/motion dependency. 필요 시 bundle·maintenance 근거를 가진 별도 승인.
- `src/ui/AGENTS.md`, `PROJECT_MAP`, `CURRENT_STATE`, `CHANGELOG_AGENT` 문서 부채는 구현 완료 후 별도 memory update.
- 자동 screenshot diff 인프라. 우선 dependency 없는 BASE/M7 protocol을 쓰고 반복 회귀 시 별도 plan.

## Plan Reversal Log

| REV | 잠금된 결정 | 보호 방식 |
| --- | --- | --- |
| REV-01 | 단일 간편 모드, timeline 제거 | shell이 새 mode/navigation을 만들지 않음 |
| REV-02 | 재생 중 route/arrow 완전 숨김 | M3/M5 자동·browser 검증 |
| REV-03 | Shift 작성, path drag=bend | M4는 feedback만 추가; binding/intent 불변 |
| REV-04 | 세션 A/B/C, refresh clean | visual transition만; persistence/schema 금지 |
| REV-05 | held-result/부분 재생 | timing/좌표 불변, chrome만 전환 |
| REV-06 | 보유 공/패스 시작 부착 | attached start/locked waypoint/offset 회귀 테스트 |
| REV-07 | 사용자 피드백상 gloss·bob·depth 중시 | 제거가 아니라 A-03/A-04 아래 강도·의미 통일 |

## Rollback Strategy

- M1 token, M2 shell, M3a token, M3b path, M4 interaction, M5 playback/export, M6 feedback/a11y를 독립 단위로 유지한다.
- schema/engine을 바꾸지 않아 migration rollback 비용을 만들지 않는다.
- 각 rollback 뒤에도 22명 placement, Shift authoring, bend, possession, step playback, A/B/C, GIF가 작동한다.
- 특정 effect만 실패하면 token/variant만 되돌리고 DOM/command는 건드리지 않는다.

## Decision Log

| Date | Decision | Owner | Evidence |
| --- | --- | --- | --- |
| 2026-08-20 | 계획 승인. A-01 (a) warm ivory, A-02 (a) away 안쪽 키라인, A-04 (a) footer/popover만 translucent, A-05 (a) 전부 유지+계층 감쇠, A-06 (a) 원칙만 차용 | 사용자 | 대화 승인 ("어 승인할게" — Claude 추천안 수용) |
| 2026-08-20 | M3a 선결정: 토큰 rest는 gloss 없이 **단색**(그라데이션 제거), 보유 공 거리 [2.0, 2.6]m로 확대 | 사용자 | 대화 지시 |
| 2026-08-20 | A-03 절충: run bob 현행 강도 유지하되 동시에 움직이는 선수 수가 많으면 자동 감쇠 (Claude 제안 수용) | 사용자 | CHG-054에서 사용자가 직접 요청한 기능이므로 약화 대신 조건부 감쇠 |

## Done Report Template for Execution Owner

```text
Task: PLAN-20260821-006 / <milestone>
Risk Level: L2
Acceptance Status: IMPLEMENTED / AGENT-VERIFIED / EXTERNAL-VERIFICATION-PENDING / ACCEPTED
Changed:
Why:
Files / Functions:
Visual Evidence:
- baseline:
- after:
Validation Executed:
- npm run typecheck — PASS/FAIL
- npm run lint — PASS/FAIL
- npm test — PASS/FAIL (<actual count>)
- npm run build — PASS/FAIL
- npm run harness:verify — PASS/FAIL
Purity / Determinism / Transaction Check:
Performance Evidence:
Agent-Not-Verifiable:
External Validation Required:
- criterion / executor / procedure / expected / evidence / blocking / status
Documentation Updated:
Rollback Unit:
Remaining Risks / Next Exact Step:
```
