# ADR-0008: Attacking / Transition Reaction for the Auto-react Team

Status: Proposed (구현 금지 — 제안만. PLAN-20260820-003 M4.3)
Date: 2026-08-20
Decision Owners: Agent proposal / User approval
Related: ADR-0007 (수비 반응 Phase 1, Accepted), ADR-0003 (segments가 산출물), ADR-0001 §13

## Context

ADR-0007 Phase 1은 **공을 갖지 않은 팀의 수비 반응**(press/cover/shape)만 생성한다. 공 소유가 바뀌면(패스 가로채기·루즈볼 회수·사용자가 상대에게 공 주기) 그 팀은 반응을 멈춘다(`holder.teamId === teamId → continue`). 사용자는 "실제 경기처럼"을 원하므로 소유 전환 후 **공격 측 반응**(지원·침투·폭 확보)이 다음 후보다.

## Proposed Decision

1. 입력: compiled 이벤트 중 `ball.received`의 수신자가 반응 팀이면 "possession transition" 모멘트로 본다. 루즈볼 회수는 Phase 1 범위 밖(명시적 receiverId 없는 travel 종료 → 정의 필요).
2. 역할(결정론, 문서 순서 tie-break):
   - carrier: 보유자 — 생성하지 않음(사용자가 직접 그린다).
   - support ×2: 보유자 기준 ±35° 후방 6–8m 지점(패스 각 제공).
   - run ×1: 보유자 전방 상대 라인 뒤 10–15m 지점(off-ball run).
   - width ×2: 양 터치라인 쪽으로 home.y를 70 % 확장.
   - 나머지: shape(Phase 1 규칙 재사용).
3. 수비 생성과 결합: 같은 `generateReaction` 루프에서 모멘트마다 보유 팀 여부로 분기. 산출물은 동일하게 `gen-` segments.
4. 스키마: 변경 없음(Phase 1과 동일). provenance 메타데이터(A-07)는 별도 결정.
5. 결정론·편집 가능성·멱등: Phase 1 불변조건 그대로.

## Open Questions

- 루즈볼 회수 판정(receiverId 없는 travel 종료 후 가장 가까운 선수? 거리 임계?).
- run 목표점의 오프사이드 무시 여부(v1은 무시 추천).
- 공격 반응 강도 슬라이더를 수비 강도와 공유할지 분리할지.

## Revisit / Approval Conditions

- 사용자가 Phase 1 체감 확인 후 "공격도" 요청 시 Accepted로 전환하고 PLAN에 마일스톤 편성.
- 체감이 "너무 많이 움직임"이면 support/width만으로 축소.

## Validation (Accepted 시)

- 테스트: 소유 전환 모멘트에서 반응 팀 선수에게 support/run/width segment가 생성되고, 수비 모멘트에서는 생성되지 않음. 결정론·멱등·compile error 0.
