# ADR-0004: Rendering Technology and Pitch Coordinate System

Status: Accepted (2026-08-19 세션 2 — 미터 좌표 채택, A-02 기본안)
Date: 2026-08-19
Decision Owners: Agent proposal / User approval
Related: ADR-0001 (원칙 9,12), ADR-0002, ADR-0003

## Context

요구: 선수 drag, path/bezier 편집, hit testing, crisp, zoom, 반응형 좌표, export, 애니메이션, 접근성, 유지보수, 22+명+공+다수 annotation. WebGL 과도 도입 금지.

## Part A — Rendering

### Considered Options

| 기준 | SVG (React) | HTML+SVG hybrid | Canvas 2D 직접 | Konva/react-konva |
|---|---|---|---|---|
| drag / hit-test | DOM 이벤트, 무료 | 동일 | 직접 구현 | 내장 |
| bezier 편집 handle | `<path>` + 원 handle, 쉬움 | 동일 | 직접 | 가능 |
| crisp/zoom | viewBox 벡터, 무한 | 동일 | DPR 관리 필요 | DPR 관리 |
| 반응형 좌표 | viewBox=pitch 단위 → 자동 | 동일 | 수동 변환 | 수동 |
| export | SVG 직렬화 → PNG 변환 쉬움 | 거의 동일 | toDataURL | toDataURL |
| 접근성 | role/aria, 포커스 가능 | 최상 | 없음(별도 DOM 필요) | 없음 |
| 60fps 23 엔티티 | 충분 (attr 직접 갱신) | 충분 | 최상 | 좋음 |
| 유지보수 | React 선언적 | 레이어 2개 관리 | 명령형 | 추가 런타임+추상화 |
| freehand 대량 점 | path 길어지면 무거움 | 동일 | 유리 | 유리 |

### Decision (Proposed)

**React-managed SVG 단일 레이어 기본.** 모든 pitch 객체(pitch 라인, zone, path, token, ball, handle, ghost)를 `<svg viewBox="0 0 105 68">` 내 계층 `<g>`로 렌더.
- 재생 중: token/ball은 `ref`로 `transform` 직접 갱신(rAF), React 리렌더 회피. 편집 중: React state 경로.
- HTML 오버레이는 pitch 밖 UI(인스펙터, 툴바, 컨텍스트 메뉴)만. 라벨/번호는 SVG `<text>`.
- freehand 대량 스트로크로 성능 문제 발생 시에만 해당 레이어를 Canvas로 분리(Revisit).
- Konva/WebGL 불채택: 접근성·export·선언성 손실 대비 현재 규모에서 이득 없음.

## Part B — Coordinates

### Considered Options

| | 정규화 0..1 | **미터 (105×68 기본)** 추천 |
|---|---|---|
| 의미 | 비율 | 실제 거리 |
| 속도/거리 | 의미 없음(가로세로 스케일 다름 → 곡선·속도 왜곡) | m/s, 걷기/조깅/스프린트 preset 자연스러움 |
| pitch 크기 변경 | 모든 좌표가 암묵적 재해석 | pitch 치수 바뀌면 좌표 의미 유지 |
| half pitch / zoom | 변환 필요 | viewBox만 변경 |
| 직렬화 | 단순 | 단순 (pitch 치수 동봉) |

### Decision (Proposed)

- 도메인 좌표 = **미터**, 원점 좌상단, x∈[0,length], y∈[0,width], 기본 105×68 (document `pitch`에 명시, 변경 가능).
- Renderer: `viewBox = 0 0 length width` + `preserveAspectRatio="xMidYMid meet"`. pixel 변환은 SVG가 담당. pointer → 도메인 변환은 `getScreenCTM().inverse()` 한 곳에서만.
- Zoom/pan = viewBox 조작. 데이터 불변.
- Half-pitch view = viewBox 절반 (데이터 불변).
- Speed presets (m/s, 편집 가능): walk 1.5, jog 3.5, run 5.5, sprint 8. pass 기본 12–18, shot 20+ (ADR-0003 Timing.speed).

## Consequences

- (+) resize/zoom 후 선수·공·path·waypoint·annotation 관계 보존(요구 §19).
- (+) 속도 preset이 현실적 → 초보자에게 "duration 입력" 대신 "조깅/스프린트" 선택 가능(Discovery Delight).
- (−) UI에서 "미터" 노출은 최소화(좌표 숫자는 Inspector 정밀 조정에서만).

## Revisit Conditions

- freehand/대량 annotation 성능 문제 → Canvas 레이어 혼합.
- 풋살/다른 종목 pitch 요구 → pitch 치수 데이터화로 이미 대응.

## Validation

- 브라우저 리사이즈·zoom 후 token↔path 정렬 시각 확인 (DELEGATED/SHARED).
- pointer→domain 변환 단위테스트 (viewBox 스케일 가정).
