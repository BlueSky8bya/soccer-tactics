import type { Id, TacticDocument } from '@/domain/types'

/** What a step can look at to decide "done". `entry` = document when the step became active. */
export interface TourContext {
  doc: TacticDocument
  entry: TacticDocument
  hasPlayed: boolean
  timelineExpanded: boolean
  autoReactOpen: boolean
  animMode: boolean
}

export interface TourStep {
  id: string
  title: string
  body: string
  /** Keyboard/mouse chip shown in the card. */
  kbd?: string
  /** CSS selector of the element to spotlight (null -> centred card, no spotlight). */
  target: (ctx: TourContext) => string | null
  /** Optional larger element the card should stay clear of (defaults to the target). */
  anchor?: (ctx: TourContext) => string | null
  /** 'side' keeps the card beside the target. */
  placement?: 'auto' | 'side'
  /** Element the card must not cover. */
  avoid?: (ctx: TourContext) => string | null
  /** Runs once when the step becomes active. UI-only side effects. */
  onEnter?: () => void
  /** Step makes no sense in this state -> skipped by nextPendingStep. */
  available?: (ctx: TourContext) => boolean
  /** True once the user has performed the action; the tour advances by itself. */
  done: (ctx: TourContext) => boolean
  /** Final step: only the finish button advances. */
  terminal?: boolean
}

const tracksOf = (doc: TacticDocument) => doc.scenes.flatMap((sc) => sc.timeline.tracks)
const runCount = (doc: TacticDocument) =>
  tracksOf(doc)
    .filter((t) => t.entityKind === 'player')
    .reduce((n, t) => n + t.segments.filter((s) => s.kind === 'move').length, 0)
const passCount = (doc: TacticDocument) =>
  tracksOf(doc)
    .filter((t) => t.entityKind === 'ball')
    .reduce((n, t) => n + t.segments.filter((s) => s.kind === 'travel').length, 0)
const pickPlayer = (doc: TacticDocument, prefer: number[]): Id | null => {
  const home = doc.teams[0]
  const hs = doc.players.filter((p) => !home || p.teamId === home.id)
  for (const n of prefer) {
    const p = hs.find((x) => x.number === n)
    if (p) return p.id
  }
  return hs[hs.length - 1]?.id ?? null
}

/** Simple-mode tour (ADR-0009): place -> run -> pass -> play. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'place',
    title: '선수 놓기',
    body: 'Ctrl을 누른 채 잔디를 클릭하면 우리팀, 우클릭하면 상대팀 선수가 그 자리에 생겨요. 한 번에 채우려면 왼쪽 [양 팀 채우기].',
    kbd: 'Ctrl+클릭 · Ctrl+우클릭',
    target: () => '[data-tour="fill"]',
    done: (c) => c.doc.players.length > 0,
  },
  {
    id: 'run',
    title: '이동 경로',
    body: 'Shift를 누른 채 선수를 끌면 이동 경로가 그려져요. (그냥 끌면 위치만 이동해요) 흐린 토큰을 Shift+드래그하면 그 위치에서 이어서 그려요.',
    kbd: 'Shift+드래그',
    placement: 'side',
    avoid: () => '[data-kind="ball"]',
    available: (c) => c.doc.players.length > 0,
    target: (c) => {
      const id = pickPlayer(c.doc, [9, 7, 11])
      return id ? `[data-entity="${id}"]` : null
    },
    done: (c) => runCount(c.doc) > runCount(c.entry),
  },
  {
    id: 'pass',
    title: '패스',
    body: 'Shift를 누른 채 공을 받을 선수까지 끌면 패스예요. 공을 선수 위에 그냥 놓으면 그 선수가 공을 가져요.',
    kbd: 'Shift+드래그',
    placement: 'side',
    available: (c) => c.doc.players.length > 0,
    target: () => '[data-kind="ball"]',
    done: (c) =>
      passCount(c.doc) > passCount(c.entry) ||
      c.doc.ball.initialHolderId !== c.entry.ball.initialHolderId,
  },
  {
    id: 'play',
    title: '재생과 단계',
    body: 'Space 또는 ▶로 재생해요. 아래 ①②③이 순서예요 — 같은 번호는 같이 시작해서 같이 끝나고, 다음 번호가 이어서 시작해요. 경로 끝의 번호 배지로 바꿔요.',
    kbd: 'Space',
    available: (c) => c.doc.players.length > 0,
    target: () => '[data-tour="play"]',
    done: (c) => c.hasPlayed,
  },
  {
    id: 'finish',
    title: '준비 끝!',
    body: '이 튜토리얼은 오른쪽 위 ? 도움말에서 언제든 다시 볼 수 있어요.',
    kbd: '?',
    target: () => '[data-tour="tour-restart"]',
    done: () => false,
    terminal: true,
  },
]

/** Index of the first step at or after `from` that is not already done (terminal steps always count). */
export function nextPendingStep(from: number, ctx: TourContext): number {
  for (let i = from; i < TOUR_STEPS.length; i++) {
    const s = TOUR_STEPS[i]!
    if (s.terminal) return i
    if (s.available && !s.available(ctx)) continue
    if (!s.done(ctx)) return i
  }
  return TOUR_STEPS.length - 1
}
