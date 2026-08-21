# 레이아웃·모션 대개편 — 근거 조사 요약 (2026-08-22)

PLAN-20260822-012의 근거 문서. 병렬 조사 5건에서 **이 저장소에 실제로 적용한 것**과, **적용하지
않기로 한 것**, 그리고 **속설로 확인돼 버린 것**을 남긴다. 인용은 1차 출처 우선.

## 0. 조사에서 확인된 "쓰면 안 되는" 수치들

리서치가 잡아낸 유명하지만 근거 없는 값들. 이 저장소 문서에 들어오지 않게 못 박아 둔다.

| 흔한 주장 | 실제 |
|---|---|
| Doherty Threshold **400ms** | 원문(IBM GE20-0752-0, 1982)에 400이라는 시간 값도 "threshold"라는 단어도 **없다**. 데이터 최저값은 0.3초. 2015년 블로그가 차트를 눈으로 읽어 만든 수치. 게다가 **시스템 응답 시간** 이야기지 애니메이션 길이가 아니다. |
| Miller가 0.1/1/10초를 정립 | Miller(1968)는 **0.1/2/15초**를 17개 과업 유형으로 제시했고 보편 수치를 명시적으로 반대했다. 0.1/1/10은 Card et al.(1991) → Nielsen(1993). |
| 여백이 이해도 20% 향상 (Lin 2004) | **날조**. 원 연구는 62~80세 24명의 중국어 UI 읽기였고 여백과 무관하다. Lin 교수 본인이 부인. |
| 황금비·삼분할이 레이아웃 근거 | Green(1995), Markowsky(1992), Amirshahi(2014) 모두 기각. |
| 8pt 그리드가 "더 사용성이 좋다" | 픽셀 스냅 논거는 공학적으로 타당하나 **사용성 비교 연구는 없다**. |
| Apple HIG가 애니메이션 지속시간을 규정 | HIG Motion 페이지에 앱 UI 애니메이션 **밀리초 수치는 하나도 없다**. |

## 1. 모션 — 적용함

**Apple `Spring(duration:bounce:)` 변환식** (developer.apple.com/documentation/swiftui/spring):

```
stiffness = (2π / duration)²
damping   = (1 − bounce) × 4π / duration
```

- 이 저장소의 `springParams`는 **이 식과 정확히 일치**한다(`appleSpring.test.ts`가 Apple 문서의
  worked example `(0.5, 0.3) → (157.9, 17.6)`을 그대로 재현하는 것으로 고정).
- ⚠️ **Apple의 WWDC23 슬라이드 공식은 틀렸다** — `damping = 1 − 4π×bounce÷duration`은 위 예에서
  **−6.54**(음수 감쇠 = 발산)를 준다. 영상만 보고 구현하면 bounce>0에서 미묘하게, bounce<0에서
  심하게 깨진다. 우리는 문서 쪽 식을 쓴다.
- Apple 프리셋: `.smooth` 0.5/0, `.snappy` 0.5/0.15, `.bouncy` 0.5/0.30 — **pace는 하나(0.5)로
  두고 bounce만 바꾼다**. WWDC23 10158: **bounce > 0.4는 UI에 과하다**. 우리 4개 역할은 전부 ≤0.3.
- `duration`은 **재생 시간이 아니라 체감 pace**다. `.bouncy` "0.5초"는 824ms까지 움직인다.
  스프링 종료를 시퀀싱 조건으로 쓰면 안 된다.

**CSS `linear()` 이징으로 스프링을 그대로 재현**(M1). 베지어는 바운스를 표현할 수 없어, 이전에는
사람이 만지는 컨트롤이 피치 토큰과 다른 곡선으로 움직였다. `springCss.test.ts`가 토큰과 JS 스프링의
드리프트를 막는다.

**juice는 역U자**: Kao(2020, **N=3018**)에서 None과 **Extreme이 똑같이** 나쁘다 — 선호도가 아니라
**수행 성능**이 떨어진다. Hicks et al.(CHI PLAY 2019)은 시각적 매력 외 대부분에서 거의 null.
→ 빈번한 이벤트는 bounce 0, 드문 이벤트만 0.25~0.3. `appleSpring.test.ts`가 이 형태를 고정한다.

## 2. 드래그 지연 — 적용함 (ADR-0006 D9)

지연 민감도는 **포인터와 거기 붙어야 할 물체 사이의 시각적 간극**이 지배한다. 드래그는 그 간극을
만들고 탭은 만들지 않아 **약 6배** 민감하다.

| 상황 | 인지 임계(JND) | 출처 |
|---|---|---|
| 마우스(indirect) 드래그 | **55ms** | Deber et al., CHI 2015 |
| 마우스 드래그 | 평균 **65ms** / 중앙값 54ms | Forch et al., EPCE 2017 |
| indirect 탭 | 96ms | Deber et al. 2015 |

- 지연은 Fitts 난이도에 **곱셈**으로 작용: `MT = 230 + (169+LAG)·IDe`, R²=93.5%
  (MacKenzie & Ware, INTERCHI 1993). **안전한 하한선은 없다.** "75ms 임계"는 오독 — 원문은
  "측정이 쉬워지는 지점"이라 했다.
- → 위치 속성에 transition/스프링 금지. `dragLatency.test.ts`가 강제(위반을 심어 실패 확인).
- Jota et al.(2013)의 경고도 기록해 둔다: *"디자이너는 지연을 애니메이션으로 보상한다 — 지연이
  줄면 그런 효과는 불필요해진다."* 스프링이 지연의 **증상**일 수 있다.

## 3. 레이아웃 — 적용함

**측정이 먼저다.** 이 앱의 피치는 105:68 고정비라 이 그리드에서 **모든 노트북 폭에서
width-constrained**이고 세로 여유 120~220px를 쓰지 못한다. 즉 사이드 크롬 1px = 보드 1px 손실.

실측 보드 폭(고정 260/304 → clamp): 1280 **667→809px(면적 +47%)**, 1440 821→958px(+17%),
1920 +3.7%, 2560 0%(거기선 height-constrained).

**업계 수치와 대조** (전부 소스 코드·디자인 토큰에서 확인된 값):

| 출처 | 값 |
|---|---|
| VS Code 사이드바 | `min(300px, 폭/4)`, 최소 **170px** |
| Adobe Spectrum `standard-panel-width` | **260px** (min 200 / max 400) |
| Blender 우측 인스펙터 | **17.37~17.82%** — 두 파일의 **모든** 워크스페이스에서 일정 |
| Godot 도크 | 280px |
| 캔버스 점유율 수렴대 | **70~85%** (사이드 도킹만 있을 때) |

우리 clamp(222~244 / 238~268)는 Spectrum 200~400 밴드 안, VS Code 최소 170 위, 1440에서 우측
16.5%로 Blender 상수와 근접.

**하지 않기로 한 것**: 순수 8pt 그리드 정리. 리서치가 명시적으로 반대한다 — Carbon 스케일은
`2,4,8,12,16,24,32,40,48,64`로 **비균일**이고, Apple 데스크톱 컨트롤 자체가 6/8/10/12를 쓴다.
조밀한 전문 도구에서 엄격한 8배수는 부풀어 보인다. 대신 스케일에 빠진 단계(2, 40, 48)만 채웠다.

**게슈탈트 근접성**: Kubovy의 Pure Distance Law — 그룹 간/내 간격 비가 **1.5를 넘지 않으면 그룹이
다중안정 상태**가 된다(Wagemans et al. 리뷰). 왼쪽 패널이 12/8 = **정확히 1.5**였다 → 16px(2.0)로.
(주: 점격자 실험에서 위젯 레이아웃으로의 전이는 추론이지 검증된 값은 아니다.)

## 4. 몰입 — 적용함

**Pylyshyn & Storm(1988): 동시에 추적 가능한 물체는 ~5개.** 22명이 동시에 움직이는 보드는 추적
용량을 한참 넘는다. focus 모드는 취향이 아니라 근거 있는 기능이다.
※ 단, 사용자 지시로 **재생 중에는 감쇠하지 않는다**(ADR-0009 v9). 문헌과 사용자 선호가 갈리는
지점이라 명시해 둔다.

**Robertson et al.(2008)**: 애니메이션은 **발표에는 가장 빠르고 즐겁지만 분석에는 가장 나쁘다**
(정적 표현이 유의하게 빠르고 정확). → 재생은 발표 채널, 경로 트레이스는 분석 채널. **둘 다 유지.**

**Chevalier et al.(2014)**: staggering은 추적 성능에 **무익하거나 해롭다** — common-fate 그룹
정보를 파괴한다. 축구에서 그건 의미 자체(백4가 함께 올라감)다. → **연출용 stagger 금지**, 지연은
저작된 전술 의도일 때만.

**F = zen 모드 (신규)**: Photoshop·Blender·Figma·VS Code·Sketch가 **예외 없이** 도킹 기본 +
원키 전체 캔버스를 40년간 제공해 왔다. Figma는 플로팅 패널을 실험했다가 *"캔버스를 좁히고 …
사람을 느리게 만든다"*는 이유로 되돌렸다. 실측 보드 +16%.

**Budiu(NN/g 2014)**: *"크롬을 줄여서 콘텐츠 비율이 실질적으로 개선되지 않으면 크롬을 보여라."*
1920에서 300px 사이드바는 16% — 그 기준을 넘지 못한다. → 기본은 보이게, 숨김은 옵션.

## 5. 미해결 — 사용자 결정 필요

**WCAG 2.5.7 Dragging Movements (Level AA)**: *"드래그로 하는 모든 기능은 드래그 없이 단일
포인터로도 가능해야 한다."* Understanding 문서가 못 박는다 — **키보드 대안은 이 기준을 충족하지
않는다**(포인터로 클릭 가능한 컨트롤이어야 한다).

이 앱의 저작은 전부 드래그다(Alt+드래그 경로, 공 드래그, 경로 휘기). **AA 부적합**이며 고치려면
포인터 전용 저작 경로(예: 선수 클릭 → 목적지 클릭, 웨이포인트 클릭 배치, Inspector 수치 입력)가
필요하다 — 별도 L3 범위다.

**WCAG 2.5.8 Target Size (Minimum), Level AA**: 최소 **24×24 CSS px**. 저장소 토큰은
`--st-hit-token: 28px` ✅ / `--st-hit-handle: 16px` ❌. 경유지 핸들이 기준 미달이고, 곡선 위에
핸들이 몰리면 Spacing 예외(24px 원이 서로 겹치지 않을 것)도 통과하지 못한다. 핸들 히트 영역을
24px로 올리거나, 모든 핸들 조작을 Inspector에서도 할 수 있게 해 Equivalent 예외를 쓰는 두 길이 있다.

부수적으로 **WCAG 2.2.2**: `G` 반복 재생은 첫 순환 이후 "사용자가 시작한" 예외를 잃으므로 점검 대상.
**WCAG 2.5.1/2.3.1**도 함께 점검 대상(제스처 단독 경로 금지, 깜빡임 3Hz 이하).

## 출처

- Apple Spring 문서 https://developer.apple.com/documentation/swiftui/spring · HIG Motion
- Kao (2020) Entertainment Computing 35 https://doi.org/10.1016/j.entcom.2020.100359
- Hicks et al. CHI PLAY 2019 https://doi.org/10.1145/3311350.3347171
- Deber et al. CHI 2015 https://dl.acm.org/doi/10.1145/2702123.2702300
- Forch et al. EPCE 2017 https://link.springer.com/chapter/10.1007/978-3-319-58475-1_4
- MacKenzie & Ware INTERCHI 1993 https://www.yorku.ca/mack/CHI93b.html
- Pylyshyn & Storm (1988) https://doi.org/10.1163/156856888X00122
- Robertson et al. IEEE TVCG 2008 https://doi.org/10.1109/TVCG.2008.125
- Chevalier et al. IEEE TVCG 2014 https://doi.org/10.1109/TVCG.2014.2346424
- Heer & Robertson InfoVis 2007 https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf
- Wagemans et al. Gestalt centenary review https://pmc.ncbi.nlm.nih.gov/articles/PMC3482144/
- Cockburn, Gutwin & Greenberg CHI 2007 https://www.csse.canterbury.ac.nz/andrew.cockburn/papers/paper191-cockburn.pdf
- Farris, Jones & Anders HFES 2001 https://doi.org/10.1177/154193120104501511
- Brown & Cairns CHI 2004 · Jennett et al. IJHCS 2008 https://doi.org/10.1016/j.ijhcs.2008.04.004
- Shneiderman IEEE Computer 1983 · Hutchins, Hollan & Norman HCI 1985
- WCAG 2.2 SC 2.5.7 https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- VS Code / Blender / Godot / Penpot 소스, Adobe Spectrum tokens, NN/g (Budiu 2014)
