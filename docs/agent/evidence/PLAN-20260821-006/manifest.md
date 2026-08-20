# PLAN-20260821-006 Evidence Manifest — BASE (구현 전)

Captured: 2026-08-20, 앱 버전 v0.1.0 (cb3d176 이후 워킹트리 = 5507d23), Chromium(Playwright headless),
light scheme, 100% zoom, 1440×900. 캡처 스크립트: 세션 스크래치패드 `pw/m0.cjs`
(포인터 절차 기록 — 저장 기능 없이 재현하기 위한 스크립트 고정).

공통 fixture: 튜토리얼 skip(쿠키 seen), 4-3-3 vs 4-4-2 양 팀 채우기.

| ID      | 상태                                                                                      | 파일                       |
| ------- | ----------------------------------------------------------------------------------------- | -------------------------- |
| BASE-01 | 새로고침 직후 클린 보드                                                                   | BASE-01-empty-1440x900.png |
| BASE-02 | 22명 + 공을 #9(home) 왼발 옆에 부착, 선택 없음                                            | BASE-02-22p.png            |
| BASE-03 | 22명 + home 런3(#7,#10,#11)·패스2(1→2단계, 4단계), away 런3(#8,#6,#10 = 3단계), 선택 없음 | BASE-03-22p-paths.png      |
| BASE-04 | #5(home) 드래그 중(포인터 다운 유지, 이동 10스텝째)                                       | BASE-04-token-drag.png     |
| BASE-05 | 배지 클릭(인라인 피커 열림) 후 경로 벤딩 드래그 중                                        | BASE-05-path-edit.png      |
| BASE-06 | 전체 재생 t≈1.5s (경로/고스트/배지 숨김 상태)                                             | BASE-06-playback.png       |
| BASE-07 | 자연 종료 held-result ("결과 화면" 배너 확인 true)                                        | BASE-07-held.png           |
| BASE-08 | prefers-reduced-motion: reduce + 720×450 뷰포트(200% 확대 근사)                           | BASE-08-zoom200.png        |

주의: BASE-08은 브라우저 UI 줌이 아닌 뷰포트 축소 근사(Playwright 제약). M7 재캡처 시 동일 방식 사용.
모션 trace(BASE-04 드래그 5초 / BASE-06 재생 10초 long-task 기록)는 M7 성능 측정 시 함께 수집한다
— M0 시점에는 정지 캡처만 확보(콘솔 클린 확인).

## M7 (구현 후, 동일 프로토콜 — 2026-08-20, 워킹트리 = 254ab16)

| ID       | 파일                        | 비고                           |
| -------- | --------------------------- | ------------------------------ |
| M7-01~08 | M7-0*.png (BASE와 1:1 대응) | 동일 fixture/뷰포트, 콘솔 클린 |

성능: 재생 10초+ 관측 중 **50ms 초과 long task 0건**(PerformanceObserver). 감사: engine/domain의 UI/React import 0,
레거시 셀렉터(animMode 등) 0, module CSS의 raw cubic-bezier 0, dependencies 5개(gifenc는 CHG-053 사용자 승인).

주요 차이(BASE→M7): 헤더·패널 solid(blur는 하단 바·오버레이만), 피치 단일 depth, 로컬 SVG 아이콘,
파괴 버튼 절제, away 키라인, rest 단계 계층(현재 단계 외 0.55), 프레스 리프트·잉크/커밋 펄스,
재생 중 크롬 0.45 후퇴, 토큰 단색(사용자 취향), 보유 공 간격 [2.0,2.6]m.
