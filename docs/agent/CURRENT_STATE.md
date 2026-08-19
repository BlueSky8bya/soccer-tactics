# Current State

Last Updated: 2026-08-20 (세션 11, PLAN-004 R14 완료 — 재생바 제거·단계 1~9 끝 동기화·라이트 고정, 사용자 리뷰·커밋 대기)
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
- **PLAN-004 R1**: import 중첩 검증(잘못된 JSON은 문제 목록과 함께 거부), Inspector 입력 undo 병합, geometry→engine, teamColor 분리, 문서 정합화.
- **PLAN-004 R2 (첫 방문 UX)**: 빈 필드 **런처**(양 팀 채우고 시작 · 예시 2종 · W 안내) · Inspector **시작하기 체크리스트**(자동 ✓) · **fling 오인 버그 수정**(멈췄다 놓으면 이동, 임계 45 m/s) · 첫 채움 시 공 보유자 자동 · 자동 대응 기본 팀 = 상대/빈 팀 경고+채우기 · 포메이션 버튼 ▾ · 오버레이 개발자 문구 제거.
- **PLAN-004 R3 (튜토리얼)**: 첫 방문(쿠키/localStorage 미설정) 시 8단계 **스포트라이트 투어** — 실제 버튼/토큰을 하이라이트, 사용자가 행동하면 ✓ 후 자동 진행, 비차단, 건너뛰기/다음/완료, HelpPanel에서 다시 보기.
- **PLAN-004 R4 (QA 1라운드)**: 기본 팀 history 밖 · 문서 교체 undo 가능 + 새 전술 인라인 확인 · 패스 끝 드래그 시 수신자 재해석 · 패스 직후 Space는 그린 지점부터 · 예시 자동 재생 · 팝오버 Esc/`?` 정리 · Inspector 우선 높이 · 투어 z-order · 한국어 프리셋 · OS 테마 · 텍스트 더블클릭 편집.
- **PLAN-004 R5 (QA 2라운드)**: Space 경로 통일(playFrom, 마우스 포커스 버튼 무시) · Tab 포커스 트랩 해소 · 텍스트 더블클릭 편집 · 토스트 위치 · 제목 Enter/Esc · 트랙 높이 30vh · 투어 keep-out/onEnter/🎓 타깃 · `?` 포커스 트랩 · 필터 빈 문구 · 시작 조건 카피.
- **PLAN-004 R6 (QA 3라운드)**: 체인 패스 순환 버그(passerFor/possessTrigger) · Space 모달리티 추적 · Ctrl+S 토스트 · 배너 한국어 · 투어 available/핸드오버/⚡ 카드 위치 · S 도구 라벨 편집.
- **PLAN-004 R7 (QA 4라운드)**: PitchStage stale closure(수신자/런 체인/플링) · 보유 공 드래그 커서 추종 · 비행 중 패스 끝=커서 · 공 주기 첫 possessed 교체 · 미해석 블록 표시 · 토스트 live region.
- **PLAN-004 R8 (QA 5라운드)**: 보유 공 드래그 시각 피드백/고스트 · 공 마지막 움직임 후 드래그=새 패스·flick=킥 · 루즈볼 fling 시작점 · 포메이션 변경 시 고스트 패스 정리+인라인 확인 · 트랙 패널 내용 높이 · 순환 시 빗금 블록 유지.
- **PLAN-004 R9 (QA 6라운드, 루프 종료)**: 패스 삭제 시 수신자 possessed 동반 삭제 · 핸드오버 undo 1회 · authored 트랙 시 빈 잔디 드롭 no-op · 720 트랙 높이.
- **PLAN-004 R14**: 스크럽 제거 · 단계 1~9 · 같은 단계 같이 시작·같이 끝남(느린 쪽에 맞춤) · 라이트 웜 톤 고정(다크 제거) · 배지 흐림 · 마퀴 선택·그룹 드래그.
- **PLAN-004 R13**: 중앙 시작 런처 창 제거 — 시작은 왼쪽 [양 팀 채우기] 또는 Ctrl+클릭.
- **PLAN-004 R12**: 빈 잔디 드래그 = 박스 다중 선택 + 그룹 드래그 · 라이트 테마 웜 크림 배경(순백 아님) · 잔디 밝게.
- **PLAN-004 R11 (간편 모드 v2)**: Ctrl+클릭=우리팀·Ctrl+우클릭=상대팀 투입 · 좌 기능 패널(채우기/공 투입/⚡/새로 시작) · 우 조작법 패널 · 하단 🎬 애니메이션 모드 토글(켜야 더블클릭·재생 바·단계) · 새로고침 클린(자동저장·JSON·PNG·SVG 제거).
- **PLAN-004 R10 (간편 모드, ADR-0009)**: 좌클릭=우리팀·우클릭=상대팀·더블클릭=경로/패스·드래그=이동·휙=달리기, **단계 1~10**(같은 번호 같이 시작, 다음 번호는 앞이 끝나면), 경로 배지로 번호 변경, 화면=필드+재생바+단계 칩(도구 레일/인스펙터/트랙 제거), 튜토리얼 5장.
- 검증: **90 tests**(간편 모드 재작성) · build · harness PASS. QA 루프 결과: 6라운드(Playwright 에이전트), 발견 P0 5 · P1 14 · P2 30+ 수정, 마지막 라운드 신규 발견 P1 1·P2 2·P3 2 → 수정 후 종료. Playwright 하네스(scratchpad `pw/`: `lib.cjs`, `baseline.cjs`, `tour.cjs`)로 첫 방문·투어 워크스루 PASS.

미구현/후순위: Record 모드, Scene/Phase 복제, 상대 공격 반응(ADR-0008 Proposed), Playwright, Inspector transaction coalescing(ADR-0005), playback 렌더 프로파일링, schema nested validation.

저장소: `57ec15c` (R1~R14, 2026-08-20 사용자 지시로 커밋). push 0 — 지시 시만.

## Active Work

`plans/ACTIVE_PLAN.md` PLAN-20260820-004 (Draft). 완료: `plans/completed/PLAN-20260820-003-review-round.md`(Codex 계획·Claude 구현, M1~M6 PASS).

## Known Issues

### ISSUE-002 — Claude hooks/deny 활성 미확인 — Open(다음 세션 확인)
### ISSUE-003 — node 22.14 engine 경고 — Open, 무해
### ISSUE-004 — spring/pulse 강도 체감 미판정 — Open (공 1.45×, 선수 1.18×, drop b0.25)
### ISSUE-006 — 패스 경로 시작점 시각화 — Resolved (PLAN-003 M1, 잠긴 마커)
### ISSUE-008 — fling 상수 — minCursorSpeed 22→**45** + stale 100ms(R2, 일반 드래그 오인 수정). ball gain 0.35/decel 4, player gain 0.22 체감 미튜닝 — Open(체감)
### ISSUE-009 — 리드 패스: 달리는 팀원에게 패스하면 도착 시 그 자리에 없어 루즈볼 — Open(L2, 다음 계획 후보)
### ISSUE-007 — 자동 대응 품질 — 연속성/coalesce/anti-shuttle 테스트로 고정(PLAN-003 M4), 트랙 팀 필터(M2). 체감 확인만 남음 → Open(체감)

## Locked / Stable Areas

ADR-0001~0007 Accepted, VDR-0001. `src/domain/types.ts` shape 불변. engine/domain 순수성·renderer spring 금지(MACHINE).

## Open Decisions

- 커밋 시점(C-01). 리뷰 후 우선순위.

## Next Exact Steps

1. (사용자) `npm run dev` → 라운드 6 체크리스트(첫 방문 + 튜토리얼 + 체감). **커밋 권장**(R1~R9 uncommitted).
1a. Codex 다음 계획 후보: ISSUE-009 리드 패스(달리는 수신자), 타임라인 블록 키보드 조작, 미니바 가장자리 flip, Record 모드, Scene/Phase, ADR-0008.
1b. Codex에 다음 계획 요청 시 `docs/agent/CODEX_BRIEF.md` + `plans/completed/PLAN-20260820-003-review-round.md` "추가 개선 후보" 참조.
2. 피드백 → ISSUE 등록 → PLAN-003 R2 반영.
3. 다음 세션 hook 출력 확인 → ISSUE-002.

## DELEGATED 체크리스트 (사용자, 라운드 6 — 첫 방문)

- [ ] 시크릿 창(또는 DevTools에서 localStorage `st:tour:seen:v1`·쿠키 `st_tour_seen` 삭제) → 튜토리얼 1/8이 런처 버튼을 비추며 시작. 버튼을 누르면 ✓ 후 2/8로 넘어가 #9를 비춤. 끌어 놓으면 3/8 …. 8/8 완료 후 새로고침 시 안 나옴. 우측 도움말 패널 "🎓 튜토리얼 다시 보기"로 재시작.
- [ ] 투어 중에도 모든 조작 가능(카드만 클릭 가로챔), 카드가 조작 대상을 가리지 않는지(토큰 단계는 옆, 런처 단계는 아래).

- [ ] 새 브라우저 프로필(또는 ☰ 새 전술)로 열기 → 중앙 런처 보임 → **양 팀 채우고 시작** 한 번에 22명 + #10 공 보유. Ctrl+Z 한 번에 되돌아감.
- [ ] 선수를 천천히 끌어 놓기 = 이동(경로 안 생김). 빠르게 휙 놓기 = 달리기 경로. 경계가 자연스러운지.
- [ ] 우측 "시작하기" 4단계가 하면서 ✓ 되는지, 다 하면 한 줄로 줄어드는지.
- [ ] Home만 채우고 ⚡ → Away 기본 선택 + "Away 4-4-2 채우기" 경고 버튼.

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
- `npm test` → PASS (17 files / 90 tests) — 2026-08-20
- `npm run build` → PASS — 2026-08-20
- `npm run format:check` → PASS — 2026-08-20
- `npm run harness:verify` → PASS — 2026-08-20
- dev 서버 모듈 200 — 2026-08-20
- Playwright 첫 방문 워크스루(빈 localStorage, 1440×900, 라이트/다크) → PASS (스크린샷 육안, R2) — 2026-08-20
- 브라우저 체감(스프링/fling/scrub) → NOT VERIFIED (사용자 리뷰)
