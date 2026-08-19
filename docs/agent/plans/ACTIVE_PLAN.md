# Active ExecPlan

Plan ID: PLAN-20260820-004
Status: In Progress (R1~R11 완료 — R11: 간편 모드 v2)
Task Risk: L1
Created: 2026-08-20
Updated: 2026-08-20
Execution Owner: Claude Code (R1은 자체 계획·소규모)

## Objective

PLAN-003 결과의 브라우저 체감 피드백 수집 → 다음 목표 확정. 후보(Codex Audit 범위 밖 목록): schema/ADR 정합화(import nested validation), Inspector transaction coalescing(ADR-0005), playback React 렌더 프로파일링(11v11), command 경계 통합, renderer→editor 역참조 정리, ADR-0008 공격 반응(승인 시), Record 모드, Scene/Phase.

## Verifiable End State

- 피드백 항목이 ISSUE로 등록되고 Plan 목표로 변환됨.

## Ambiguity Register

| ID | Question | Materiality | Options | Recommendation | Resolution |
|---|---|---|---|---|---|
| D-01 | 커밋 시점 | Low | 지금 / 리뷰 후 | **지금** | Resolved: `7ce964f` 커밋 |

## Plan Reversal Log

| ID | Previous Plan / Assumption | New Evidence | Invalidated Scope | Replacement Plan | Preserved Work |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## Validation Commands

```text
npm run typecheck && npm run lint && npm test && npm run build && npm run harness:verify
```

## Progress Log

### 2026-08-20
- Plan 생성(Draft). PLAN-003 Completed → completed/PLAN-20260820-003-review-round.md.

### 2026-08-20 — R1 위생 (Claude Code)
- import 중첩 검증, Inspector coalescing, geometry→engine, teamColor 분리, 문서 정합화. 81 tests/build/harness PASS. CHG-20260820-009.
- 남은 후보: playback 렌더 프로파일링(브라우저 측정 필요), command 경계 통합(SegmentInspector 인라인 transaction → commands), ADR-0008, Record, Scene/Phase.

### 2026-08-20 — R2 첫 방문 워크스루 (Claude Code, 사용자 지시 "처음 방문자로 판단")
- Playwright(scratchpad, 프로젝트 의존성 아님)로 빈 localStorage 첫 방문 시뮬레이션 → 발견: 빈 필드 무안내, 일반 드래그가 fling으로 오인(버그), 공 무소유, 자동 대응 기본 팀/빈 팀, 오버레이 개발자 문구.
- 구현: EmptyState 런처, GettingStarted 체크리스트, fling stale 검사+임계 45, 첫 채움 공 보유자, 자동 대응 기본/경고, chevron. 89 tests/build/harness PASS. CHG-20260820-010.
- 다음 후보(발견됐으나 범위 밖, L2 → Codex 계획 권장):
  - **리드 패스**: 패스 끝점이 팀원의 이동 경로 근처면 그 선수를 수신자로 잡고 도착 시각에 맞춰 패스 시작을 늦춤(현재는 도착 시각에 그 자리에 있는 선수만 받음 → 초보자는 "달리는 선수에게 패스"가 안 됨).
  - 루즈볼이 선수 위에 멈추면 공 토큰이 번호를 가림(z-order/오프셋).
  - 새 경로 시작=재생 위치: 재생 중 멈춘 뒤 그리면 0.8s 등에서 시작 — 의도된 동작이나 첫 방문자에게 설명 필요(체크리스트 문구로 일부 대응).

### 2026-08-20 — R3 인터랙티브 튜토리얼 (Claude Code, 사용자 지시)
- 사용자: "쿠키 이용해서 처음 이용하는 사람은 … 화면에서 동적으로 하이라이팅하면서 참여할 수 있게". → `src/ui/tour/` 8단계 스포트라이트 투어(행동 수행 시 자동 진행, 비차단, 쿠키+localStorage). CHG-20260820-011. 94 tests PASS.
- QA 루프: 사용자 지시 "페이지 검증하는 에이전트 하나 둬서 … 루프". Playwright 하네스(scratchpad `pw/lib.cjs`, `baseline.cjs`, `tour.cjs`) + QA 에이전트(첫 방문자 역할, 스크린샷 판독, P0/P1/P2 보고) → 수정 → 재검증 반복.

### 2026-08-20 — R4 QA 루프 1라운드 수정 (Claude Code)
- QA 에이전트 보고 P0 3 · P1 5 · P2 6 → P0/P1 전부 + P2 6 중 4 수정(CHG-20260820-012). 98 tests PASS. 보류: Shift+클릭 additive(ADR-0006 키맵 결정), 미니바 가장자리 flip, 패스 중 공 드래그 힌트, 트랙 필터 빈 문구, 체크리스트 행동 기반.
- 다음: QA 2라운드(재검증 + 새 탐색).

### 2026-08-20 — R5 QA 루프 2라운드 수정 (Claude Code)
- 2라운드 보고: 1라운드 9/11 FIXED, 잔존 2 + 신규 P1 3 · P2 9 → 전부 수정(CHG-20260820-013). 다음: QA 3라운드.

### 2026-08-20 — R6 QA 루프 3라운드 수정 (Claude Code)
- 3라운드: 2라운드 10/11 FIXED, 신규 P0 1(체인 패스 순환) + P1 1 + P2 6 → 전부 수정(CHG-20260820-014). 99 tests. 다음: QA 4라운드(재검증 + 편집·타임라인 심화).

### 2026-08-20 — R7 QA 루프 4라운드 수정 (Claude Code)
- 4라운드: 3라운드 6/6 FIXED, 신규 P0 1(stale closure) + P1 1 + P2 6 → P0/P1 + P2 4 수정(CHG-20260820-015). 보류: 블록 키보드 조작, 미니바 겹침. 다음: QA 5라운드(최종 재검증).

### 2026-08-20 — R8 QA 루프 5라운드 수정 (Claude Code)
- 5라운드: 4라운드 5/7 FIXED + 잔존 2 + 신규 P1 2 · P2 4 → 전부 수정(CHG-20260820-016). 100 tests. 다음: QA 6라운드(R8 검증) 후 루프 종료 판단.

### 2026-08-20 — R9 QA 루프 6라운드 수정 · 루프 종료 (Claude Code)
- 6라운드: 5라운드 7/7 FIXED, 신규 P1 1 · P2 2 · P3 2 → 전부 수정(CHG-20260820-017). 101 tests.
- 종료 판단: 6라운드 연속 "이전 수정 전부 유지", 신규 발견이 P2/P3 위주로 수렴. 남은 항목은 설계 결정(Shift+클릭) 또는 L2 후보(리드 패스, 블록 키보드) → 다음 Codex 계획 입력.
- 다음: 사용자 브라우저 체감 리뷰(CURRENT_STATE 라운드 6 체크리스트), 커밋.

### 2026-08-20 — R10 단일 간편 모드 (사용자 결정, ADR-0009)
- 사용자: "사용법이 너무 복잡해 … 자세히는 필요 없어 기본 하나만". 제안 모델(좌/우클릭 배치, 더블클릭 경로, 단계 1~10) 그대로 채택 — 유일한 편차: 같은 단계는 "같이 시작"(끝 동기화는 속도 왜곡이라 자연 속도 유지).
- 구현: stepCommands + SimplePitch + StepBar + AppShell 단순화, 구 UI 8개 컴포넌트 삭제, 테스트 재작성(90). CHG-20260820-018.

### 2026-08-20 — R11 간편 모드 v2 (사용자 지시)
- Ctrl+클릭/우클릭 투입, 좌(기능)/우(조작법) 상시 패널, 공 투입 버튼, 🎬 애니메이션 모드 토글, 새로고침 클린 + 저장/내보내기 전부 제거. ADR-0009 Amendment. CHG-20260820-019. 90 tests PASS.

### 2026-08-20 — R12 마퀴 선택 + 웜 톤 (사용자 지시)
- 빈 잔디 드래그 = 다중 선택, 그룹 드래그(1 undo). 배경 웜 크림 + 잔디 밝게. CHG-20260820-020.

### 2026-08-20 — R13 시작 런처 제거 (사용자 지시)
- EmptyState 삭제, 투어 1장 타깃 = [양 팀 채우기]. CHG-20260820-021.

### 2026-08-20 — R14 (사용자 지시)
- 재생바 제거, 단계 1~9 + 끝 동기화(stepDur=최장 자연 길이), 라이트 고정, 배지 흐림. CHG-20260820-022, ADR-0009 v3.
