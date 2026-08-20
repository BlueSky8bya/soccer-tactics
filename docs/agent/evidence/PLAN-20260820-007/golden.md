# PLAN-007 M0 Golden (현행 DOM 라우팅 동작, 1440x900, Chromium)

Captured 2026-08-20, dev build. 사용자 원본 스크린샷은 채팅 첨부라 파일이 없어 동등 fixture를 재현(BASE-overlap.png).

```
viewport 1440x900, metresPerPixel=0.1135
G1 separation=1.79m boundary(theory)=1.19m
G1 press@1.04m -> player (expect player)
G1 press@1.34m -> ball-or-other (expect ball-or-other)
G2 alt-from-ghost -> segments=2 steps=[1,2] (expect 2, [1,2])
G3 token-over-path click -> player card=true (expect true)
G4 mid-path click -> action bar=true (expect true)
G5 ctrl add=2 remove=1 (expect 2,1)
G6 shift-marquee union -> rings=2 (expect 2: #5 + #3)
G7 badge press -> picker=true (expect true)
```
