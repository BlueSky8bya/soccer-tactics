# 축구 전술 시퀀서 벤치마크·연구 조사

> 조사일: 2026-08-21  
> 상태: Proposed — 제품 방향 제안이며 Accepted 결정이 아님  
> 범위: 저장소 현황, 축구 전술 보드/코칭/비디오 분석 제품, 인접 종목 플레이북, 스포츠 학습·멀티미디어 학습 연구

## 1. 결론

이 제품은 이미 포메이션, 직접 경로 저작, 독립 선수·공 트랙, 단계 재생, 이벤트 트리거 엔진,
패스·드리블·수신, 상대 반응, path-scrub, A/B 세션 변형, PNG/SVG/GIF/JSON을 갖고 있다.
경쟁 제품을 따라 도구 수나 3D를 늘리는 것보다 다음 네 가지를 연결할 때 차별성이 가장 크다.

1. **저작한 시간을 이해 가능한 이야기로 바꾸기** — Phase/Chapter, 단계별 설명, 시간 지정 강조·주석.
2. **숨은 시간 관계를 직접 편집하기** — “공 도착 후 출발”을 캔버스 연결선으로 만드는 Trigger Link.
3. **전술을 저장물이 아니라 학습물로 바꾸기** — 역할별 보기, 멈추고 선택하기, 답과 이유 비교.
4. **한 전술을 반복 개선 가능한 지식으로 바꾸기** — Playbook, 태그, 변형, 비교, 코칭 포인트.

추천 순서는 `설명 모드 → 시간 지정 cue → Trigger Link → 전술 오버레이 → Playbook/변형 → 선수 학습 모드 → 공유·영상`이다.
3D, 실경기 영상 추적, 생성형 AI, 실시간 공동편집은 가치가 없어서가 아니라 이 순서를 앞서면 현재의 핵심
우위인 결정론적 타임라인을 흐리고 구현·검증 비용을 크게 늘리므로 후순위다.

## 2. 현재 제품의 기준선

### 이미 강한 부분

- 단순 키프레임 전환이 아닌 선수·공 독립 Track/Segment/Trigger 및 임의 시점 `stateAt(t)`.
- 단계 1~9, 순차·동시 실행, 이벤트 후속 반응, 패스 수신과 보유 전환.
- 필드 위 직접 경로 생성·굽히기·고스트 도착점 편집·path-scrub.
- 선택 엔티티 타임라인 포커스, 결과 화면 유지, 구간 재생, 속도·반복.
- 상대 자동 반응 Phase 1, 세션 A/B 변형, 자유 펜·구역·텍스트·화살표.
- 로컬 자동 저장, JSON 열기/저장, PNG/SVG/GIF 내보내기.

### 현재 빈틈

- Domain에는 Scene 배열과 Trigger가 있으나, 사용자가 **장면/Phase를 이름 붙여 구성**하거나
  **이벤트 관계를 시각적으로 연결**하는 완성된 UI가 없다.
- 편집자는 강하지만 “선수에게 왜 이 움직임을 해야 하는지” 전달하는 발표·학습 표면이 약하다.
- 주석은 만들 수 있지만 특정 순간에 나타났다 사라지는 설명 흐름과 코칭 포인트 묶음이 약하다.
- 포메이션·예시 2종 외에 전술 패턴을 검색·복제·변형하는 지식 라이브러리가 없다.
- A/B는 세션 한정이며 차이를 나란히/겹쳐 비교하거나 보존하지 않는다.
- 전술 원칙(폭, 깊이, 압박 거리, 수비 간격 등)을 보조하는 측정·오버레이가 없다.
- 공유 결과가 파일 중심이다. 읽기 전용 플레이어 링크, 역할별 전달, 이해 확인은 없다.

## 3. 제품 벤치마크

마케팅 주장과 실제 학습 효과는 구분했다. 아래는 각 제품의 공식 기능 설명에서 확인한 패턴이다.

| 제품 | 확인한 강점 | 이 제품에 가져올 교훈 | 그대로 따라 하지 않을 것 |
| --- | --- | --- | --- |
| [TacticalPad](https://tacticalpad.com/edu/formation.php) | 정적/애니메이션 보드, 경로·드리블, 선수 방향, 3D와 선수 시점 | 몸 방향, 프레젠테이션 보기, 2D 저작물의 다른 관점 재생 | 3D를 핵심 저작보다 먼저 구축 |
| [TacticBoard](https://www.tacticboard.app/plays) | 패스·드리블·런을 그린 순서와 공의 체인으로 즉시 애니메이션 | 초보용 자동 순서 추론과 “그리면 바로 재생”의 낮은 진입장벽 | 자동 추론만 제공해 정확한 트리거 편집을 막기 |
| [tactical-board.com](https://tactical-board.com/user-guide/cs.html) | 이미지·MP4·오프라인 HTML·링크 공유, 온라인 회의 | 파일뿐 아니라 읽기 전용 재생물과 오프라인 전달 | 불투명한 링크 보존 정책 |
| [Teloframe](https://teloframe.com/features/tactics-board) | 실제 timeline, phase, per-segment ball/action, onion skin, ghost trail, 시간 제한 주석, 패턴, 여러 화면비 | Phase, 시간 지정 설명, ghost/onion, 세로 영상 프레이밍의 통합 | 도구·표면을 한 번에 과도하게 확장 |
| [planet.training](https://planet.training/drawing-tool) | 장비 포함 드릴, 태그·연령·인원별 라이브러리, 세션 플랜 연결, PNG/MP4 | 전술을 드릴·코칭 포인트·세션과 연결하는 메타데이터 | 팀 관리 전체를 전술 저작보다 먼저 만들기 |
| [Once Sport Coach Board](https://once.sport/coach-board/) | 오프라인, 노트, 이미지/PDF/영상, 발표 모드 | 현장 네트워크가 없어도 여는 발표 패키지 | 범용 출력 수를 핵심 가치로 삼기 |
| [Sport Session Planner](https://www.sportsessionplanner.com/) | 3D 세션, 연령 맞춤, 저장 라이브러리, QR/WhatsApp 공유 | 코치의 실제 마지막 단계는 ‘저장’이 아니라 ‘선수에게 전달’ | 3D가 이해 향상을 보장한다고 가정 |
| [Drillboard](https://drillboard.eu/features) | timeline scrub, 속도, 단계별 진행 | 현재 강점을 유지하면서 발표자용 단계 전진을 명시적으로 제공 | 단순 슬라이드식 상태 전환으로 후퇴 |
| [Coach Board](https://www.coachboard.app/sports/football) | 브라우저, 애니메이션 포함 링크, 이미지/영상 내보내기 | 설치 없는 player viewer와 링크 공유 | 로그인을 저작 시작의 전제조건으로 만들기 |
| [KlipDraw/Nacsport](https://www.nacsport.com/klipdraw.php?lc=en-us) | 주석별 등장 시간, sequential drawing, spotlight/zoom, tracking | 선수 이동뿐 아니라 설명 요소도 timeline의 시민으로 취급 | 비디오 분석 제품 전체를 지금 복제 |
| [Coach Paint](https://www.coachpaint.com/) | 선수 추적, pitch calibration, 거리·속도, formation, 발표 창 | 장기적으로 실경기 영상과 전술 문서를 대응시키는 방향 | AI 추적·3D 그래픽을 v1 핵심에 포함 |
| [Hudl](https://www.hudl.com/products/hudl) | clip playlist, 코멘트·그림, 선수 피드백, 팀 공유 | 장면 묶음, 코칭 코멘트, 선수 자기 검토 루프 | 캡처·스카우팅·팀 운영까지 범위 확장 |
| [GoArmy Edge](https://www.goarmyedge.com/football) | 정확한 타이밍·공 처리 3D, 선수 시점, formation/play 퀴즈, 코치 노트 | **역할별 시점과 mental reps/퀴즈**가 단순 애니메이션보다 강한 학습 가치 | 미식축구의 고정 assignment 모델을 축구에 그대로 적용 |

### 벤치마크에서 반복된 여섯 패턴

1. **애니메이션은 기본 기대치**이고, 차이는 timeline의 정확도와 설명 가능성에서 난다.
2. 정교한 제품은 선수 움직임뿐 아니라 주석의 등장·퇴장 시간도 편집한다.
3. 실사용은 저장에서 끝나지 않고 링크, 영상, QR, 메신저, 발표 화면으로 이어진다.
4. 코치는 빈 보드보다 패턴·드릴·이전 자료를 복제해 수정하는 경우가 많다.
5. 선수용 제품은 전체 팀 보기 외에 역할별 보기와 퀴즈/mental repetition을 제공한다.
6. 3D와 자동 추적은 눈에 띄지만 비용이 크며, 2D의 시간·설명 모델이 약하면 차별점이 되기 어렵다.

## 4. 연구 근거와 제품 적용

| 근거 | 핵심 결과 | 제품 적용 | 주의 |
| --- | --- | --- | --- |
| [Khacharem et al., 2013](https://pubmed.ncbi.nlm.nih.gov/23798589/) | 축구 동적 시각화에서 초보는 순차 제시, 숙련자는 동시 제시에서 더 높은 학습 성과 | `단계 설명`과 `전체 전개`를 사용자/관객 수준에 따라 전환 | 하나의 표시 방식이 모두에게 최적이라고 가정하지 않기 |
| [동적 전술 장면 instructional design 체계적 문헌고찰](https://www.mdpi.com/1660-4601/18/1/256) | 전문성, 내용 복잡도, 정적/동적·순차/동시 제시가 상호작용 | 설명 프리셋을 `초보/숙련`, `간단/복잡`으로 검증 | UI 편의를 학습 효과로 과장하지 않기 |
| [Segmenting meta-analysis](https://maria-wirzberger.de/wp-content/uploads/2019/01/Rey2019_Article_AMeta-analysisOfTheSegmentingE.pdf) | 내용을 구간으로 나누고 learner pacing을 주는 설계를 폭넓게 검토 | Phase/Chapter, 이전·다음, 구간 반복, 사용자 속도 제어 | 자동 재생만 강요하지 않기 |
| [Signaling meta-analysis](https://www.sciencedirect.com/science/article/pii/S1747938X17300581) | 신호는 기억·전이 개선, 인지부하 감소와 관련 | 현재 행동 선수·공·공간을 제한적으로 spotlight, cue와 설명을 같은 시간/장소에 | 모든 것을 동시에 강조해 신호를 소음으로 만들지 않기 |
| [축구 video-based training 체계적 문헌고찰](https://pmc.ncbi.nlm.nih.gov/articles/PMC9686440/) | 포함 연구 10개 중 8개가 예측/의사결정 사후 향상, 1인칭·VR 가능성; 전이·유지 검증은 부족 | 멈추고 선택, 역할별 view, 응답 시간·정확도, 반복 학습 | 보드 퀴즈가 실전 경기력 향상을 보장한다고 주장하지 않기 |
| [TacticUP validation](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.01690/pdf) | 조감도 장면을 결말 직전 가리고 4개 선택지 중 행동 선택; 축구 핵심 전술 원칙별 점수 | Scenario Quiz, “무엇을 해야 하나?”, 원칙별 태그·결과 | 정답은 코치/전문가 합의와 맥락이 필요, 자동 단일 정답 금지 |
| [Nimmerichter et al., 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5968940/) | 유소년 6주 video training에서 선택 정확도·응답 시간·reactive agility 향상 | 짧고 반복 가능한 mental-rep 세션 | 작은 표본·특정 과제 결과를 일반화하지 않기 |
| [Self-controlled soccer video feedback](https://www.sciencedirect.com/science/article/pii/S0167945717306516) | 자기 선택 피드백 집단은 더 많이 말하고 주도했지만 수행 향상은 유의하지 않음 | 선수 스스로 장면 선택·코멘트·질문 가능 | 참여 증가와 경기력 증가를 동일시하지 않기 |
| [Augmented feedback systematic review](https://www.sciencedirect.com/science/article/pii/S1469029222001455) | 대체로 학습 개선이나 다수 연구 bias가 높고 최적 빈도·타이밍 불명확 | 피드백 강도·빈도 조절, 코치가 최종 통제 | AI/자동 조언을 과신하지 않기 |
| [PanoCoach](https://arxiv.org/abs/2409.13859) | 2D 코치 조작과 선수 1인칭 관점을 동기화하는 초기 MR 개념 | 장기적으로 동일 문서의 coach/player view | 예비 프로토타입을 검증된 효과로 취급하지 않기 |

### 연구에서 도출한 설계 원칙

- 기본은 짧은 Phase와 사용자 제어 재생이다. 복잡한 장면을 한 번에 쏟지 않는다.
- 강조는 “지금 보아야 할 한두 요소”에만 적용하고, 설명을 해당 공간·시점에 붙인다.
- 초보 설명 모드는 순차적이고 코칭 포인트가 있으며, 숙련자 모드는 전체 상호작용을 유지한다.
- 학습 모드는 답을 보여주기 전에 선택하게 하고, 정답/대안/이유를 비교하게 한다.
- 전술적 정답은 맥락 의존적이다. 시스템은 거리·시간·오프사이드 같은 검증 가능한 사실과
  코치가 저작한 원칙을 분리해야 한다.
- 애니메이션은 현장 훈련을 대체하지 않는다. “이해·대화·mental reps 보조”로 포지셔닝한다.

## 5. 후보 기능 우선순위

점수는 1~5. 총점 = 사용자 가치 + 차별성 + 현재 구조 적합성 + 연구 근거 − 구현 위험.

| 순위 | 후보 | 가치 | 차별 | 적합 | 근거 | 위험 | 총점 | 판정 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Phase/Chapter + 설명/전체 모드 | 5 | 5 | 5 | 5 | 2 | 18 | 즉시 계획 |
| 2 | 캔버스 Trigger Link 편집 | 5 | 5 | 5 | 4 | 3 | 16 | 즉시 계획 |
| 3 | 시간 지정 spotlight·callout·coaching point | 5 | 4 | 4 | 5 | 2 | 16 | 즉시 계획 |
| 4 | 전술 오버레이·측정(5 lanes, half-space, 거리) | 4 | 4 | 4 | 4 | 2 | 14 | 다음 |
| 5 | Playbook + 태그 + 변형/비교 | 5 | 4 | 4 | 3 | 3 | 13 | 다음 |
| 6 | 선수 역할 보기 + 멈추고 선택하기 | 5 | 5 | 3 | 5 | 4 | 14 | 기반 후 진행 |
| 7 | 읽기 전용 Player/Pitch-side viewer | 5 | 3 | 3 | 4 | 4 | 11 | 서버 결정 후 |
| 8 | 브라우저 MP4/WebM + 9:16/1:1 export | 4 | 2 | 3 | 3 | 3 | 9 | 공유 단계 |
| 9 | 선택적 전술 lint(오프사이드·속도·간격) | 4 | 5 | 3 | 3 | 4 | 11 | 규칙별 점진 도입 |
| 10 | 실경기 영상/트래킹 import | 5 | 3 | 1 | 4 | 5 | 8 | 별도 제품 단계 |
| 11 | 3D/VR | 3 | 2 | 2 | 3 | 5 | 5 | 보류 |
| 12 | 생성형 AI 전술 자동 작성 | 3 | 3 | 2 | 1 | 5 | 4 | 보류 |

## 6. 권장 기능 정의

### F1. 설명 가능한 Phase/Chapter

- 하나의 Scene을 `빌드업 → 전진 → 마무리` 같은 Phase로 구간화한다.
- Phase마다 제목, 목표, 코칭 포인트, 시작/끝 marker, 반복 여부를 가진다.
- **설명 모드**: Phase별 멈춤, 현재 행동만 강조, 이전/다음, “다시 보기”.
- **전체 모드**: 모든 동시 관계를 원래 시간 그대로 재생한다.
- 작성 중에는 pitch 중앙성을 보존하고, timeline을 펼쳤을 때만 Phase lane을 노출한다.

### F2. Trigger Link

- 경로의 시작 pill을 다른 경로의 start/end, 공 release/receive에 드래그해 연결한다.
- 결과를 자연어로 표시한다: `7번이 받으면 +0.3초 후 출발`.
- 연결선 hover 시 원인·결과 양쪽을 강조하고 cycle/깨진 참조를 즉시 차단한다.
- 기본 단계 모드는 그대로 두고 Advanced timeline에서만 노출한다.

### F3. Timed Coaching Layer

- spotlight, highlight ring, text callout, zone, arrow에 `visible.start/end`를 직접 저작한다.
- playhead에서 `지금부터 표시`, `Phase 동안`, `항상` 세 프리셋을 제공한다.
- 설명이 대상 선수/공에 붙어 이동할 수 있는 `followEntityId`는 additive schema 후보로 검토한다.
- 재생 중 경로 숨김 원칙과 충돌하지 않게 “설명 모드에서만 표시”를 기본값으로 한다.

### F4. 전술 원칙 오버레이·측정

- pitch preset overlay: thirds, 5 lanes, half-spaces, Zone 14, penalty/corner delivery zones.
- 두 선수 거리, 수비 라인, 팀 폭·길이, ball-near 9.15m center-of-play.
- `도움선`과 `전술 평가`를 분리한다. 전자는 사실, 후자는 코치 저작 규칙이다.
- 선택 기능으로 오프사이드 시점, 비현실적 속도, pitch 밖 경로를 warning하되 자동 수정하지 않는다.

### F5. Playbook·Variants

- 전술 카드: 제목, 상황, Phase, 인원, 시작 위치, 원칙, 난이도, 태그, 코칭 포인트.
- `복제하여 변형`, `A/B 비교`, `ghost overlay`, 공통 시작점 잠금.
- 세션 한정 VariantSession을 영속 문서 관계로 확장하되 document truth와 UI state를 섞지 않는다.
- 첫 라이브러리는 10~15개 hand-authored 패턴으로 검증하고 커뮤니티/AI 생성은 보류한다.

### F6. 선수 학습 모드

- 특정 역할을 지정하고 해당 선수·공·관련 teammate만 우선 강조한다.
- 지정 marker에서 재생을 가리고 `패스 / 운반 / 지원 / 침투 / 유지` 또는 코치 정의 선택지를 제시한다.
- 선택 후 전체 전개, 코치 답, 다른 선택이 만든 Variant, 코칭 이유를 보여준다.
- 점수보다 응답 기록과 대화가 우선. 데이터가 없을 때 시스템이 전술 정답을 생성하지 않는다.

## 7. 단계별 실행 로드맵

### Release A — Explain the Timeline

1. **M0 관찰 기준선**: 초보 3명·코치/분석가 3명에게 현재 예시 A를 보여주고 작성 시간,
   순서 회상, 오류, mental effort 1~7, 재생 횟수를 기록한다.
2. **M1 Phase/Chapter 최소 모델**: marker 기반 additive schema, 기존 Scene migration, compile 불변.
3. **M2 두 재생 모드**: 설명(순차/구간 멈춤)과 전체(원 시간), Phase nav·loop.
4. **M3 Timed Coaching Layer**: visible range UI, spotlight/callout, 신호 수 제한 가이드.
5. **M4 검증**: 동일 과제로 전후 비교; 저작 시간 악화 없이 순서 회상과 주관 인지부하 개선 여부 확인.

### Release B — Author the Causality

1. Trigger Link용 hit target·drag grammar와 cycle error UX.
2. `at`, `afterSegment(start/end)`, `onEvent`를 자연어 pill로 양방향 변환.
3. 단계 모드와 trigger truth의 충돌 규칙 정의; simple mode는 자동 relayout, advanced link는 명시적 truth.
4. Scenario A/B 회귀, cycle·dangling 참조·undo transaction·JSON round-trip 테스트.

### Release C — Tactical Language and Reuse

1. metre 기반 overlay/측정 pure engine 모듈.
2. 10~15개 hand-authored atomic/composite pattern과 태그 체계.
3. 영속 Variant 관계, 나란히/ghost 비교, 변경 요약.
4. 선택적 lint 1차: offside, impossible speed, out-of-pitch만. 전술 품질 점수는 제외.

### Release D — Player Learning and Delivery

1. 역할별 보기와 temporal-occlusion question marker.
2. 코치 정의 선택지·답·이유·Variant 연결.
3. 읽기 전용 local/offline player package를 먼저 검증.
4. 서버 범위를 승인한 뒤 share link, 응답 수집, 코멘트 권한을 별도 L3로 설계.
5. 브라우저 영상 export는 16:9·1:1·9:16 프레이밍과 자막을 포함해 별도 성능 예산으로 진행.

## 8. 의도적으로 보류할 것

- **3D/VR**: 역할별 이해 가설은 F6의 2D role view로 먼저 검증한다.
- **실경기 영상 추적**: 별도 media timeline, calibration, tracking provenance, 개인정보·저작권 검토가 필요하다.
- **생성형 AI**: 먼저 hand-authored library와 coach-authored truth를 만든다. AI는 이후 검색·요약·대안 제시부터 시작한다.
- **실시간 공동편집**: 읽기 전용 공유와 비동기 코멘트 수요를 먼저 검증한다.
- **팀/시즌 관리**: 전술 시퀀서의 핵심 작업을 벗어난다. 외부 도구 연계가 더 싸면 연계한다.

## 9. 제품·기술 결정 게이트

구현 전에 다음을 사용자와 확정해야 한다.

1. **주 사용자 우선순위**: 권장 `코치/분석가 저작 → 선수 전달`, 콘텐츠 제작자는 export로 지원.
2. **Release A 범위**: Phase + timed cue를 하나의 설명 릴리스로 묶을지.
3. **Scene 의미**: 권장 Scene=큰 불연속, Phase=같은 timeline의 연속 구간.
4. **공유 경계**: 권장 Release C까지 local-first·no-login 유지.
5. **학습 주장**: “이해와 토론 보조”까지만 사용하고 실전 향상은 별도 연구 전 주장하지 않기.

## 10. 공통 검증 지표

- **저작 효율**: 첫 3-Phase 전술 완성 시간, undo, 잘못된 trigger, 도움말 조회, Inspector 체류.
- **이해**: 순서 회상, “왜 기다렸는가” 설명, 역할별 다음 행동 선택, 재생 횟수, 응답 시간,
  mental effort 1~7. 초보/숙련자를 분리 분석한다.
- **기술**: 동일 document+t의 resolved state, scrub/replay/export parity, 22명·10 Phase·100 segment
  frame budget, keyboard/screen reader/reduced-motion/720·1440px/touch, old schema round-trip.
- **중단 기준**: Phase가 기존 과업 시간을 25% 이상 늘리거나, cue가 이해 없이 mental effort만 높이거나,
  quiz 준비가 전술당 5분을 넘으면 각각 통합 방식·자동 cue·선택지 UI를 재설계한다.

## 11. 조사 한계

- 공식 제품 페이지는 기능 존재를 보여줄 뿐 사용성·학습 효과를 독립적으로 검증하지 않는다.
- 일부 제품은 로그인/설치가 필요해 공개 설명 범위만 비교했다.
- 학습 연구는 표본·과제·전문성 차이가 크고, 보드 애니메이션이 경기 수행으로 전이된다고 직접 증명하지 않는다.
- 따라서 이 문서의 우선순위는 가설이며 M0 사용자 관찰로 조정해야 한다.
