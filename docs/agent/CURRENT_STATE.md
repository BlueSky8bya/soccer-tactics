# Current State

Last Updated: 2026-08-20 (세션 9, PLAN-003 M1~M6 구현 완료 — 브라우저 리뷰 대기)
Project Version: 0.1.0
Harness Protocol: project-initializing_260712.md (schema 1.1) — `agent-harness.yaml`

## Current Objective

PLAN-003(Codex 계획·Claude 구현) 완료 → 사용자 브라우저 리뷰 → PLAN-004 목표 확정.

## Current Status

**동작하는 전체 플로우** (`npm run dev`):
- ☰ 문서 메뉴: 새 전술 · **예시 불러오기(2v2 패스&압박 / 원투&침투)** · JSON 열기/저장 · PNG/SVG 내보내기 · 자동 저장(브라우저, 새로고침 복원).
- 배치: 포메이션 12종 · 선수 추가(W) · drag/스냅/그룹 드래그/마퀴/Ctrl 클릭/Ctrl+A · 공 주기(드롭 또는 버튼).
- 움직임: Alt+드래그 / 더블클릭 / E → 드래그 = 이동 경로(시작=재생 위치) · 공 선택 후 드래그 = 패스(수신자 자동, 패스 후 재생 위치=도착) · waypoint 편집 · 세그먼트 인스펙터(시작 조건 5종·속도·길이·easing·종류·궤적·수신자·경유지 대기) · 트랙 블록 드래그/리사이즈.
- 재생: Space/scrub/속도/반복, 공 패턴·회전·로빙·잔상, 킥/리시브 pulse, 이동 중 방향 쐐기.
- 주석: 구역(A, Shift 타원)·화살표(R)·텍스트(S) — 선택/이동/삭제.
- **⚡ 자동 대응**(ADR-0007 P1): 팀·압박 강도·지연 → press/cover/shape 움직임 생성(공 이벤트 앵커, 편집 가능, 재생성/제거).
- 라이트 테마 기본(☾ 토글), 우측 단일 컬럼(속성 + 도움말 접기), `?` 단축키 오버레이.
- **라운드 4**: 왼손 키맵(`src/ui/keymap.ts`: Q/W/E/R/A/S/D, Z/X/C/V/G, Space, Alt+드래그=경로, Shift=직선, Ctrl=스냅해제), **휙 던지기**(공: 감속 굴러감→패스/루즈볼, 선수: 런), **재생 위치에서 드래그 = 그 시각 움직임 끝 수정**, 스트로크 전처리(직선 스냅/부드러운 곡선), `docs/agent/CODEX_BRIEF.md`.
- **PLAN-003 (라운드 5)**: ISSUE-006 패스 시작점 잠금 마커 · dangling 공 보유자 버그 수정 · 타임라인 **팀 필터/접기**(선택 선수 행은 항상 표시) · **Shift+드래그 path-scrub**(경로 따라 끌면 재생 위치 이동, Ctrl=선택 토글로 변경) · 자동 대응 **연속성·coalesce·anti-shuttle·hysteresis** · 접근성(inert·aria·포커스 복귀·슬라이더 키보드·블록 키보드 선택·Space 가드) · ADR-0003 Amendment(decel) · ADR-0008 Proposed(공격 반응).
- 검증: **78 tests** · build · harness PASS.

미구현/후순위: Record 모드, Scene/Phase 복제, 상대 공격 반응(ADR-0008 Proposed), Playwright, Inspector transaction coalescing(ADR-0005), playback 렌더 프로파일링, schema nested validation.

저장소: 커밋 `da3b61f`,`3e11047` 이후 **전부 uncommitted**(M1~end-to-end). 사용자 지시 시 커밋. push 0.

## Active Work

`plans/ACTIVE_PLAN.md` PLAN-20260820-004 (Draft). 완료: `plans/completed/PLAN-20260820-003-review-round.md`(Codex 계획·Claude 구현, M1~M6 PASS).

## Known Issues

### ISSUE-002 — Claude hooks/deny 활성 미확인 — Open(다음 세션 확인)
### ISSUE-003 — node 22.14 engine 경고 — Open, 무해
### ISSUE-004 — spring/pulse 강도 체감 미판정 — Open (공 1.45×, 선수 1.18×, drop b0.25)
### ISSUE-006 — 패스 경로 시작점 시각화 — Resolved (PLAN-003 M1, 잠긴 마커)
### ISSUE-008 — fling 상수(FLING.minCursorSpeed 22, ball gain 0.35/decel 4, player gain 0.22) 체감 미튜닝 — Open
### ISSUE-007 — 자동 대응 품질 — 연속성/coalesce/anti-shuttle 테스트로 고정(PLAN-003 M4), 트랙 팀 필터(M2). 체감 확인만 남음 → Open(체감)

## Locked / Stable Areas

ADR-0001~0007 Accepted, VDR-0001. `src/domain/types.ts` shape 불변. engine/domain 순수성·renderer spring 금지(MACHINE).

## Open Decisions

- 커밋 시점(C-01). 리뷰 후 우선순위.

## Next Exact Steps

1. (사용자) `npm run dev` → 아래 체크리스트. 커밋 권장(D-01).
1b. Codex에 다음 계획 요청 시 `docs/agent/CODEX_BRIEF.md` + `plans/completed/PLAN-20260820-003-review-round.md` "추가 개선 후보" 참조.
2. 피드백 → ISSUE 등록 → PLAN-003 R2 반영.
3. 다음 세션 hook 출력 확인 → ISSUE-002.

## DELEGATED 체크리스트 (사용자, 라운드 5)

- [ ] 예시 불러오기 → 공 선택 → 패스 클릭: 시작점이 보유자에 붙은 **점선 링 잠긴 점**, 드래그 안 됨. 두 번째 점은 드래그 됨.
- [ ] 트랙 패널(V): 상단 **전체 · Home · Away** 필터, 그룹 헤더 ▸ 접기. 접힌/필터된 팀의 선수를 pitch에서 클릭하면 그 행만 ● 표시로 나타남.
- [ ] 경로 있는 선수 위에서 **Shift+드래그**: 장면 전체가 그 시각으로 이동(흰 점선 링 = 경로 위 위치). 왕복 경로 교차에서 튀지 않음. Ctrl+클릭 = 선택 추가(Shift는 이제 스크럽·직선·타원).
- [ ] ⚡ 자동 대응 → 빠른 패스 장면(예시 "원투")에서 재생성: 순간이동·제자리 왕복 없음, 압박 담당이 필요할 때만 교대.
- [ ] 키보드만: Tab 순회(상단 → 레일 → pitch → 우측 → 타임라인), ? 키로 열면 포커스가 대화상자로, Esc로 원래 버튼 복귀. 포커스된 버튼에서 Space = 그 버튼(재생 아님). 슬라이더 포커스 후 ←/→/Home/End.
- [ ] 공 던지기(휙), Alt+드래그, 재생 위치에서 드래그 = 끝점 수정 — 라운드 4 항목 재확인.

## Last Verified

- `npm run typecheck` → PASS — 2026-08-20
- `npm run lint` → PASS — 2026-08-20
- `npm test` → PASS (16 files / 78 tests) — 2026-08-20
- `npm run build` → PASS — 2026-08-20
- `npm run format:check` → PASS — 2026-08-20
- `npm run harness:verify` → PASS — 2026-08-20
- dev 서버 모듈 200 — 2026-08-20
- 브라우저 체감 → NOT VERIFIED (사용자 리뷰)
