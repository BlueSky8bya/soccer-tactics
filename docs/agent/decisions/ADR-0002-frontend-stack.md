# ADR-0002: Frontend Stack

Status: Accepted (2026-08-19 세션 2 — 사용자 추천안 채택, 이의 없음)
Date: 2026-08-19
Decision Owners: Agent proposal / User approval
Related: ADR-0001, ADR-0003, ADR-0005

## Context

빈 저장소. 로컬 툴체인: node 22.14, npm 10.9 (pnpm/yarn 없음). 사용자의 이전 프로젝트 관행: npm, TypeScript, Vitest. 백엔드 없음(v1 non-goal).
핵심 = 고빈도 직접 조작 에디터 + 결정론적 애니메이션 엔진. UI 애니메이션 라이브러리에 엔진을 종속시키면 안 됨.

## Decision Drivers

- 에디터 상호작용 품질 (drag, path edit)
- 엔진을 순수 TS로 분리·단위테스트 가능
- 의존성 최소, 유지보수성
- 사용자 친숙도 (npm, Vite)

## Considered Options

### A. React 19 + TypeScript + Vite (추천)

장점: 사용자 친숙, 생태계, SVG를 선언적으로 다루기 쉬움, Vitest 통합.
단점: playback 60fps에서 React 리렌더 비용 → 재생 중에는 rAF + ref 기반 imperative 업데이트로 우회 (ADR-0003).

### B. Svelte/SolidKit

장점: fine-grained reactivity, playback에 유리.
단점: 사용자 이전 경험과 불일치, 생태계 좁음.

### C. Vanilla TS + 자체 미니 프레임워크

장점: 의존성 0.
단점: 에디터 UI 규모에서 생산성 저하.

## Decision (Proposed)

```text
Runtime:   React 19, TypeScript 6 (strict), Vite 8, Vitest 4 (2026-08 템플릿 기준)
State:     Zustand (+ immer) — document store / history store / ui store 분리 (ADR-0005)
Styling:   CSS Modules + CSS custom properties(design tokens). Tailwind 미사용(토큰 체계 직접 통제, 의존성 절감)
UI motion: Motion (framer-motion 후속, `motion/react`) — UI 요소 spring 전용. 엔진과 무관. 도입 시점 M4, 필요성 재확인 후.
Engine:    순수 TS, 외부 애니메이션 라이브러리 의존 0 (ADR-0003)
Render:    React-managed SVG (ADR-0004)
Test:      Vitest (+ @testing-library/react 필요 시), Playwright는 M4 이후 검토
Lint/Fmt:  oxlint (Vite 8 공식 템플릿 기본, 빠름·설정 0) + Prettier. ESLint 미사용(2026-08-19 템플릿 확인 후 변경)
Pkg:       npm
```

production dependency 초기: `react`, `react-dom`, `zustand`, `immer`. 그 외는 ADR 또는 Changelog에 이유 기록 후 추가.
id 생성: `crypto.randomUUID()` (의존성 없음).
schema 검증(저장/불러오기): v1은 수기 타입 가드; `zod`는 M5 persistence에서 필요성 재평가.

## Consequences

- (+) 엔진 단위테스트가 DOM 없이 돌아감 → Scenario A를 테스트로 고정 가능.
- (+) 디자인 토큰을 CSS 변수로 통제 → Apple-like 일관성(Visual Harmony).
- (−) Tailwind 부재로 초기 스타일 작성량 증가 — 토큰+모듈로 상쇄.

## Revisit Conditions

- playback 성능이 React 경로로 해결 안 될 때(Canvas 레이어 혼합 검토, ADR-0004).
- 사용자가 특정 스타일 체계 선호를 표명할 때.

## Validation

- `npm run typecheck && npm run lint && npm test && npm run build` 통과.
- `src/engine/`가 `react`를 import하지 않음 (lint rule 또는 verify-harness로 검사).
