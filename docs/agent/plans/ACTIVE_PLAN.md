# ACTIVE PLAN — PLAN-20260823-014: 핵심 재현 무결성 감사, Phase 1 (개정 v2)

Plan ID: PLAN-20260823-014
Status: Ready — G0만 먼저 실행 가능하며, M1/M2는 G0 PASS 전까지 착수 금지
Level: L2 — 전량 테스트 안정화 + domain/engine/editor Node/Vitest 감사
Trigger: 사용자 2026-08-23 Claude Code 리뷰 — 기준선, 브라우저 전제, 범위, 측정 기준을 수정
Canonical Plan: [PLAN-20260823-014-total-verification-audit.md](./PLAN-20260823-014-total-verification-audit.md)

## Objective

전량 실행에서만 위치가 이동하는 AppShell playback 실패를 G0에서 먼저 수리한 뒤, 브라우저 없이 I1~I10 mutation-kill과 junction read/write graph, `compile`/`stateAt`/`relayoutStepsInDraft` parity를 감사한다. 이 계획은 core document/engine pipeline만 판정하며 UI/renderer/UX 폐쇄를 선언하지 않는다.

## Verifiable End State

- G0: root cause와 회귀 방어가 고정되고 AppShell 단독 3회, 기본 전량 3회, serial 전량 1회가 연속 PASS한다.
- M1: I1~I10 mutant가 모두 `KILLED/MASKED/SURVIVED`로 분류되고 `SURVIVED` 0만 core closure를 지지한다.
- M2: 모든 junction reader/writer가 역할·reachability를 가지며 6개 core fixture의 relayout/compile/stateAt semantic mismatch가 0이다.
- 사전 resolver/호출/latency 목표를 두지 않는다. 수치와 역할을 먼저 측정하고 remediation 기준은 이후 결정한다.
- 기본 tacticFuzz와 표준 5게이트를 실행한다. 7200 soak, browser probe, marathon, UX polish는 이 Phase의 gate가 아니다.
- 결과는 `Core Closure Supported / Not Supported / Insufficient Evidence` 중 하나로 보고한다.

## Current Baseline

- 사용자 재실행: AppShell 단독 **PASS 12/12**, 전량 **FAIL 1/291** at `AppShell.test.tsx:186`.
- Codex 재확인: AppShell 단독 **PASS 12/12**, 직후 전량 **FAIL 2/291** at `:186`, `:359`.
- 결론: 특정 assertion의 지속 실패가 아니라 전량 실행의 순서/부하/real rAF·wall-clock/cleanup 의존 선행 결함이다. G0 전에는 M1/M2 FAIL을 귀속하지 않는다.
- `package.json`에 Playwright/Puppeteer가 없고 `pw/`/tracked `.cjs`도 없다.

## Execution Order

1. **G0 BLOCKING** — AppShell/full-suite timing·isolation 결함 최소 재현 및 수리.
2. **M1** — I1~I10 test-only mutation-kill.
3. **M2** — junction authority graph + 6-fixture core parity + 측정 baseline.
4. **M3** — 표준 gate와 core closure 판정.

세부 방법·통과 기준·Findings·Gate Matrix는 canonical plan을 따른다.

## Decision Gate — DG-BROWSER

브라우저 후속 D/E PLAN 전에 사용자가 다음 중 하나를 확정해야 한다.

1. tracked Playwright devDependency + version-locked `pw/` manifest/probes(권고),
2. version/source/artifact가 고정된 external harness,
3. browser audit 생략 및 UI/UX/전체 제품 폐쇄 `NOT VERIFIED` 수용.

이 결정은 G0/M1/M2를 막지 않지만 D-browser/E 착수를 막는다. 승인 없이 dependency를 추가하지 않는다.

## Follow-up Plans

- C 문서 drift: 0.5~1일, 문서 4~6개.
- D-static: 0.5~1일, test 2~4개 파일.
- D-browser: DG-BROWSER 뒤 0.5~1일, 핵심 probe 약 4개.
- E-core: DG-BROWSER 뒤 1~2일, probe 3~5개 + 사용자 DELEGATED.
- E-polish(contrast/CLS/ultrawide/Zen): 선택적 0.5~1일, 최후순위.

## Ambiguity Register

- AMB-01 — D1 2안: M2 측정 후 별도 L3에서 결정.
- AMB-02 — 새 numeric tolerance: measurement note 뒤 결정.

브라우저 runtime은 Ambiguity가 아니라 `DG-BROWSER`다.

## Rollback

G0와 audit-only test/measurement artifact 외 product 변경은 하지 않는다. 범위가 커지면 이 계획을 늘리지 않고 새 PLAN을 만든다. 실패 detector를 assertion/tolerance 완화로 녹색화하지 않는다.

## Plan Reversal Log

| 날짜 | 변경 | 이유 | 영향 |
|---|---|---|---|
| 2026-08-23 | v1 총검증 단일 계획 → v2 G0 + core M1/M2 | 이동 flake, browser 전제, 과대 범위, 사전 수치 기준 | C/D/E 분리, browser gate 승격 |
