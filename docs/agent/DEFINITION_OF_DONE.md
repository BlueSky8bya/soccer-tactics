# Definition of Done — Soccer Tactics

> 실행 가능한 명령과 증거 중심. "될 겁니다" 금지. 상태: `IMPLEMENTED` → `AGENT-VERIFIED` → `EXTERNAL-VERIFICATION-PENDING` → `ACCEPTED`.

## 1. 모든 작업 (L0 포함)

| Criterion | Capability | Executor | Env | Evidence | Blocking |
|---|---|---|---|---|---|
| `npm run typecheck` PASS | DIRECT | Agent | local node | 출력 | Yes |
| `npm run lint` PASS (오류 0) | DIRECT | Agent | local | 출력 | Yes |
| `npm test` PASS | DIRECT | Agent | local | 출력 | Yes |
| `npm run build` PASS | DIRECT | Agent | local | 출력 | Yes (L1+) |
| `npm run harness:verify` PASS | DIRECT | Agent | local | 출력 | Yes (BR-ENGINE-001) |
| 의미 있는 behavior change에 `[WH-CHANGE ...]` annotation | DIRECT | Agent | — | diff | Yes (L1+) |
| CURRENT_STATE / PROJECT_MAP / CHANGELOG 최신 | DIRECT | Agent | — | diff | Yes (BR-DOC-001 manual gate) |
| Done Report 제출 (아래 양식) | DIRECT | Agent | — | 메시지 | Yes |

## 2. Engine / Domain 변경 (L1+)

| Criterion | Capability | Executor | Evidence | Blocking |
|---|---|---|---|---|
| 순수성: React/DOM/spring/wall-clock import 없음 | DIRECT | `harness:verify` | 출력 | Yes |
| 결정론 테스트: 같은 doc → `stateAt(t)` 2회 동일 | DIRECT | vitest | 테스트 | Yes (M2+) |
| Scenario A 타이밍 단언 테스트 유지 | DIRECT | vitest | 테스트 | Yes (M2+) |
| trigger 순환 → compile error 테스트 | DIRECT | vitest | 테스트 | Yes (M2+) |
| schema 변경 시 `schemaVersion`·마이그레이션 메모 + ADR-0003 갱신 | DIRECT | Agent | diff | Yes |

## 3. Editor / UI 변경 (L1+)

| Criterion | Capability | Executor | Procedure | Expected | Evidence | Blocking |
|---|---|---|---|---|---|---|
| history 단위테스트 (drag 병합, cancel, undo/redo 왕복) | DIRECT | vitest | `npm test` | PASS | 출력 | Yes (M1+) |
| 브라우저 체감: drag 지연 0, 스냅 "달라붙음", Esc cancel | DELEGATED | User | `npm run dev` → 선수 드래그/스냅/Esc | 끊김·지연 없음 | 사용자 확인 | Yes for ACCEPTED, No for AGENT-VERIFIED |
| reduce-motion: UI spring만 정지, 전술 재생 유지 | DELEGATED | User | OS 설정 켜고 재생 | 재생 정상 | 확인 | No (M4 Yes) |
| Pitch ≥65% 폭 유지, 패널 열려도 축소 안 함 | DELEGATED | User | Inspector/타임라인 펼침 | 비율 유지 | 스크린샷 | Yes (M1+) |
| 키보드: Space/←→/Ctrl+Z/Esc 동작 | SHARED | Agent(jsdom 테스트 가능 부분) + User | 수동 | 동작 | 확인 | Yes (M4) |
| 빈 상태·오류 상태(잘못된 trigger, 빈 문서) 표시 | DIRECT/DELEGATED | Agent/User | — | 안내 표시 | 스크린샷 | Yes (M3+) |
| 다크/라이트 토큰 둘 다 깨짐 없음 | DELEGATED | User | OS 테마 전환 | — | 스크린샷 | No |

## 4. Presets / Data

| Criterion | Capability | Executor | Evidence | Blocking |
|---|---|---|---|---|
| preset JSON 스키마 검증 테스트 | DIRECT | vitest | 출력 | Yes (M1+) |
| 적용 후 엔티티 자유 이동 (constraint 아님) | DELEGATED | User | 확인 | Yes |

## 5. Harness 변경

| Criterion | Capability | Executor | Evidence | Blocking |
|---|---|---|---|---|
| `harness:verify` PASS (링크·필수 문서·BLOCKING 등록) | DIRECT | Agent | 출력 | Yes |
| Decision Record 상태·DECISION_INDEX 일치 | DIRECT | Agent | diff | Yes |

## Done Report 양식

```text
Task:
Risk Level:
Acceptance Status: IMPLEMENTED / AGENT-VERIFIED / EXTERNAL-VERIFICATION-PENDING / ACCEPTED
Changed:
Why:
Files:
Validation Executed:
- <command> → PASS/FAIL (요약)
Agent-Not-Verifiable:
External Validation Required:
- criterion / executor / procedure / expected / evidence / blocking / status
Documentation Updated:
Rollback:
Remaining Risks / Next Exact Step:
```
