# VDR-0001: Reference Tactical Board (Initial Visual Evidence — Anti-Reference)

Status: Accepted
Date: 2026-08-19 (artifact 저장·재해석 2026-08-19 세션 2)
Decision Owners: User / Agent-assisted 해석
Canonical Artifact: `docs/agent/decision-assets/VDR-0001/reference-tactical-board.png` (1906×811 PNG, 사용자 저장)
Source References:
- 2026-08-19 초기화 프롬프트 첨부 이미지 (채팅 attachment — **canonical artifact와 다른 그림**, 아래 ledger M-01)
- 사용자 지시 (2026-08-19 세션 2): "절대로 이대로 하지 말고 … HCI적으로 PC에서 편리하고 몰입·재미·조화 … 애플처럼 통통 튀고 탁 달라붙는 조작감"
Related ADRs: ADR-0001, ADR-0006
Supersedes: —
Superseded By: —

## Context

사용자가 전술보드 스크린샷을 저장소에 보존. **복제 대상이 아니라 "이렇게 하지 말 것" + 기능 인벤토리** 역할.
이 artifact는 두 개의 시각 증거를 대표한다:
(1) canonical png = 좌측 사이드바형 한국어 UI 보드(기존 프로토타입 추정), (2) 채팅 첨부 = FC-스타일 2v2 점선 경로 보드(채팅에만 존재).

## Artifact 내용 (canonical png)

- 좌측 고정 사이드바(≈280px): `1. 포메이션 프리셋`(4-3-3, 4-2-3-1, 4-4-2, 4-1-4-1, 4-2-4, 3-5-2, 3-4-3, 5-3-2, 5-4-1 버튼 그리드) · `2. 기본 도구`(선택/이동(1), 지우개(3)) · `3. 전술 공간 레이어`(구역 ON/OFF(Z)) · `4. 드로잉 & 자유 펜`(자유 펜(2), 직선 이동, 땅볼 패스, 로빙 패스, 사각형, 원/타원) · `단축키 안내`(1/2/3/Z/C, 홈팀 드리블 D+이동, 원정팀 드리블 G+이동, 전체 선 지우기 C …).
- 상단 바: "이동 애니메이션: ▶ 재생 (Space)".
- Pitch: 가로 full pitch, 잔디 줄무늬, Blue 1 + 공(인접), Red 1. 경로 없음.
- 시각: 진한 남색 패널, 채도 높은 파랑/분홍/보라 버튼, 텍스트 라벨 버튼 나열.

### 채팅 첨부 이미지 (비canonical, 기록용)
top-down pitch, 2v2, 팀색 token+등번호, 공, 점선 path+arrowhead, Blue 2 곡선(청록) / Blue 1 직선(파랑) / Red 1·2 곡선 수렴, 작은 원 annotation, "지우개 크기 190%" 슬라이더, 우측 채팅(무관).

## Decision

### 채택 (기능 인벤토리로)
1. Formation preset 빠른 선택 (단, 버튼 그리드 나열이 아닌 검색/최근/카테고리 있는 picker).
2. 도구 집합: 선택/이동, 경로(직선·곡선), 패스 유형(땅볼/로빙 → ADR-0003 `flight: ground|lofted`), 드리블(possession + move), 도형(사각/원/타원), 자유 펜, 지우개, 구역 레이어 토글.
3. 키보드 단축키 1급 지원 (Space 재생, 숫자키 도구, 모디파이어 드래그).
4. Top-down landscape full pitch, 팀색 token + 등번호, 공 인접 표시, 점선 path + arrowhead, 직선·곡선 모두.

### 배제 (anti-pattern)
1. 상시 고정 사이드바에 모든 도구를 텍스트 버튼으로 나열 → Attention Focus·Pitch 가시성 훼손.
2. 번호 매긴 섹션("1. 2. 3. 4.") 식 관리자 패널 톤.
3. 고채도 다색 버튼(파랑/분홍/보라) → Visual Harmony 훼손. 색은 팀색과 상태(선택/재생)에만.
4. "드리블 = 모디파이어 키 + 이동" 같은 숨은 조작을 유일 경로로 두는 것 → 직접 조작 1차, 단축키는 가속기.
5. 재생 버튼만 있고 scrub/timeline 없음 → progressive-disclosure timeline 필수.
6. 우측 채팅/방송 오버레이 → 무관.

## Constraints

- 이 artifact의 색·레이아웃·라벨을 재사용하지 않는다.
- 기능 인벤토리는 ADR-0006 interaction design과 PRODUCT_BRIEF 도구 목록의 하한선.

## Agent Misread / User Correction Ledger

| ID | Agent's Incorrect Interpretation | User Correction | Evidence | Recurrence Prevention |
|---|---|---|---|---|
| M-00 | 채팅 이미지 Blue2 청록 path = "런", 파랑 = "패스" 구분으로 추정 | 미확인 (canonical png에는 "직선 이동 / 땅볼 패스 / 로빙 패스"가 별도 도구 → 이동·패스 시각 구분은 **있는 것으로 채택**) | canonical png 도구 목록 | 패스/런 시각 구분을 ADR-0006에서 명시 |
| M-01 | 사용자가 저장할 파일 = 채팅 첨부 이미지일 것으로 가정 | 저장된 파일은 다른 보드(사이드바형 UI). 사용자: "절대로 이대로 하지 말고" | png vs 채팅 첨부 | Artifact 저장 후 반드시 열어 대조하고 해석 갱신. 채팅 첨부는 "비canonical" 기록 |

## Validation

- canonical artifact 존재 확인 (2026-08-19, 87,285 bytes).
- M1 첫 UI 스크린샷을 이 png 옆에 두고 "배제 항목 1~5가 재현되지 않았는가" 점검 (DELEGATED: 사용자).

## Revisit Conditions

- 사용자가 새 레퍼런스 제공 → VDR-0002+.
- 사용자가 "채택" 목록의 도구 일부를 제외하길 원할 때.
