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
| Material Design 2의 375/225/195ms | **Material Design 1**의 값이고 M2에는 없다. |
| "200~500ms가 스위트 스폿" | 이를 뒷받침하는 연구가 **없다**. |
| Ng et al. 2012 = "1ms까지 지각한다" | 1ms는 **장비의 성능이자 계단법의 기준 조건**이지 임계가 아니다. 논문의 결론은 평균 JND **6.04ms**(SD 4.33, N=10)와 *"10ms 아래에서도 개선이 뚜렷했다"*. |
| Jota et al. 2013 = "탭 임계 24ms" | 24는 **표준편차**다. 그 논문의 탭 수치는 하한 **20ms**와 평균 JND **64ms**. |
| Agawi TouchMarks 단말 지연표 | 보도자료뿐, 심사 없음, 회사 소멸, 2차 출처끼리 값이 다르다. 대신 Casiez et al., **UIST** 2017(iPhone 6 53.0ms, iPad Air 2 48.3ms, Galaxy S7 Edge 67.3ms)를 쓴다. |

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

## 2b. 지연 — 두 개의 예산, 하나로 합치지 말 것

마지막 조사 2건이 돌아오며 확정된 것. **입력 응답과 애니메이션 길이는 서로 다른 예산**이고, 이 둘을
한 숫자로 뭉개는 것이 이 분야의 표준적 오류다.

| 예산 | 값 | 근거 |
|---|---|---|
| 입력 응답(포인터에 붙은 물체) | **≤100ms**, 사실상 낮을수록 좋음 | 아래 JND 표 |
| 물체 추적 애니메이션 길이 | **~1초** | Card, Robertson & Mackinlay 1991 |

Card et al.의 근거는 양쪽을 다 말해서 강하다: *"much shorter, then the user would lose object
constancy… much longer, then the user would get bored."* 1991~2024년 독립 출처 3건이 여기로 수렴한다.
**우리 보드의 애니메이션은 마이크로 인터랙션이 아니라 물체 추적**이므로, 흔한 200~300ms 가이드는
애초에 우리 경우가 아니다.

민감도 순위(전부 1차 출처):

| 상황 | JND | 출처 |
|---|---|---|
| **직접 터치 드래그** | **11ms** (Deber 2015) / 평균 **6.04ms**, SD 4.33, N=10 (Ng 2012) | 문헌상 **가장 민감한 조건** |
| 마우스 드래그 | 55ms (Deber) · 평균 65ms/중앙값 54ms (Forch 2017) | 두 연구실 독립 수렴 |
| 직접 터치 탭 | 69ms | Deber 2015 |
| 마우스 탭 | 96ms | Deber 2015 |

- 과업이 6배(드래그 vs 탭), 형태가 5배(직접 vs 간접) 차이를 만든다. 지배 변수는 **포인터와 물체
  사이에 보이는 간극**이다.
- Jota et al. 2013: 드래그 **성능** 이득은 25ms 아래에서 멎지만 **지각**은 계속된다 — 성능 임계와
  지각 임계를 같은 것으로 쓰면 안 된다.
- 우연히 발견된 1993년 Nielsen의 한 문장: 애니메이션은 *"컴퓨터 실행 속도의 간접 효과가 아니라
  실시간 시계에 따라"* 타이밍돼야 한다. `src/engine` 순수성 규칙이 이미 강제하는 그 불변식이다.

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

**Pylyshyn & Storm(1988)**: 10개 중 **최대 5개**를 85.6~97.9% 정확도로 추적. 직렬 스캔 모델은
같은 조건에서 ~40%를 예측하므로 병렬 추적의 증거다. 22명이 동시에 움직이는 보드는 이 범위를
한참 넘는다 — focus 모드는 취향이 아니라 근거 있는 기능이다.

두 가지는 정확히 해 둔다:
- **"용량 4"는 이 논문에 없다.** 정수 용량을 제시한 적이 없고, 후대 문헌이 붙인 숫자다.
- **고정 용량설 자체가 논쟁 중이다.** Alvarez & Franconeri(2007)는 느리면 8개, 빠르면 1개로
  속도에 따라 변한다고 봤고, Franconeri et al.(2010)은 **간격(spacing)만이 제약**이라고 주장한다.
  그러나 Feria(2013)가 "근접 조우 수를 통제해도 속도가 추적을 저해한다"로 정면 반박했다.
  → 우리가 쓰기에 안전한 형태는 **"동시에 움직이는 것이 많고 서로 붙어 있을수록 추적이 무너진다"**
  이지, 특정 정수가 아니다.

**Scholl & Pylyshyn(1999) — 사라지는 방식이 중요하다.** 물체가 다른 것 **뒤로 가려지는 것은
추적을 해치지 않는다**(유의차 없음). 그러나 같은 픽셀이 같은 시각에 사라져도 **가장자리를 따라
지워지지 않고 중심에서 축소되거나(implosion) 즉시 사라지면 정확도가 크게 떨어진다**
(F(1,14)=51.02 / 34.62, p<.001). → 토큰을 페이드아웃·축소로 없애면 물체 지속성이 깨진다.
현재 페이드는 경로·배지 등 **장식에만** 걸려 있고 토큰에는 없다 — 그대로 두어야 한다.

※ 사용자 지시로 **재생 중에는 감쇠하지 않는다**(ADR-0009 v9). 문헌과 사용자 선호가 갈리는
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

## 4b. 애니메이션 실증 — 마지막 조사에서 추가된 것

**정적 표현이 애니메이션을 이길 수 있다 (Baudisch et al., UIST 2006 "Phosphor").** 이것이 Tversky가
요구한 대조군이다 — 움직임을 **정적 잔상(afterglow)으로 그린** 조건 vs 애니메이션.
정적 표현이 **125ms 애니메이션을 제외한 모든 조건보다 유의하게 빨랐고** 정확도는 동등했다.
게다가 2000ms 애니메이션은 **정확도가 가장 좋았는데 만족도는 가장 낮았다**.
→ 우리가 경로 트레이스를 정적으로 유지하는 것은 타협이 아니라 근거 있는 선택이다.

**제어 피드백은 0.1초 (Miller 1968, 원문 확인 — 단, 측정치가 아니다).**
Miller 본인이 *"저자의 최선의 추정치이며 …검증되어야 한다"*고 명시한 **전문가 판단**이다.
또한 그는 0.1/1/10초 삼분법을 제시한 적이 없다 — 17개 과업별 한계를 줬고 대표 규칙은
*"2초 넘는 지연은 과업 종결 뒤에만"*이다. 0.1/1/10은 Card et al.(1991) Table 3이 출처이며,
그들 역시 Miller가 아니라 Model Human Processor(1983)와 Newell(1990)을 근거로 든다. *"이 반응은 즉각적이어야 하며 조작자가 유발한
기계적 동작의 일부로 지각되어야 한다. 지연: 0.1초 이하."* 우리 버튼의 누름 상태는
`--st-motion-instant: 80ms` — 규칙 안이다. 스프링(262ms)은 **뗀 뒤의 복귀**에만 걸리고 시각 변화
자체는 즉시 시작하므로 이 규칙과 충돌하지 않는다.

**선호 ≠ 성능** — 독립 연구 3건이 해리를 보인다. Chevalier(2014): 성능이 가장 좋았던 조건이 가장
어렵다고 평가됐고, **아무 이득 없는 staggering이 더 쉽다고 느껴졌다**("촉진의 착각").
Robertson(2008): 애니메이션이 가장 즐겁고 신났는데 분석에선 가장 느리고 부정확했다.
Baudisch(2006): 가장 정확한 조건이 가장 미움받았다.
→ **"더 좋아 보인다"를 근거로 모션을 추가하지 않는다.** 이 문서가 그 방어선이다.

**주의 — 교육용 애니메이션 메타분석을 UI에 끌어오지 말 것.** Höffler & Leutner(2007) d=0.37,
Berney & Bétrancourt(2016) g=0.226은 **학습 내용에서 애니메이션 vs 정적 그림**을 비교한 것이지
**도구 안의 전환 애니메이션 vs 즉시 전환**이 아니다. 외삽 근거 없음.
(두 메타분석의 크기 차이 자체도 초기 소규모 연구 편향의 전형적 신호다.)

## 4c. 패널 폭 — 8개 코드베이스 수렴

리서치가 소스 코드에서 직접 확인한 값들: Adobe UXP **230** · Spectrum **260** · Krita **262** ·
Blender 사이드바 **280** · Godot **280** · VS Code **300** · Penpot **318** · Blender 패널 **340**.
서로 무관한 코드베이스에서 **230~340px**로 좁게 수렴한다.

우리 clamp는 **222~244 / 238~268** — 하단이 이 밴드보다 살짝 아래다. 의도된 이탈이며 근거는
§3의 실측이다: 이 앱의 보드는 폭 제약이라 사이드 1px이 곧 보드 1px이고, 1280에서 그 차이가
면적 47%였다. 다만 **222px 아래로는 더 내리지 않는다** — 한국어 힌트가 단어 중간에서 끊기고
세로로 넘쳐 실제로 잘렸다(실측 후 196→222 상향).

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
- Pylyshyn & Storm (1988) https://doi.org/10.1163/156856888X00122 · Alvarez & Franconeri (2007) https://doi.org/10.1167/7.13.14 · Feria (2013) https://doi.org/10.3758/s13414-012-0369-x
- Scholl & Pylyshyn (1999) http://perception.yale.edu/papers/99-Scholl-Pylyshyn-CogPsych.pdf
- Card, Robertson & Mackinlay (1991) CHI '91 Table 3 https://dl.acm.org/doi/10.1145/108844.108874
- Robertson et al. IEEE TVCG 2008 https://doi.org/10.1109/TVCG.2008.125
- Chevalier et al. IEEE TVCG 2014 https://doi.org/10.1109/TVCG.2014.2346424
- Heer & Robertson InfoVis 2007 https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf
- Wagemans et al. Gestalt centenary review https://pmc.ncbi.nlm.nih.gov/articles/PMC3482144/
- Cockburn, Gutwin & Greenberg CHI 2007 https://www.csse.canterbury.ac.nz/andrew.cockburn/papers/paper191-cockburn.pdf
- Farris, Jones & Anders HFES 2001 https://doi.org/10.1177/154193120104501511
- Brown & Cairns CHI 2004 · Jennett et al. IJHCS 2008 https://doi.org/10.1016/j.ijhcs.2008.04.004
- Shneiderman IEEE Computer 1983 · Hutchins, Hollan & Norman HCI 1985
- Baudisch et al. UIST 2006 (Phosphor) https://patrickbaudisch.com/publications/2006-Baudisch-UIST06-Phosphor.pdf
- Miller (1968) AFIPS FJCC 33 https://dl.acm.org/doi/10.1145/1476589.1476628
- Höffler & Leutner (2007) https://doi.org/10.1016/j.learninstruc.2007.09.013 · Berney & Bétrancourt (2016) https://doi.org/10.1016/j.compedu.2016.06.005
- Tversky, Morrison & Bétrancourt (2002) https://doi.org/10.1006/ijhc.2002.1017
- WCAG 2.2 SC 2.5.7 https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- WCAG 2.2 SC 2.5.8 https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- VS Code / Blender / Godot / Penpot 소스, Adobe Spectrum tokens, NN/g (Budiu 2014)
