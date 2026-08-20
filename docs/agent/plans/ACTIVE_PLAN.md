# Active ExecPlan

Plan ID: PLAN-20260821-008
Status: Completed (2026-08-21 — M1~M4 AGENT-VERIFIED: 바 전환·펜·지우개·언두·GIF 포함, Playwright 7건 PASS. 브라우저 체감은 사용자 몫)
Task Risk: L2
Created: 2026-08-21
Updated: 2026-08-21
Execution Owner: Claude Code

## Objective

축구장 위 **자유 그리기(그림판)**: 펜(freehand)과 지우개(획 단위)만 있는 단순 주석 도구.
VIC Schedule Studio의 판서 UX **문법만** 차용(도구 전환·획 단순화)하고, 구현은 본 프로젝트에
이미 존재하는 `Drawing` 도메인(스키마·DrawingLayer·moreCommands) 위에 SVG 벡터로 한다.
VIC의 canvas 픽셀 엔진(필압·destination-out·flood fill·레이어·DPR 예산)은 이식하지 않는다.

## 사용자 결정 (2026-08-21, 본 계획의 고정 요구)

- D-01 **모드 전환 = 하단 바 대체**: 그리기 모드로 들어가면 하단 애니메이션 바(재생/루프/GIF/단계)가
  **그리기 바로 교체**된다. 그리기 모드 중 선수·경로 제스처는 정지.
- D-02 **도구는 펜 + 지우개뿐**. 색·굵기 선택은 유지(팔레트 + 굵기 단계).
- D-03 **지우개는 획 단위** 삭제(부분 지우기 없음 — 픽셀 문법 배제).
- D-04 **레이어 기능 없음**.

## 기존 자산 (재사용)

- `src/domain/types.ts` `Drawing`(freehand/line/arrow/zone/text + style{color,width,opacity} + visible) — 스키마 불변.
- `src/renderer/DrawingLayer.tsx` — SimplePitch에 이미 마운트. freehand는 polyline 렌더(굵기 style 반영만 보강).
- `src/editor/moreCommands.ts` — removeDrawings 재사용, addFreehand 신설.
- EditorCore 트랜잭션 → undo/redo 자동 편입(별도 히스토리 없음).

## Milestones

- M1 모드 + 푸터 바 교체: uiStore에 drawMode/drawTool/drawColor/drawWidth. AppShell 푸터에
  진입 버튼(펜 아이콘) + 그리기 바(펜/지우개 토글, 색 4, 굵기 3, 전체 지우기, 종료 X). Esc 종료.
  진입 시 재생 정지·저작 시점 복귀. 그리기 모드 중 SimplePitch 보드 제스처는 주석 제스처로 대체.
- M2 펜: pointer 스트로크 수집(≥0.3m 간격 단순화, VIC MIN_POINT_DIST 문법) → addFreehand
  (kind 'freehand', style{color,width}) 한 트랜잭션. 진행 중 폴리라인 프리뷰. 관전 프레임/재생 중 비활성.
- M3 지우개: 획 위를 클릭/스치면 그 Drawing 통째 삭제. 화면 픽셀 허용치(≈10px) 폴리라인 거리
  판정(pickTarget distToPolyline 문법 재사용). 한 드래그 = 한 undo(begin/commit).
- M4 GIF 내보내기에 드로잉 포함 + Playwright 검증(그리기→doc.drawings/DOM, 지우개, Esc 종료 후
  보드 제스처 복원, Ctrl+Z 복원) + 문서(CHANGELOG/CURRENT_STATE/keymap 가이드).

## Guardrails

- `src/engine`/`src/domain` 불변(스키마 이미 충분). 새 의존성 없음.
- ADR-0009 제스처 계약 불변 — 그리기 "모드" 내부에서만 포인터 의미가 바뀐다(모드 밖 영향 0).
- 애니메이션과 무관한 정적 주석(visible TimeRange 미사용, P2 여지로 남김).

## Out of scope (P2+)

- 도형(사각/원/화살표) 도구 UI, 텍스트 도구, 형광펜, 단계 연동(visible), 드로잉 선택/이동 UI.

## Ambiguity Register

- A-01 색·굵기 프리셋 값(팔레트 4색: 노랑/흰/빨강/하늘, 굵기 2/3.5/6px): 사용자 "색이랑 굵기 등은
  그대로" — 구체 값은 미지정, 주석 가독성 기준으로 에이전트 선정. LOW. 사용자 피드백 시 조정.
- A-02 그리기 모드 진입 시 재생 정지·저작 시점 복귀: 미지정이나 D-01(보드 제스처 정지)의 자연 귀결.
  LOW.
- A-03 지우개 대상: 펜 획(freehand) 외 기존 스키마의 line/arrow/text도 스치면 삭제, zone은 제외
  (생성 UI 없음, 전체 지우기로 커버). LOW.

## Plan Reversal Log

- (없음)
