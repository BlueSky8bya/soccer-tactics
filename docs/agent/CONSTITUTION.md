# Constitution — Soccer Tactics

> 바뀌지 않는 것들. 매뉴얼이 아니다. 세부는 각자 있어야 할 곳에 있고, 여기선 그곳을 가리킨다.

## 1. Mission

사용자가 축구 상황을 **시간축 위에서** 설계하고 애니메이션으로 설명하게 하는 **Interactive Football Tactics Sequencer**.
= Tactical Board + Motion Path Editor + Timeline Sequencer + Scenario Player. ([ADR-0001](decisions/ADR-0001-product-identity-and-core-principles.md), [Product Brief](../product/PRODUCT_BRIEF.md))

판단 기준 두 가지:

- 이 기능이 사용자가 축구 상황을 더 쉽고·정확하고·즐겁게 설명하게 하는가?
- "먼저·다음·그 순간 공이·이후 반응"이라는 머릿속 장면을 Timeline에 거의 그대로 표현할 수 있는가?

## 2. Product philosophy

- **Animation/Timeline이 핵심.** 정적 보드로 MVP를 끝내지 않는다.
- **Simple by default, powerful when needed.** 2단계 progressive disclosure, 3단계 없음.
- **직접 조작 우선.** Inspector는 정밀 조정. 시그니처: 경로 따라 드래그 = 시간 scrub, 시연 녹화. ([ADR-0006](decisions/ADR-0006-interaction-and-motion-design.md))
- **Apple-like = interaction quality.** 시각 복제 아님. glass/blur 남발 금지.
- **Formation은 preset, constraint 아님.**
- 평가 틀: Harmony(Visual/Functional/Contextual) × Immersion(Focus/Continuity/Control) × Fun(Response/Discovery/Completion). 주요 UX 결정은 이 중 무엇을 개선하는지 말할 수 있어야 한다.

## 3. Architecture philosophy

```text
Interaction → Commands(transactional) → TacticDocument(JSON) ⇄ History
           → compile(doc) → CompiledTimeline → stateAt(t) → ResolvedState → Renderer(SVG) / Timeline UI / Inspector
```

- Document = 의도의 진실. Engine = 시간 해석. Renderer = 표시. Renderer는 위치를 소유하지 않는다. ([ADR-0003](decisions/ADR-0003-animation-engine-and-domain-model.md))
- React-managed SVG, 도메인 좌표 = 미터(105×68, viewBox). pixel 종속 금지. ([ADR-0004](decisions/ADR-0004-rendering-and-coordinates.md))
- 3 store(document/history/ui), immer patches transaction. drag = 1 undo step. ([ADR-0005](decisions/ADR-0005-editor-state-and-history.md))
- Stack: React 19 + TS + Vite, Zustand+immer, CSS Modules+tokens, Vitest, oxlint. ([ADR-0002](decisions/ADR-0002-frontend-stack.md))

## 4. Critical invariants

1. `src/engine`, `src/domain`은 순수 TS: React/DOM/spring/wall-clock import 금지. (BR-ENGINE-001, MACHINE: `npm run harness:verify`) 예외: `domain/factories.createEmptyDocument`의 `createdAt` 기본값(주입 가능, 엔진 시간 아님)은 허용 — verify-harness 주석 참조.
2. **두 개의 시계**: Tactical Motion은 결정론(같은 doc+t → 같은 상태, 지정 안 한 overshoot 없음). Interface Motion(spring)은 `src/ui/motion`에만.
3. Player와 Ball은 독립 track. Ball은 possession attach/detach 모델. 공을 선수 위치에 단순 종속시키지 않는다.
4. 시간 관계(delay/sequential/triggered)는 데이터가 표현한다. simultaneous-only 금지.
5. Document는 항상 JSON 직렬화 가능. 렌더/브라우저 state 종속 금지.
6. 모든 document 변경은 command/transaction 경유. 컴포넌트가 store를 직접 set 하지 않는다.
7. Formation 적용 후에도 모든 엔티티 자유 이동.
8. UI 모션은 `prefers-reduced-motion` 존중; 전술 재생은 콘텐츠라 유지.

## 5. Change boundary

- 기본 Task Risk L1. 새 기능/route/데이터 흐름/의존성 = L2 → ACTIVE_PLAN. 스키마 마이그레이션·파괴적 데이터 = L3.
- production dependency 추가·public schema 변경·폴더 구조 변경은 사유 기록 + 사용자 확인.
- 요청 밖 리팩토링/정리 금지.

## 6. Ambiguity policy

저장소에서 확인 가능한 것은 묻지 않는다. 결과를 바꾸는 모호성만 작은 묶음으로, 선택지+추천+영향과 함께 묻는다. 답변은 같은 턴에 기록한다.

## 7. Decision preservation

Accepted ADR/VDR과 충돌하면 조용히 덮지 않는다 → 충돌 설명 → 사용자 확인 → Superseded 표기 → 새 record → 코드. 삭제로 역사를 지우지 않는다. artifact가 본체인 결정은 canonical artifact와 함께 VDR로.

## 8. Verification

실행한 검증만 증거. `PASS/FAIL/NOT RUN` + 명령. DELEGATED 검증(브라우저 체감·시각 품질)은 실행 주체·절차·기대 결과·증거를 적는다. `AGENT-VERIFIED` ≠ `ACCEPTED`. ([DoD](DEFINITION_OF_DONE.md))

## 9. Repository memory

세션 기억 금지. Decision-Bearing Turn은 같은 턴에 기록(ADR/VDR/Plan/Current State). `CURRENT_STATE`는 현재만, 완료 역사는 Changelog/Handoff. Continuity Break 전 Handoff. 의미 있는 behavior change에는 `[WH-CHANGE ...]` annotation.

## 10. Reversibility

milestone 단위로 변경·검증·기록. 파괴적 git(reset --hard, clean, force push)과 auto commit/push 금지. 기존 사용자 변경 보존.

## 11. Domain critical routing

Risk Profile = GENERAL만. 계정/서버 공유/개인데이터/결제 도입 시 [RISK_PROFILE](RISK_PROFILE.md) 재평가 후 도메인 룰 추가.
