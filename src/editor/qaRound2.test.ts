import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { EditorCore } from './editorCore'
import { applyFormation, applyFormations, seedDefaultTeams } from './commands'
import { replaceDocument } from './moreCommands'
import {
  addBallTravel,
  findTrack,
  giveBallTo,
  makePath,
  removeSegment,
  syncTravelReceiverInDraft,
} from './segmentCommands'
import { useUiStore } from './uiStore'
import { compile } from '@/engine/compile'

const fresh = () =>
  seedDefaultTeams(createEmptyDocument({ id: 'd', now: '2026-08-19T00:00:00.000Z' }))

describe('QA round 1 fixes', () => {
  it('seedDefaultTeams is pure and outside history: a fresh core has teams and nothing to undo', () => {
    const core = new EditorCore(fresh())
    expect(core.getDocument().teams).toHaveLength(2)
    expect(core.historyLength).toBe(0)
    expect(core.undo()).toBe(false)
    expect(core.getDocument().teams).toHaveLength(2)
  })

  it('replaceDocument is one undo step — Ctrl+Z brings the previous tactic back', () => {
    const core = new EditorCore(fresh())
    const home = core.getDocument().teams[0]!
    applyFormation(core, home.id, '4-3-3')
    expect(core.getDocument().players).toHaveLength(11)
    replaceDocument(core, fresh())
    expect(core.getDocument().players).toHaveLength(0)
    expect(core.undo()).toBe(true)
    expect(core.getDocument().players).toHaveLength(11)
  })

  it('syncTravelReceiverInDraft re-resolves the receiver from the pass end and keeps the possessed follow-up in sync', () => {
    const core = new EditorCore(fresh())
    const home = core.getDocument().teams[0]!
    applyFormation(core, home.id, '4-3-3')
    const d0 = core.getDocument()
    const [a, b, c] = d0.players
    giveBallTo(core, a!.id)
    const segId = addBallTravel(core, makePath([a!.home, b!.home]).waypoints, {
      at: 0,
      holderId: a!.id,
      receiverId: b!.id,
    })
    let track = findTrack(core.getDocument(), core.getDocument().ball.id)!
    const i = track.segments.findIndex((s) => s.id === segId)
    expect(track.segments[i + 1]?.kind).toBe('possessed')
    // Move the end onto player c → receiver becomes c
    core.transaction('move end', (d) => {
      const tr = findTrack(d, d.ball.id)!
      const seg = tr.segments.find((s) => s.id === segId)!
      if ('path' in seg) seg.path.waypoints[seg.path.waypoints.length - 1]!.p = { ...c!.home }
      syncTravelReceiverInDraft(
        d,
        segId,
        d.players.map((p) => ({ id: p.id, pos: p.home })),
      )
    })
    track = findTrack(core.getDocument(), core.getDocument().ball.id)!
    const seg = track.segments.find((s) => s.id === segId)!
    expect(seg.kind === 'travel' && seg.receiverId).toBe(c!.id)
    const nx = track.segments[i + 1]!
    expect(nx.kind === 'possessed' && nx.holderId).toBe(c!.id)
    // Move the end to empty grass → loose ball, follow-up possessed removed
    core.transaction('move end 2', (d) => {
      const tr = findTrack(d, d.ball.id)!
      const s2 = tr.segments.find((s) => s.id === segId)!
      if ('path' in s2) s2.path.waypoints[s2.path.waypoints.length - 1]!.p = { x: 52.5, y: 1 }
      syncTravelReceiverInDraft(
        d,
        segId,
        d.players.map((p) => ({ id: p.id, pos: p.home })),
      )
    })
    track = findTrack(core.getDocument(), core.getDocument().ball.id)!
    const seg2 = track.segments.find((s) => s.id === segId)!
    expect(seg2.kind === 'travel' && seg2.receiverId).toBeUndefined()
    expect(seg2.kind === 'travel' && seg2.travelKind).toBe('loose')
    expect(track.segments[i + 1]?.kind).not.toBe('possessed')
  })

  it('pause holds the frame; returnToAuthoringStart resets time and scope (PLAN-005 M1)', () => {
    const ui = useUiStore.getState()
    ui.startRange('step', 1.5, 3)
    expect(useUiStore.getState().playback.playing).toBe(true)
    expect(useUiStore.getState().playback.t).toBe(1.5)
    useUiStore.setState((s) => ({ playback: { ...s.playback, t: 2.2 } }))
    ui.setPlaying(false) // pause = hold, no implicit reset
    expect(useUiStore.getState().playback.t).toBe(2.2)
    ui.holdResult(3)
    expect(useUiStore.getState().completion).toBe('held-result')
    expect(useUiStore.getState().playback.t).toBe(3)
    ui.returnToAuthoringStart()
    const st = useUiStore.getState()
    expect(st.playback.t).toBe(0)
    expect(st.playScope).toBe('all')
    expect(st.rangeEnd).toBeNull()
    expect(st.completion).toBe('idle')
  })

  it('QA r3 P0: a second pass after quick start (initial holder set) compiles without a trigger cycle', () => {
    const core = new EditorCore(fresh())
    const [home, away] = core.getDocument().teams
    applyFormations(core, [
      { teamId: home!.id, formationId: '4-3-3' },
      { teamId: away!.id, formationId: '4-4-2' },
    ])
    const d0 = core.getDocument()
    const holder0 = d0.ball.initialHolderId!
    const homePlayers = d0.players.filter((p) => p.teamId === home!.id && p.id !== holder0)
    const r1 = homePlayers[0]!
    const r2 = homePlayers[1]!
    const p1 = addBallTravel(core, makePath([d0.ball.home, r1.home]).waypoints, {
      at: 0,
      holderId: holder0,
      receiverId: r1.id,
    })
    const c1 = compile(core.getDocument())
    expect(c1.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    const arrival = c1.segmentTimes[p1]!.end
    // Second pass drawn at the arrival — caller passes a WRONG hint (the initial holder), as the UI once did.
    const p2 = addBallTravel(core, makePath([r1.home, r2.home]).waypoints, {
      at: arrival,
      holderId: holder0,
      receiverId: r2.id,
    })
    const c2 = compile(core.getDocument())
    expect(c2.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    expect(c2.segmentTimes[p2]!.end).toBeGreaterThan(c2.segmentTimes[p2]!.start)
    const track = findTrack(core.getDocument(), core.getDocument().ball.id)!
    // no phantom possession by the initial holder between the two passes
    const i1 = track.segments.findIndex((s) => s.id === p1)
    const i2 = track.segments.findIndex((s) => s.id === p2)
    const between = track.segments.slice(i1 + 1, i2)
    expect(between.every((s) => s.kind === 'possessed' && s.holderId === r1.id)).toBe(true)
  })

  it('QA r5 C-1: formation change prunes ball segments that referenced replaced players (no ghost passes)', () => {
    const core = new EditorCore(fresh())
    const [home, away] = core.getDocument().teams
    applyFormations(core, [
      { teamId: home!.id, formationId: '4-3-3' },
      { teamId: away!.id, formationId: '4-4-2' },
    ])
    const d0 = core.getDocument()
    const holder0 = d0.ball.initialHolderId!
    const r1 = d0.players.find((p) => p.teamId === home!.id && p.id !== holder0)!
    addBallTravel(core, makePath([d0.ball.home, r1.home]).waypoints, {
      at: 0,
      holderId: holder0,
      receiverId: r1.id,
    })
    applyFormation(core, home!.id, '4-4-2') // replaces every Home player
    const d1 = core.getDocument()
    const alive = new Set(d1.players.map((p) => p.id))
    const track = findTrack(d1, d1.ball.id)!
    for (const s of track.segments) {
      if (s.kind === 'possessed') expect(alive.has(s.holderId)).toBe(true)
      if (s.kind === 'travel') {
        expect(s.receiverId === undefined || alive.has(s.receiverId)).toBe(true)
        expect(s.travelKind).toBe('loose')
      }
      const trg = s.trigger
      if (trg.type === 'afterSegment')
        expect(track.segments.some((x) => x.id === trg.segmentId)).toBe(true)
    }
    expect(compile(d1).issues.filter((i) => i.level === 'error')).toHaveLength(0)
  })

  it('QA r6 N1: deleting a pass also removes the receiver possession it owned; later passes still compile', () => {
    const core = new EditorCore(fresh())
    const [home, away] = core.getDocument().teams
    applyFormations(core, [
      { teamId: home!.id, formationId: '4-3-3' },
      { teamId: away!.id, formationId: '4-4-2' },
    ])
    const d0 = core.getDocument()
    const holder0 = d0.ball.initialHolderId!
    const others = d0.players.filter((p) => p.teamId === home!.id && p.id !== holder0)
    const p1 = addBallTravel(core, makePath([d0.ball.home, others[0]!.home]).waypoints, {
      at: 0,
      holderId: holder0,
      receiverId: others[0]!.id,
    })
    removeSegment(core, p1)
    const d1 = core.getDocument()
    expect(compile(d1).issues.filter((i) => i.level === 'error')).toHaveLength(0)
    const track = findTrack(d1, d1.ball.id)
    expect(
      track?.segments.some((s) => s.kind === 'possessed' && s.holderId === others[0]!.id),
    ).toBe(false)
    const p2 = addBallTravel(core, makePath([d1.ball.home, others[1]!.home]).waypoints, {
      at: 0,
      holderId: holder0,
      receiverId: others[1]!.id,
    })
    const c2 = compile(core.getDocument())
    expect(c2.issues.filter((i) => i.level === 'error')).toHaveLength(0)
    expect(c2.segmentTimes[p2]!.end).toBeGreaterThan(0)
  })
})
