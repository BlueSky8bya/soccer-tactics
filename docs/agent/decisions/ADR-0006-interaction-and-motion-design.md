# ADR-0006: Interaction & Motion Design System (PC, HCI-grounded, Apple-like feel)

Status: Accepted
Date: 2026-08-19
Decision Owners: User (지시: "절대로 레퍼런스대로 하지 말고, HCI적으로 PC에서 편리, 몰입·재미·조화, 애플처럼 통통 튀고 탁 달라붙는 조작감, 자료 조사 필요") / Agent 설계
Related: ADR-0001 (원칙 6,7,8,16), ADR-0003, ADR-0004, ADR-0005, VDR-0001 (anti-reference), `docs/product/UX_RESEARCH.md`, `docs/product/UX_LAYOUT_PROPOSAL.md`
Supersedes: —

## Context

사용자 요구: 레퍼런스 보드(VDR-0001, 사이드바 텍스트 버튼 나열)와 다르게, 데스크톱 마우스+키보드 환경에서 HCI 근거 위에 설계. Harmony/Immersion/Fun 3×3 충족. UI는 Apple식 spring("통통 튀고 탁 달라붙는"), 전술 모션은 결정론(ADR-0001 원칙 7).
근거 수집: `docs/product/UX_RESEARCH.md` (39 출처). 이 ADR은 그 근거를 **구체 수치·규칙**으로 고정한다.

## Decision

### D1. 두 개의 시계 (Two Clocks)
- **UI Clock**: spring/ease, 120–400ms, 언제든 중단·재타깃, `prefers-reduced-motion` + 앱 토글로 끔. 대상: 패널·툴·선택 링·핸들·토큰 pickup/drop·타임라인 블록 스냅·토스트.
- **Tactical Clock**: 실초(s), 선형 또는 사용자가 고른 easing만, 물리 속도 preset, 재생/scrub에 spring 영향 0. reduce-motion에도 유지(WCAG 2.3.3 essential).
- 코드 경계: `src/ui/motion/`만 spring 사용. `src/engine/`·`src/renderer/`의 위치 계산에 spring 금지 (verify-harness가 `src/engine`, `src/renderer`에서 `spring`/`motion/react` import 검사).

### D2. Spring 파라미터 (WWDC23 duration+bounce 모델)
| 용도 | duration | bounce | 비고 |
|---|---|---|---|
| 선택 링 등장 / hover 확대 | 0.18s | 0 | 빈번 → flourish 금지 |
| 툴 전환 하이라이트 | 0.2s | 0 | |
| 토큰 pickup (scale 1→1.06, shadow) | 0.22s | 0.1 | 1:1 추적, 지연 0 |
| 토큰 drop / 스냅(formation slot, 그리드, 가이드) | 0.35s | 0.25 | **"탁 달라붙음"** |
| 타임라인 블록 스냅(이웃 끝, playhead) | 0.3s | 0.2 | |
| Inspector 슬라이드 인 / 아웃 | 0.3s / 0.22s | 0.1 / 0 | 등장>퇴장 |
| 타임라인 펼침(⌃ tracks) | 0.32s | 0.15 | |
| 컨텍스트 미니바 등장 | 0.24s | 0.15 | 선택 근처에서 scale+fade |
| 토스트/완성 피드백 | 0.4s | 0.3 | Completion Delight, 1회성이라 bounce 허용 |
| reduce-motion | 0 또는 ≤100ms fade | 0 | |
- 구현: 순수 TS `spring(duration, bounce)` → stiffness/damping 변환, rAF 기반, 재타깃 시 현재 속도 계승. CSS transition은 단순 opacity/color만(`--st-motion-*` 토큰). 라이브러리(`motion/react`) 도입은 M4에서 자체 헬퍼로 부족할 때만(ADR-0002).

### D3. 직접 조작 규칙 (Fluid Interfaces + Fitts)
- 드래그 = 커서에 지연 0 고정. 드래그 중 문서 즉시 갱신(transaction, ADR-0005). Esc = cancel 복원.
- hit 영역: 토큰 ≥ 28px, waypoint/handle/playhead ≥ 16px(시각 8–10px, hover 시 spring 확대), 타임라인 블록 edge-resize ≥ 8px. 불가시 패딩 + hover 시각화 둘 다.
- 가장자리 도킹: 좌 툴 레일, 하단 재생바(Fitts 무한 타깃). 상단바 얇게.
- 스냅/가이드: 같은 팀 정렬(수평/수직 라인), pitch 랜드마크(센터, 페널티 스팟, 박스 모서리), formation slot. Alt 누르면 스냅 해제. 스냅 시 spring(D2) + 햅틱 대용 미세 scale pulse.
- rubber-band: pitch pan 경계, 타임라인 scrub 경계.
- 투사(momentum): 토큰 fling 시 투사 거리로 착지 → 가장 가까운 스냅 후보에 spring 정착. pitch 밖으로는 못 나감(clamp + rubber-band).

### D4. 시그니처 인터랙션 (novice authoring 근거)
1. **Path-scrub** (DimP): 경로가 있는 선수/공을 경로 따라 드래그하면 전역 playhead가 그 시각으로 이동, 다른 엔티티 동기. 교차 시 현재 playhead에 가까운 시각. ghost 마커.
2. **Record 모드** (K-Sketch): 도구 `Record` 선택 → 선수 드래그하는 동안 실시간 녹화 → 경로(간소화 polyline→스무딩 bezier)+타이밍 동시 생성. 이후 waypoint/속도로 정제. v1 M3 후보, M2엔 데이터 구조 준비.
3. **Path 위 on-canvas 컨트롤** (Draco): 선택된 경로 끝에 "속도 pill"(walk/jog/run/sprint, 드래그로 미세), 시작 시각 pill("0.4s 후" / "A 도착 시"). Inspector 안 열어도 됨.
4. **Link 편집** (Kitty): 시작 조건을 "다른 엔티티의 시점"으로 연결 — pill을 다른 경로/공 이벤트로 드래그-드롭하면 `onEvent`/`afterSegment` trigger 생성.
5. **Phase 복제** (Magic Move): Scene 복제 → 선수 재배치 → 자동 move segment 생성. Scene 모델(ADR-0003) 활용, M3+.

### D5. Progressive Disclosure (2단계 한정)
- L1 기본 화면: 툴 레일(선택·이동 / 선수 추가 / 공 / 경로 / 구역 / 텍스트, 6개 + more), 상단바(제목·Formation·Undo/Redo·Play), 하단 1줄 재생바(Play/Pause/Restart/Scrubber/Speed/⌃).
- L2: ⌃ → entity tracks(팀 밴드, segment 블록 drag/resize, 마커). Inspector(선택 시 슬라이드).
- L3 없음. 고급 옵션은 L2 안 섹션 접기.

### D6. 레이아웃 = Option 3 Focused Hybrid (UX_LAYOUT_PROPOSAL)
Pitch ≥ 65% 폭 / ≥ 55% 높이 유지. 미선택 시 빈 패널 없음. 모든 패널 spring 슬라이드, 레이아웃 점프 없음(Continuity).

### D7. 키보드 1급 (PC)
Space 재생/정지 · ←/→ 0.1s step(Shift 1s) · Home/End · V 선택 · P 경로 · B 공 · Z 구역 · T 텍스트 · R record · Ctrl/Cmd+Z/Shift+Z · Delete · Esc cancel · 화살표 nudge 0.5m(Shift 2m, 500ms 내 병합) · Alt 스냅 해제 · Tab 다음 엔티티. 모든 단축키는 tooltip/컨텍스트 메뉴에 표기(인식>회상).

### D8. 시각 언어 (Visual Harmony)
- 색: 중립 surface(light/dark 자동) + 팀색 2 + accent 1(선택/재생). 도구 버튼에 다색 금지(VDR-0001 anti-pattern).
- 경로 인코딩: 이동 = 실선+arrowhead, 패스 = 점선, 로빙 = 점선+호 표시, 슛 = 굵은 실선, 선택 경로 = accent glow + waypoint 노출, 비선택 = 60% opacity.
- 토큰: 팀색 원 + 흰 테두리 + 번호. 보유 시 공이 토큰 가장자리에 붙음. 선택 = accent 링(bounce 0).
- 타이포: 시스템 폰트(SF/Segoe/Pretendard), 2 weight. 4pt 그리드, radius 토큰 3단.
- 다크/라이트 둘 다 토큰으로.

### D9. Harmony/Immersion/Fun 매핑 (주요 결정이 어느 칸을 개선하는지)
| 결정 | Harmony | Immersion | Fun |
|---|---|---|---|
| D1 두 시계 | Functional | Control | — |
| D2 spring 표 | Visual | — | Response |
| D3 hit/스냅/rubber-band | Functional | Control | Response |
| D4 path-scrub·record·on-canvas pill | Contextual | Continuity, Focus | Discovery |
| D5 2단계 disclosure | Contextual | Focus | Discovery |
| D6 레이아웃 | Visual | Focus, Continuity | — |
| D7 키보드 | Functional | Control | — |
| D8 시각 언어 | Visual | Focus | — |
| 완성 피드백(재생 시 패널 접힘 옵션+토스트) | — | — | Completion |

## Amendment 2026-08-20 (사용자 피드백 라운드 3)

- **D6 수정 — Inspector 상시 도킹.** "선택 시만 슬라이드 인" 방식은 클릭마다 패널이 들락날락해 불편(사용자). → 우측 컬럼(296px) 상시 고정, 선택에 따라 **내용만** 교체. 폭 spring 제거. 미선택 시 안내 문구. Pitch 폭: 1440px 기준 ≈ 75% 유지.
- **단일 우측 컬럼**: 속성(위) + 도움말(아래, 접기·기억). 별도 도움말 컬럼 제거(난잡 해소).
- **D8 수정 — 라이트 테마 기본.** OS 다크여도 밝은 크롬이 기본(사용자: "너무 어둡다"). 상단 ☾/☀ 토글로 다크 선택 가능(localStorage). 크롬 대비 낮추고(surface/border 토큰), 카드 테두리 대신 연한 배경, 그림자 토큰 3단.
- 도움말 행: 2열 그리드 → flex(키 칩 고정폭, 설명 1줄) — 줄바꿈 난잡 제거. 설명 짧게.

## Amendment 2026-08-20 (사용자 피드백 라운드 4 — 조작감·단축키)

- **D7 전면 개정 — 왼손 키맵.** 오른손은 마우스, 왼손은 Q W E R / A S D / Z X C V / Space / Alt·Ctrl·Shift. 단일 소스 `src/ui/keymap.ts`(키보드 훅·툴 레일·도움말·오버레이가 모두 여기서 읽음).
  - 도구: Q 선택 · W 선수 · E 경로 · R 화살표 · A 구역 · S 텍스트 · D 공 주기 · 1/2 팀.
  - 모디파이어: **Alt+드래그 = 경로/패스 그리기(도구 전환 없이)** · Shift(그리는 중) = 직선 · Ctrl(드래그 중) = 스냅 해제 · Ctrl/Shift+클릭 = 선택 토글.
  - 재생: Space · Z/X ±0.1s · C 처음 · V 트랙 · G 반복. 편집: Ctrl+Z/Y/A/S/O, Delete, Esc, Tab, ?.
  - Alt 는 키 명령으로 쓰지 않는다(드래그 전용).
- **D3 추가 — 휙 던지기(fling).** 릴리즈 속도 ≥22 m/s(피치 단위) → 드래그를 취소하고 결정론 segment 생성: 공 = `timing {speed, decel:4}` travel(정지점 근처 선수 있으면 패스, 없으면 루즈볼) · 선수 = 방향으로 직선 런(거리 = 속도 비례, easeOut). 물리 느낌은 재생 엔진의 감속 운동학(`s=v0t−½at²`)으로, UI spring 이 아님(두 시계 유지).
- **D3 추가 — 재생 위치에서 드래그 = 그 시각 움직임의 끝점 수정**(`shiftTailInDraft`: 활성/직전 segment 끝 + 이후 segment 평행 이동). t=0 또는 움직임 없음 → 시작 위치 수정(첫 waypoint 자동 동행).
- **D4 보강 — 스트로크 전처리** `engine/path.ts beautifyStroke`: 리샘플 0.5m → 5탭 스무딩 ×2 → RDP(ε 1.0, 최대 6점) → 거의 직선이면 정확한 직선(축 ±6° 스냅) 아니면 Catmull-Rom 베지어(tension 0.45). Shift = 강제 직선.
- 온보딩 카드 제거(사용자). 도움말은 우측 하단 도킹 + `?`.

## Consequences

- (+) 레퍼런스와 명확히 다른, 근거 있는 설계. 수치가 고정되어 M1–M4 구현이 일관.
- (+) 엔진 결정론 보존(spring 경계 기계 검사).
- (−) 자체 spring 헬퍼·path-scrub·record 구현 비용. → M2(path-scrub), M3(record), M4(spring 전면) 단계적.
- (−) 접근성: 키보드 전용 경로 편집은 M4 체크리스트 필요.

## Revisit Conditions

- 사용성 테스트에서 path-scrub이 혼란 유발 시(교차 모호성) → 토글 옵션.
- 자체 spring으로 interruptible 품질 부족 → `motion/react` 도입(ADR-0002 갱신).

## Validation

- DIRECT: verify-harness — `src/engine`, `src/renderer`에 spring/motion import 없음. spring 헬퍼 단위테스트(정착 시간, bounce 0 비오버슈트).
- DELEGATED(사용자): M1/M4 체크리스트 — 스냅 "달라붙음" 체감, 드래그 지연 0, reduce-motion 시 UI만 정지, Pitch 비율 유지.
