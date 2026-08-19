# Codex Brief — Soccer Tactics 이어받기 프롬프트

> 용도: OpenAI Codex(또는 다른 코딩 에이전트)에게 이 저장소를 넘길 때 **그대로 붙여넣는** 프롬프트.
> Codex는 저장소 루트 `AGENTS.md`를 자동으로 읽는다 — 이 프로젝트의 `AGENTS.md`는 tool-neutral 진입점이므로 그대로 통한다.
> 아래 "핵심 요구 요약"은 2026-08-19~20 사용자 피드백을 합친 것. 새 피드백이 생기면 §3만 갱신해서 다시 쓰면 된다.

---

## 붙여넣을 프롬프트

```text
이 저장소는 WHITEHAVEN Agent Harness를 쓰는 React/TypeScript 프로젝트 "Soccer Tactics"(Interactive Football Tactics Sequencer)다.
작업을 시작하기 전에 반드시 아래 순서로 읽어라. 읽지 않고 추측하지 마라.

1. AGENTS.md (진입점·불변 규칙)
2. docs/agent/CONSTITUTION.md (철학·불변조건)
3. docs/agent/CURRENT_STATE.md (현재 상태·Known Issues·다음 단계·체크리스트)
4. docs/agent/PROJECT_MAP.md (폴더 라우팅) → 손댈 폴더의 AGENTS.md (src/engine/AGENTS.md, src/ui/AGENTS.md)
5. docs/agent/decisions/DECISION_INDEX.md → 관련 ADR 본문 (특히 ADR-0001 제품 원칙, ADR-0003 엔진/도메인, ADR-0006 인터랙션/모션 + Amendments, ADR-0007 자동 대응)
6. docs/product/PRODUCT_BRIEF.md (요구사항), docs/product/UX_RESEARCH.md (HCI 근거)
7. docs/agent/plans/ACTIVE_PLAN.md, docs/agent/CHANGELOG_AGENT.md 최근 항목, docs/agent/handoffs/ 최신 파일

## 절대 규칙 (위반 시 작업 무효)
- src/engine, src/domain 은 순수 TS: React/DOM/spring/wall-clock/Math.random 금지. src/renderer 에 spring 금지. `npm run harness:verify` 가 이를 기계적으로 검사한다 — 반드시 PASS.
- 두 개의 시계: 전술 모션(선수·공 위치)은 결정론(같은 문서+t → 같은 상태, 지정 안 한 overshoot 없음). Spring/bounce 는 src/ui/motion 의 인터페이스 피드백에만.
- 문서 변경은 반드시 EditorCore transaction/commands 경유. 컴포넌트가 store를 직접 set 하지 않는다. 드래그 = undo 1 step.
- Formation/자동대응/프리셋은 "preset"이지 constraint 아님 — 생성물은 항상 편집 가능한 일반 segment.
- 최소 변경. 요청 밖 리팩토링·의존성 추가·폴더 구조 변경 금지(필요하면 이유를 적고 먼저 물어라).
- Accepted ADR 과 충돌하는 변경은 조용히 하지 말고 ADR Amendment/Supersede 를 먼저 써라.
- 검증은 실행한 것만 보고: `npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify`. 브라우저 체감은 DELEGATED(사용자)로 표기.
- 작업 끝에 docs/agent/CURRENT_STATE.md, CHANGELOG_AGENT.md(CHG-YYYYMMDD-NNN), 필요 시 PROJECT_MAP/ADR 갱신. 세션 종료 전 `npm run harness:handoff -- <topic>` 으로 Handoff 작성.
- git: 커밋은 사용자가 시키면, push 금지, 파괴적 명령 금지.
- 문서는 한국어, 코드/식별자/커밋은 영어. 단축키 바인딩은 src/ui/keymap.ts 한 곳만 수정.

## 제품 목표 (ADR-0001 요약)
정적 전술판이 아니라 시간축 위에서 선수·공의 움직임을 설계·재생하는 Sequencer. 애니메이션/타임라인이 핵심. PC(마우스+왼손 키보드), Apple 같은 조작감(인터페이스는 통통·탁 달라붙음, 전술 모션은 정확), Harmony/Immersion/Fun 3×3 기준. 직접 조작 우선(Inspector 는 정밀 조정).

## 지금까지의 사용자 피드백 (반영됨 — 회귀시키지 말 것)
- 단축키 안내 필요 → 우측 고정 도움말 패널 + `?` 오버레이 + keymap.ts 단일 소스(왼손: Q W E R / A S D / Z X C V / Space, Alt+드래그=경로, Ctrl=스냅 해제/선택 토글, Shift=직선/타원).
- 좌표 숫자는 무의미 → Inspector 는 "할 수 있는 것"(경로/패스/공 주기) 우선, 좌표는 접힘.
- 애니메이션 적용법 → 선수 위 드래그(또는 Alt+드래그/더블클릭) = 이동, 공 드래그 = 패스, 패스 후 재생 위치가 도착 시각으로 자동 이동(순차 작업 체인), 트랙 블록 드래그/리사이즈, 시작 조건 5종(시각/이전 동작 뒤/다른 동작 기준/공 놓을 때/받을 때).
- 순차 시나리오 가능해야 함 → engine.test.ts Scenario A/B 가 고정 테스트.
- 공 UI 밋밋 → 축구공 패턴·회전·로빙 높이/그림자·잔상·킥/리시브 pulse.
- 너무 어둡고 난잡, 패널이 들락날락 → 라이트 기본(☾ 토글), 우측 단일 컬럼 상시 도킹.
- 경로 선이 비실비실 → engine/path.ts beautifyStroke(리샘플→스무딩→RDP→직선 스냅|베지어).
- 경로 있어도 드래그로 고치고 싶음 → 재생 위치 t 에서 토큰 드래그 = 그 시각 움직임의 끝점 수정(shiftTailInDraft).
- 공을 휙 던지면 물리처럼 → 릴리즈 속도 → speed+decel 타이밍의 travel segment(결정론). 선수도 던지면 런.
- 상대가 반응했으면 → ADR-0007 Phase 1 규칙 기반 "자동 대응"(press/cover/shape, 공 이벤트 앵커).

## 네가 할 일
1. 위 문서를 읽고 Harness Audit 을 짧게 보고해라: 현재 상태 요약, 문서-코드 불일치(있으면), 내가 준 피드백 중 회귀 위험.
2. 그 다음 [여기에 이번 작업 목표를 적는다 — 예: "CURRENT_STATE 의 Known Issues 4/6/7 해결", "자동 대응에 공격 측 반응 추가", "path-scrub(ADR-0006 D4-1) 구현"].
3. L2 이상이면 docs/agent/plans/ACTIVE_PLAN.md 를 먼저 갱신(Objective/Verifiable End State/Milestones/Rollback)하고, 마일스톤마다 검증 명령을 돌려라.
4. 끝나면 Done Report 양식(docs/agent/DEFINITION_OF_DONE.md 하단)으로 보고: 바꾼 것, 이유, 파일, 실행한 검증과 결과, 사용자가 브라우저에서 확인할 체크리스트, 롤백 방법, 갱신한 문서.
```

---

## 사용 팁

- §"네가 할 일" 2번 괄호에 구체 목표만 바꿔 넣으면 된다. 목표가 여러 개면 우선순위 번호를 매겨라.
- 큰 방향 전환(레이아웃 옵션 변경, 엔진 모델 변경, 의존성 추가)은 프롬프트에 "먼저 ADR 제안만 하고 멈춰라"를 덧붙여라.
- Codex 가 `.claude/settings.json`(Claude 전용 hooks/deny)을 읽지 않는 건 정상. 대신 `npm run harness:verify` 가 동일 규칙을 검사한다.
- 새 세션마다 CURRENT_STATE 의 "Next Exact Steps" 를 프롬프트 목표로 옮겨 쓰면 맥락이 끊기지 않는다.
