# Risk Profile — Soccer Tactics

Default: GENERAL

## Active Profiles

- GENERAL

## Detection Rationale

순수 클라이언트 편집 도구. 사용자 계정·서버·결제·개인정보·연구 통계·파괴적 데이터 작업 없음(v1 non-goal, ADR-0001 §13).
localStorage 자동저장(M5)은 사용자 본인 기기의 전술 문서만 — 개인정보 아님.

## Inactive Profiles Reviewed

- RESEARCH: Not detected (통계/라벨/실험 없음)
- HEALTH: Not detected
- AUTH: Not detected (로그인 없음)
- SECURITY: Not detected beyond ordinary secure coding (외부 입력 = JSON import 파일 → M5에서 schema 검증 필수, 그래도 프로필 승격 아님)
- PRIVACY: Not detected beyond ordinary data hygiene
- FINANCE / PAYMENTS: Not detected
- DESTRUCTIVE_DATA: Not detected (사용자 문서 삭제는 undo/확인 UI로 처리, 서버 데이터 없음)
- PRODUCTION_INFRA: Not detected (정적 호스팅만 예상)
- LEGAL_COMPLIANCE: Not detected (EA FC 상표/데이터 사용 시 재검토 — A-04)
- ML_EVALUATION: Not detected

## Re-evaluation Triggers

다음 도입 시 재평가:

- 계정/로그인 → AUTH, SECURITY, PRIVACY
- 서버 저장/공유 링크 → SECURITY, PRIVACY
- 결제/구독 → PAYMENTS, FINANCE
- EA FC 공식 preset 데이터/상표 사용 → LEGAL_COMPLIANCE
- 실경기 tracking 데이터 → PRIVACY, RESEARCH
