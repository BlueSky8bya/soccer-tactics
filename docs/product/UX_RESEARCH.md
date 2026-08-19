# UX Research — HCI References for the Tactics Sequencer

> Date: 2026-08-19. 수집: 웹 조사(에이전트). ⚠ = URL 미검증(DOI/venue만).
> 목적: ADR-0006(Interaction & Motion Design)의 근거. "Apple처럼 통통 튀고 탁 달라붙는 조작감 + PC에서 HCI적으로 편리 + Harmony/Immersion/Fun".
> 형식: 출처 — 발견 — **이 제품에의 적용**.

## 1. Direct Manipulation / Editor 기본

| # | 출처 | 발견 | 적용 |
|---|---|---|---|
| 1 | Shneiderman, *Direct Manipulation*, IEEE Computer 1983 — https://dl.acm.org/doi/10.1109/MC.1983.1654471 | 관심 객체 상시 가시, 빠르고 점진적이며 되돌릴 수 있는 행동, 명령어 대신 물리적 행동 | 모든 전술 편집 = 캔버스 위 제스처 + 즉시 프리뷰 + Undo. 핵심 편집에 모달 금지 |
| 2 | Hutchins·Hollan·Norman, *Direct Manipulation Interfaces*, HCI 1985 — https://www.tandfonline.com/doi/abs/10.1207/s15327051hci0104_2 | Directness = gulf of execution/evaluation 축소 | 타이밍도 pitch 위에서 편집(선수를 경로 따라 드래그 = 시간 설정). 결과는 손 있는 곳에 표시 |
| 3 | Fitts 1954, DOI 10.1037/h0055392 ⚠; NN/g *Fitts's Law* 2022 — https://www.nngroup.com/articles/fitts-law/ | MT ∝ log(D/W). 화면 가장자리 = 무한 타깃. 보이지 않는 패딩만으론 부족 | handle/waypoint/playhead hit ≥ 16px(시각은 더 작게), hover 시 확대 표시. 툴 레일·재생바는 화면 가장자리에 도킹 |
| 4 | Hick 1952 / NN/g *Hick's Law* — https://www.nngroup.com/videos/hicks-law-long-menus/ | 선택지 수 log 비례 결정 시간 | 기본 툴 5~7개(선택·선수·공·경로·구역·텍스트), 나머지는 more/컨텍스트 |
| 5 | Nielsen *10 Heuristics* — https://www.nngroup.com/articles/ten-usability-heuristics/ ; *Complex Applications* — https://www.nngroup.com/articles/usability-heuristics-complex-applications/ | 상태 가시성, 사용자 통제(undo), 일관성, 인식>회상, 전문가 도구도 forgiveness+가속기 | 상시 playhead 시간·선택 상태·Undo/Redo. 단축키는 tooltip에 표기. Space 재생, ←→ 프레임 |
| 6 | Nielsen *Progressive Disclosure* 2006 — https://www.nngroup.com/articles/progressive-disclosure/ | 초기 옵션 최소, 최대 2단계 | L1: 드래그 배치 + 자동 타이밍 경로. L2: 타임라인(track/easing/speed). L3 없음 |
| 7 | NN/g *User Control & Freedom* — https://www.nngroup.com/videos/usability-heuristic-user-control-freedom/ | 실수는 싸야 함 | Esc = 진행 중 드래그/경로 취소·복원. 모든 transaction undo |
| 8 | NN/g *Proximity* / *Common Region* — https://www.nngroup.com/articles/gestalt-proximity/ , https://www.nngroup.com/articles/common-region/ | 근접·공통영역이 그룹 인지 지배 | 선수별 segment는 한 lane/컨테이너, 팀별 track 밴드, Inspector 섹션 카드 |

## 2. Motion / Interaction Feel

| # | 출처 | 발견 | 적용 |
|---|---|---|---|
| 9 | Apple HIG *Motion* — https://developer.apple.com/design/human-interface-guidelines/motion | 의미 전달용, 짧고 정확, 빈번 상호작용엔 과한 모션 금지, Reduce Motion 존중 | chrome 전환 150–300ms. 선택/툴 전환엔 flourish 없음. reduce-motion은 UI spring만 끔(전술 재생은 콘텐츠) |
| 10 | WWDC23 *Animate with springs* — https://developer.apple.com/videos/play/wwdc2023/10158/ | spring = duration + bounce(−1..1). bounce 0 범용, 0.15 살짝, 0.3 눈에 띔, >0.4 과함. 재타깃 시 속도 보존 → 끊김 없는 중단 | `spring(duration, bounce)` 헬퍼. 패널/스냅 duration 0.3–0.4s, bounce 0.15–0.3("탁 달라붙음"). 선택/hover bounce 0. mid-flight 재타깃은 현재 속도 계승 |
| 11 | WWDC18 *Designing Fluid Interfaces* — https://developer.apple.com/videos/play/wwdc2018/803/ | 즉시 반응, 1:1 추적, 연속 피드백, 언제든 리다이렉트/중단, 투사(momentum)로 착지 결정, rubber-band 경계, 시각보다 넓은 hit | drag = 커서에 지연 0 고정. 애니메이션 중단 가능. drop/snap은 투사 속도 사용. pitch pan rubber-band. handle 불가시 hit 확대 |
| 12 | NN/g *Animation Duration* 2021 — https://www.nngroup.com/articles/animation-duration/ | 100–400ms 적정, 500ms+ 지연감. 등장>퇴장. linear 금지 | 패널 열기 250–300 / 닫기 200. tooltip ≤150. UI 애니메이션 중 편집 차단 금지 |
| 13 | Val Head 2016 — https://valhead.com/2016/05/05/how-fast-should-your-ui-animations-be/ | 작은 요소 200–300, 크고 bouncy 400–500 | formation slot 스냅 같은 bouncy ≈400ms, 작은 상태 변화 ≤250 |
| 14 | Material 3 *Easing & duration* — https://m3.material.io/styles/motion/easing-and-duration/tokens-specs | duration 토큰, enter decelerate / exit accelerate | 모션 토큰 1회 정의(`--st-motion-*`). UI 토큰과 전술 재생 시간(실초, 선형) 분리 |
| 15 | WCAG 2.3.3 *Animation from Interactions* — https://w3c.github.io/wcag/understanding/animation-from-interactions | 상호작용 유발 모션은 비필수면 끌 수 있어야. 저작 도구의 콘텐츠 애니메이션은 essential | UI 모션은 reduce-motion 준수, 전술 재생은 유지. 앱 내 "bounce 끄기" 설정 |
| 16 | MDN *prefers-reduced-motion* — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion | 비필수 모션만 축소/대체 | `reducedMotion` 플래그(OS + 앱 토글) → spring 대신 즉시/100ms fade |

## 3. 초보자 애니메이션 저작 / 타임라인

| # | 출처 | 발견 | 적용 |
|---|---|---|---|
| 17 | K-Sketch, Davis·Colwell·Landay CHI 2008 — https://dl.acm.org/doi/10.1145/1357054.1357122 | 시연(드래그 녹화) 기반 저작, 최소 연산. PowerPoint 대비 3× 빠르고 학습 절반. 타이밍 탐색에 강함 | **Record 모드**: 선수를 실시간 드래그 → 경로+타이밍 동시 저작. 재드래그로 재타이밍 |
| 18 | Moscovich·Hughes *Animation Sketching* — https://cs.brown.edu/media/filer_public/3e/8a/3e8aa194-f7a3-41c2-bd9c-a685661354ef/tm.pdf | motion-by-example | 기본 저작 = 시연, keyframe은 정제 레이어 |
| 19 | Motion Doodles, Thorne et al. SIGGRAPH 2004 — https://www.cs.ubc.ca/~van/papers/2004-siggraph-motiondoodles.pdf | 스트로크 형태가 동작 유형, 길이/시간이 속도 | (후순위) 스트로크로 의도 추론: 직선=런, 점선=패스. 녹화 시 속도는 스트로크 시간 |
| 20 | Draco, Kazi et al. CHI 2014 — https://inria.hal.science/hal-00926847/en | 타임라인 대신 모션 파라미터 직접 연속 조작 | 경로 위 on-canvas 핸들(속도·도착 시각) → 타임라인 거의 안 써도 됨 |
| 21 | Kitty, Kazi et al. UIST 2014 — https://dl.acm.org/doi/10.1145/2642918.2647375 | 엔티티 간 함수 관계 그래프가 협응 모션 구동 | "공 도착 → 리시버 출발" 같은 의존은 프레임이 아니라 **링크**로 편집(ADR-0003 Trigger) |
| 22 | DimP, Dragicevic et al. CHI 2008 — https://dl.acm.org/doi/10.1145/1357054.1357096 ; https://dragice.fr/dimp/ | 객체를 궤적 따라 드래그해 시간 scrub. 모션 중심 과업에서 슬라이더보다 빠름 | **시그니처**: 선수/공을 그려진 경로 따라 드래그 → 전역 clock scrub, 나머지 동기 |
| 23 | Nguyen·Niu·Liu CHI 2013 — https://dl.acm.org/doi/10.1145/2470654.2466150 | 궤적 교차 시 시간 모호성 | 교차/루프 시 현재 playhead에 가장 가까운 시각 선택, ghost 마커 |
| 24 | Keynote Magic Move — https://support.apple.com/guide/keynote/add-transitions-tanff5ae749e/mac | 슬라이드 복제→재배치→자동 보간, duration+ease만 노출 | Phase 기반 저작 옵션: phase 복제→선수 이동→자동 보간 (Scene 모델 확장) |
| 25 | Figma Smart Animate — https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames | 이름 매칭 보간, 전환별 easing(spring 포함) | phase 간 안정 ID, segment별 easing 선택 |

## 4. 스포츠 전술 도구 / 연구

| # | 출처 | 발견 | 적용 |
|---|---|---|---|
| 26 | TacticalPad — https://www.tacticalpad.com/en-us/new/index.php | 2D/3D 애니, 애니메이션 커브, 정렬, 다중 보드, MP4 export | 경쟁 기준선. 차별화 = 직접 타이밍 + 조작감 |
| 27 | Tactics Manager (SoccerTutor) — https://www.soccertutor.com/pages/tactics-manager | walk/jog/run/receive/pass/shoot 액션 어휘 | 속도 preset 어휘 채택 |
| 28 | Hudl Studio — https://www.hudl.com/products/studio | 1클릭 마커/존/화살표 | 마크업 도구는 1클릭 |
| 29 | Seebacher et al. *Sketchplan*, IEEE TVCG 2021 — https://ieeexplore.ieee.org/document/9647932/ | 1부리그 코치: 자석판 멘탈모델, 가벼운 보드 조작 선호 | drag-magnet 1차, 분석 2차 |
| 30 | Stein et al. *Bring It to the Pitch*, TVCG 2018 — https://pubmed.ncbi.nlm.nih.gov/28866578/ | 추상 시각화를 pitch 위에 오버레이 | 경로·존·압박 영역은 pitch 위에, 사이드 차트 아님 |
| 31 | Perin et al. *SoccerStories*, TVCG 2013 — https://hal.science/hal-00846718 | 단계(phase) 문맥, overview+detail | 타임라인 = 이름 있는 phase 시퀀스 + overview strip |
| 32 | Perin et al. *Sports Data Vis STAR*, CGF 2018 — https://onlinelibrary.wiley.com/doi/10.1111/cgf.13447 | 궤적 인코딩 관행 | 화살표=이동, 점선=패스 등 관행 유지 |
| 33 | Gualtieri et al. 2023 — https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1116293/full | HSR ≥5.5 m/s, sprint ≥7.0, 최대 ≈8.9 | 속도 preset: walk 1.5 · jog 3 · run 5 · sprint 7.5 m/s (편집 가능) |
| 34 | *Sci. Reports* 2024 — https://www.nature.com/articles/s41598-024-62480-7 | 평균 초기 패스 속도 ≈16.2 m/s, 감속 ≈7.9 m/s² | pass preset: short 10 · firm 16 · driven 20+ m/s. (v1 등속, 감속은 Revisit) |

## 5. Undo / History

| # | 출처 | 발견 | 적용 |
|---|---|---|---|
| 35 | Berlage *Selective undo*, TOCHI 1994, DOI 10.1145/198425.198427 ⚠ | command object 히스토리 | 모든 편집 = command {do, undo, merge} (ADR-0005 patches) |
| 36 | Myers·Kosbie *Amulet*, CHI 1996 ⚠ | 저수준 입력이 고수준 command로 롤업 | 드래그 mousemove 스트림 → "선수 이동" 1 step. 다중 선택 nested transaction |
| 37 | Figma `commitUndo` — https://developers.figma.com/docs/plugins/api/properties/figma-commitundo | pointer-up까지 batch, 빠른 nudge 병합 | 슬라이더/드래그 release 시 commit, 화살표 nudge ~500ms 내 병합 |

## Cross-cutting 결론

1. **두 개의 시계**: UI 모션(spring 150–400ms, 중단 가능, reduce-motion) vs 전술 모션(물리 속도, 선형/결정론, UI spring 영향 0).
2. **시그니처 인터랙션**: 경로 따라 객체 드래그 = 시간 scrub(DimP) + 시연 녹화(K-Sketch). 타임라인/keyframe은 2단계 disclosure.
3. **"탁 달라붙음"**: 스냅 spring duration ≈0.35s, bounce 0.15–0.3. 선택/hover bounce 0. hit ≥16px, 가장자리 도킹.
4. **Undo**: gesture당 1 step, nudge 병합.
