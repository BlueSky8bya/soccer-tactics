# PLAN-014 D-browser — 실제 브라우저 감사 결과

날짜: 2026-08-23. 결정: **DG-BROWSER 1안 채택** (사용자 "당연히 설치해") — Playwright 1.62.1을
devDependency로 고정, probe 소스를 `pw/`에 tracked 보관.

실행: `npm run dev` + `node pw/run.cjs <id>` (QA 훅이 `import.meta.env.DEV` 게이트라 dev 서버 필수).
probe는 Playwright 마우스 API로 **실제 포인터 이벤트**를 보낸다 — 합성 dispatch가 아니다.

## 결과 요약

| Probe | 대상 | 결과 |
|---|---|---|
| `hit-scale` | R12-D | **PASS 42/42** — 7 viewport × DPR |
| `gesture-cancel` | R7 | **PASS 17/17** |
| `pick-overlap` + `r5-diagnose` | R5 | **FAIL — 결함 확인** |
| `reduced-motion` | 구조 | **PASS 5/5** |

## R12-D — Resolved (근거 있음)

동적 `usePitchView`가 letterbox를 실제로 없앴다. 전 viewport에서:

- CTM 등방성: `a === d`, skew 0.00e+0 (1280×720/800, 1440×900, 1440×1000@DPR2, 1920×1080, ultrawide 2560×1080, tall 1100×1400)
- pick의 `view.w/rect.width` = 실제 `1/ctm.a` (예: 0.11402 vs 0.11402)
- **히트 밴드 실측 6~7px** (설계값 `PATH_HIT_HALF_PX=7`), DPR2에서도 CSS 픽셀 기준 동일
- surround 전 영역이 유한 좌표를 가짐 — dead strip 0

정적 완화 정황이 아니라 라이브 CTM 실측이므로 `Resolved`로 재분류한다.

## R7 — Resolved

blur / lostpointercapture / pointercancel / Escape 각각 드래그 중 발화 후: gesture null, 문서 valid,
**다음 편집이 정상 적용**(열린 transaction 없음), console error 0.

특성화 1건: **window blur는 드래그를 취소하지 않는다** — 제스처가 살아남아 이후 pointerup에서 커밋된다
(나머지 셋은 되돌림). 문서 무결성은 유지되므로 결함이 아니라 계약 불일치. → F-D-03 (P3).

## R5 — **Confirmed (P1)** — 호버가 약속한 대상과 실제 드래그 대상이 다르다

`r5-diagnose` 스캔라인 (고스트 중심 기준 dx = -3m ~ +1m, 0.5m 간격):

| dx | 호버가 약속 | 드래그가 실행 | 일치 |
|---|---|---|---|
| -3.0 ~ -2.0m | segment | `bend-path` | ✅ |
| **-1.5 ~ +0.5m** | **segment** | **`adjust-ghost-end` (ghost)** | ❌ |
| +1.0m | ghost | `adjust-ghost-end` | ✅ |

`elementFromPoint`는 불일치 구간 내내 고스트 `<circle>`을 반환한다 — 고스트가 위에 있는데 호버는
경로를 강조한다.

**원인 (코드 확정)**:
- 호버 = `pickNowRef.current(pt).ordered[0]` — 전역 rank 튜플 `[sticky, stepTier, norm, key]`로 정렬.
  `norm`은 반경 정규화 거리라, 경로(허용 ~7px ≈ 0.35m)에 붙으면 norm≈0.1, 고스트(반경 1.9m)는 norm≈0.5 →
  **경로가 이긴다**.
- 프레스 = 카테고리별 top(`ov.ghosts[0]`, `ov.segments[0]`)을 뽑아 `resolvePointerIntent`에 넘기고,
  그 우선순위는 **고스트가 경로보다 위**다(`adjust-ghost-end` > `bend-path`).

즉 두 경로가 서로 다른 비교 기준을 쓴다. 고스트는 정의상 런의 끝점이고 끝점은 항상 그 경로 위에 있으므로,
**모든 런 끝점 주변 약 2m 띠에서 재현된다.**

**사용자에게 보이는 증상**: 경로 끝 근처를 겨눠 곡선을 휘려고 끌면, 경로가 강조돼 있는데도 실제로는
런의 도착점이 끌려간다 — 저작 의도가 뒤바뀐다. 반복 재현되고 흔한 조작이므로 **P1**.

**수정 후보 (구현하지 않음)**: 호버도 프레스와 같은 어댑터를 쓰게 하거나(단일 우선순위), 반대로
프레스가 전역 rank를 따르게 한다. 어느 쪽이든 "한 번의 판정을 두 소비자가 공유"가 계약이어야 한다.
회귀 방어는 `pw/r5-diagnose.cjs`의 스캔라인 mismatch 0.

## reduced-motion — PASS

동일 포인터 스크립트를 reduced-motion on/off로 실행 → 저작된 전술이 동일(좌표 0.01m 단위 비교).
비공허성 검사 포함(빈 보드끼리 비교하는 헛통과 차단 — 초기 버전이 실제로 그랬다).

## production 변경 1건

`SimplePitch.tsx`의 DEV 전용 QA mirror(`debugRef` → `__stFlags()`)에 `hoverKey` 한 줄 추가.
호버 약속은 React state라 paint로는 읽을 수 없어 R5 비교가 불가능했다. 동작 변경 없음,
`import.meta.env.DEV` 안에서만 채워진다.

## Findings

| ID | 심각도 | 내용 | 회귀 방어 |
|---|---|---|---|
| **F-D-01** | **P1** | 호버 약속 ≠ 프레스 대상 (모든 런 끝점 ±2m 띠). 호버는 전역 norm, 프레스는 카테고리+intent 우선순위 | `pw/r5-diagnose.cjs` |
| F-D-02 | P3 | probe 초판이 plain 드래그(=토큰 이동)로 저작한 줄 알고 빈 보드끼리 비교해 헛통과. 비공허성 검사 추가로 봉인 | `reduced-motion.cjs` 비공허성 체크 |
| F-D-03 | P3 | window blur는 드래그를 취소하지 않고 이후 pointerup에서 커밋 (다른 취소 경로는 되돌림) | `gesture-cancel.cjs` outcome 기록 |

## 재분류

- **R5 — Confirmed (P1)**, 재현 fixture 있음.
- **R7 — Resolved** (+ F-D-03 특성화).
- **R12-D — Resolved**, 라이브 CTM 실측 근거.
- R12-E — M2에서 Confirmed (P2, players 배열 순서 의존). 브라우저 재확인은 후속.
