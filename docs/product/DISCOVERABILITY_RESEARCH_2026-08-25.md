# 조사 — 단축키를 어떻게 보여줘야 배우는가 (2026-08-25)

사용자 요청: "연구자료나 웹 검색 다시 해." 대상 질문 세 개.

1. 단축키를 **언제·어디에** 보여줘야 실제로 쓰게 되는가?
2. 목록을 **어떻게 배치**해야 기억에 남는가?
3. 펼침/접힘을 **어떤 규칙**으로 움직여야 조작을 방해하지 않는가?

저장소 기존 근거(`DESIGN_RESEARCH_2026-08-22.md`)는 모션·간격·패널 폭을 다루지만 **학습·발견성은
다루지 않는다**. 그래서 이 문서는 그 공백만 채운다.

## 1. 언제 보여주는가 — ExposeHK (CHI 2013)

Malacria, Bailly, Harrison, Cockburn, Gutwin. **수정자 키를 누르고 있는 동안 그 명령 위에 단축키를
겹쳐 보여 준다.** 설계 목표 4가지: 훑어보기(browse), **물리적 리허설**(비전문가가 전문가의 동작을
그대로 수행하게 함), 공간 기억 활용, 평평한 명령 계층으로 전문가 성능 최대화.

측정치: **선택의 99%가 단축키로 이루어졌다**(블록 1에서 93% → 블록 6에서 100%). 오디오 피드백
조건은 **64%**(37% → 77%). 선택 시간에는 유의한 차이가 없었다 — 즉 **느려지지 않으면서** 단축키
사용률만 올랐다.

→ 우리에게: **키를 실제로 쥐고 있는 동안** 그 키의 전체 설명이 열려야 한다. 하이라이트만으로는
리허설이 아니다. 손이 이미 키 위에 있는 그 순간이 배우는 순간이다.

## 2. 어떻게 배치하는가 — KeyMap (CHI 2020)

Lewis, d'Eon, Cockburn 외. 수정자를 누르면 **가상 키보드 그림 위에** 명령 이름을 얹는다(Norman의
자연스러운 매핑). 선형 메뉴가 아니라 **공간 배치**라는 것이 요점 — cut/copy/paste가 서로 옆에
있다는 사실이 메뉴에서는 보이지 않는다.

측정치: ExposeHK 대비 **직후 +1개**, **24시간 뒤 +4.5개**를 더 기억했다.

→ 우리에게: 목록을 한 줄로 죽 늘어놓지 않는다. **무엇을 위한 키인지로 묶는다**(만들기 / 보기 /
정리). 키보드 그림까지 가지는 않는다 — 이 앱의 단축키는 9개고, 그림 한 장이 화면을 더 먹는다.

## 3. 펼칠 때 무엇이 움직여도 되는가 — CommandMaps (Scarr, Cockburn, Gutwin, Bunt)

공간 기억 + 계층 평탄화. 결론: **공간 안정성(scaling)이 재배치(reflowing)를 압도적으로 이긴다.**
일관된 공간 배치가 위치 학습을 돕고 선택 성능을 올린다.

→ 우리에게: 펼칠 때 **가리키고 있는 행은 절대 움직이지 않는다**. 상세는 그 행 **아래로** 열리고,
움직이는 것은 그 아래 행들뿐이다. 그리고 행의 순서·그룹은 세션 내내 고정이다.

## 4. 산업 선례 — Blender 2.8 상태 표시줄

2.8에서 하단 상태 표시줄이 추가된 목적이 **"현재 맥락에서 어떤 단축키가 유효한지 알리는 것"**이다.
왼쪽에 마우스 버튼과 활성 도구의 키맵을 표시하고, 설계 원칙으로 **마우스 버튼의 위치를 고정**해
공간적 연상을 유지한다. 수정자 키는 텍스트와 구분되도록 **둥근 사각형(roundrect) 배지**로 그린다.

→ 우리에게: 캡을 배지로 그리는 것, 그리고 **자리 고정**은 검증된 관행이다. 다만 우리는 하단이
아니라 **왼쪽 여백**을 쓴다 — 이 앱의 하단은 이미 재생 바가 쓰고 있고, 보드가 높이 제약이라
좌우 여백이 실제로 남는다(1440×900에서 한쪽 약 135px).

## 5. 접근성 — 호버만으로 끝내지 않는다

호버/툴팁을 **유일한** 공개 수단으로 쓰는 것은 흔한 접근성 실패다. 호버 상태를 발견하거나 발동할
수 없는 사용자에게 그 정보는 존재하지 않는 것과 같다. 권장은 **지속적으로 보이는 트리거**(정보
아이콘, "자세히" 링크)를 함께 두는 것.

→ 우리에게: 캡과 낱말은 **항상 보인다**(호버가 필요 없다), 각 행은 **포커스 가능한 버튼**이라
키보드로도 열 수 있고, 열에는 `?` **단축키 전체 보기**가 상시 있다. 호버는 세 번째 경로일 뿐이다.

## 가져오지 않은 것

- **가상 키보드 그림**(KeyMap 원형): 단축키 9개에 키보드 한 장은 화면 대비 이득이 없다. 공간
  배치의 이득은 "무엇을 위한 키인지"로 묶는 것으로 취한다.
- **명령 위에 직접 겹치기**(ExposeHK 원형): 이 앱의 "명령"은 툴바 버튼이 아니라 **잔디 위의
  제스처**다. 겹칠 대상이 없다 — 대신 보드 옆 고정 열이 그 자리를 대신한다.
- **툴팁 지연 튜닝**: 호버는 보조 경로이고, 열림은 스프링(`--st-spring-overlay`)이 이미 담당한다.

## 출처

- Malacria, Bailly, Harrison, Cockburn, Gutwin — *Promoting Hotkey Use through Rehearsal with ExposeHK*, CHI 2013. https://dl.acm.org/doi/10.1145/2470654.2470735 · PDF https://www.csse.canterbury.ac.nz/andrew.cockburn/papers/ehk.pdf
- Lewis, d'Eon, Cockburn 외 — *KeyMap: Improving Keyboard Shortcut Vocabulary Using Norman's Mapping*, CHI 2020. https://dl.acm.org/doi/10.1145/3313831.3376483 · PDF https://gregdeon.com/files/lewis-2020-CHI-keymap.pdf
- Scarr, Cockburn, Gutwin, Bunt — *Improving Command Selection with CommandMaps*, CHI 2012. https://www.csse.canterbury.ac.nz/andrew.cockburn/papers/commandMap-finalCamera.pdf
- Scarr, Cockburn, Gutwin — *Exploiting spatial memory to design efficient command interfaces*, CHI EA 2013. https://dl.acm.org/doi/10.1145/2468356.2468711
- Blender 2.8 UI: Status Bar Design (T54861) https://developer.blender.org/T54861 · Status Bar 매뉴얼 https://docs.blender.org/manual/en/latest/interface/window_system/status_bar.html
- 호버 공개의 접근성 한계 — 툴팁/점진적 공개 가이드 정리 https://ebay.gitbook.io/mindpatterns/disclosure/tooltip
