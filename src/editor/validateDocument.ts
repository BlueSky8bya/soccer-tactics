/**
 * Structural validation for imported documents (persistence). Nested, no deps.
 * Returns a list of human-readable problems ('' path = root). Empty list = OK.
 * Deliberately tolerant of unknown extra fields (forward compat) but strict on shapes we read.
 */
import { SCHEMA_VERSION } from '@/domain/types'

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0
const isVec = (x: unknown): boolean => isObj(x) && isNum(x.x) && isNum(x.y)

export function validateDocument(input: unknown): string[] {
  const errs: string[] = []
  const bad = (p: string, msg: string) => errs.push(`${p}: ${msg}`)
  if (!isObj(input)) return ['root: not an object']
  const d = input
  if (d.schemaVersion !== SCHEMA_VERSION) bad('schemaVersion', `expected ${SCHEMA_VERSION}`)
  if (!isStr(d.id)) bad('id', 'missing')
  if (!isObj(d.meta) || typeof d.meta.title !== 'string') bad('meta.title', 'missing')
  if (
    !isObj(d.pitch) ||
    !isNum(d.pitch.length) ||
    !isNum(d.pitch.width) ||
    d.pitch.length <= 0 ||
    d.pitch.width <= 0
  )
    bad('pitch', 'length/width must be positive numbers')

  const teamIds = new Set<string>()
  if (!Array.isArray(d.teams)) bad('teams', 'not an array')
  else
    d.teams.forEach((t, i) => {
      if (
        !isObj(t) ||
        !isStr(t.id) ||
        typeof t.name !== 'string' ||
        typeof t.color !== 'string' ||
        (t.side !== 'left' && t.side !== 'right')
      )
        bad(`teams[${i}]`, 'id/name/color/side invalid')
      else teamIds.add(t.id)
    })

  const playerIds = new Set<string>()
  if (!Array.isArray(d.players)) bad('players', 'not an array')
  else
    d.players.forEach((p, i) => {
      if (!isObj(p) || !isStr(p.id) || !isStr(p.teamId) || !isNum(p.number) || !isVec(p.home))
        bad(`players[${i}]`, 'id/teamId/number/home invalid')
      else {
        if (!teamIds.has(p.teamId)) bad(`players[${i}].teamId`, 'unknown team')
        if (playerIds.has(p.id)) bad(`players[${i}].id`, 'duplicate')
        playerIds.add(p.id)
      }
    })

  if (!isObj(d.ball) || !isStr(d.ball.id) || !isVec(d.ball.home)) bad('ball', 'id/home invalid')
  else if (d.ball.initialHolderId !== undefined && !playerIds.has(String(d.ball.initialHolderId)))
    bad('ball.initialHolderId', 'unknown player')
  const ballId = isObj(d.ball) && isStr(d.ball.id) ? d.ball.id : 'ball'

  if (!Array.isArray(d.drawings)) bad('drawings', 'not an array')
  else
    d.drawings.forEach((dr, i) => {
      if (!isObj(dr) || !isStr(dr.id) || !isStr(dr.kind))
        return bad(`drawings[${i}]`, 'id/kind missing')
      switch (dr.kind) {
        case 'arrow':
          if (!isVec(dr.from) || !isVec(dr.to)) bad(`drawings[${i}]`, 'arrow from/to')
          break
        case 'text':
          if (!isVec(dr.at) || typeof dr.text !== 'string') bad(`drawings[${i}]`, 'text at/text')
          break
        case 'line':
        case 'freehand':
          if (!Array.isArray(dr.points) || !dr.points.every(isVec)) bad(`drawings[${i}]`, 'points')
          else if (
            dr.kind === 'freehand' &&
            dr.pressures !== undefined &&
            (!Array.isArray(dr.pressures) ||
              !dr.pressures.every(isNum) ||
              dr.pressures.length !== dr.points.length)
          )
            bad(`drawings[${i}].pressures`, 'must be numbers, one per point')
          break
        case 'zone': {
          const sh = dr.shape
          if (!isObj(sh)) bad(`drawings[${i}]`, 'zone shape')
          else if (
            sh.type === 'rect'
              ? !(isVec(sh.at) && isVec(sh.size))
              : sh.type === 'ellipse'
                ? !(isVec(sh.center) && isVec(sh.radius))
                : sh.type === 'polygon'
                  ? !(Array.isArray(sh.points) && sh.points.every(isVec))
                  : true
          )
            bad(`drawings[${i}]`, 'zone shape fields')
          break
        }
        default:
          bad(`drawings[${i}]`, `unknown kind ${String(dr.kind)}`)
      }
    })

  if (!Array.isArray(d.scenes) || d.scenes.length === 0) bad('scenes', 'need at least one scene')
  else
    d.scenes.forEach((sc, si) => {
      const P = `scenes[${si}]`
      if (!isObj(sc) || !isStr(sc.id) || !isObj(sc.timeline)) return bad(P, 'id/timeline missing')
      const tl = sc.timeline
      if (!Array.isArray(tl.tracks)) return bad(`${P}.timeline.tracks`, 'not an array')
      const segIds = new Set<string>()
      tl.tracks.forEach((tr, ti) => {
        const TP = `${P}.tracks[${ti}]`
        if (
          !isObj(tr) ||
          !isStr(tr.id) ||
          !isStr(tr.entityId) ||
          (tr.entityKind !== 'player' && tr.entityKind !== 'ball')
        )
          return bad(TP, 'id/entityId/entityKind invalid')
        if (tr.entityKind === 'player' && !playerIds.has(tr.entityId))
          bad(`${TP}.entityId`, 'unknown player')
        if (tr.entityKind === 'ball' && tr.entityId !== ballId)
          bad(`${TP}.entityId`, 'ball id mismatch')
        if (!Array.isArray(tr.segments)) return bad(`${TP}.segments`, 'not an array')
        tr.segments.forEach((sg, gi) => {
          const SP = `${TP}.segments[${gi}]`
          if (
            !isObj(sg) ||
            !isStr(sg.id) ||
            !isStr(sg.kind) ||
            !isObj(sg.trigger) ||
            !isObj(sg.timing)
          )
            return bad(SP, 'id/kind/trigger/timing missing')
          if (segIds.has(sg.id)) bad(`${SP}.id`, 'duplicate')
          segIds.add(sg.id)
          const tg = sg.trigger
          if (!isStr(tg.type)) bad(`${SP}.trigger`, 'type missing')
          else if (tg.type === 'at' ? !isNum(tg.t) : !isNum(tg.offset))
            bad(`${SP}.trigger`, 'time/offset must be number')
          const tm = sg.timing
          if (!(isNum(tm.duration) || isNum(tm.speed)))
            bad(`${SP}.timing`, 'duration or speed required')
          if (tm.decel !== undefined && !isNum(tm.decel))
            bad(`${SP}.timing.decel`, 'must be number')
          if (sg.step !== undefined && !isNum(sg.step)) bad(`${SP}.step`, 'must be number')
          const kind = sg.kind
          if (kind === 'move' || kind === 'travel') {
            const path = sg.path
            const wpOk = (w: unknown): boolean =>
              isObj(w) &&
              isStr(w.id) &&
              isVec(w.p) &&
              (w.handleIn === undefined || isVec(w.handleIn)) &&
              (w.handleOut === undefined || isVec(w.handleOut)) &&
              (w.hold === undefined || (isNum(w.hold) && w.hold >= 0))
            if (
              !isObj(path) ||
              !Array.isArray(path.waypoints) ||
              path.waypoints.length < 1 ||
              !path.waypoints.every(wpOk)
            )
              bad(`${SP}.path`, 'waypoints invalid (p/handles/hold)')
          }
          if (kind === 'move' && sg.carryEnd !== undefined && !isVec(sg.carryEnd))
            bad(`${SP}.carryEnd`, 'must be a vector')
          if (kind === 'possessed') {
            if (!isStr(sg.holderId)) bad(`${SP}.holderId`, 'missing')
            else if (!playerIds.has(sg.holderId)) bad(`${SP}.holderId`, 'unknown player')
            if (sg.offset !== undefined && !isVec(sg.offset))
              bad(`${SP}.offset`, 'must be a vector')
            if (sg.offsetLocked !== undefined && typeof sg.offsetLocked !== 'boolean')
              bad(`${SP}.offsetLocked`, 'must be boolean')
          }
          if (kind === 'travel') {
            if (!isStr(sg.travelKind)) bad(`${SP}.travelKind`, 'missing')
            if (
              sg.receiverId !== undefined &&
              !(isStr(sg.receiverId) && playerIds.has(sg.receiverId))
            )
              bad(`${SP}.receiverId`, 'unknown player')
            if (sg.target !== undefined) {
              const tgt = sg.target as Record<string, unknown>
              if (!isObj(tgt) || !(isStr(tgt.entityId) && playerIds.has(tgt.entityId)))
                bad(`${SP}.target.entityId`, 'unknown player')
              else if (!isNum(tgt.step)) bad(`${SP}.target.step`, 'must be a number')
            }
          }
          if (!['move', 'hold', 'possessed', 'travel', 'loose'].includes(kind))
            bad(`${SP}.kind`, `unknown ${kind}`)
        })
      })
      if (tl.markers !== undefined && !Array.isArray(tl.markers))
        bad(`${P}.timeline.markers`, 'not an array')
    })
  return errs
}
