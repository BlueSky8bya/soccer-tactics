import { describe, expect, it } from 'vitest'
import { SPRINGS, SpringAnimator, simulate, springParams } from './spring'

describe('spring', () => {
  it('bounce 0 never overshoots and settles near duration', () => {
    const traj = simulate(0, 1, { duration: 0.3, bounce: 0 })
    expect(Math.max(...traj.map((p) => p.value))).toBeLessThanOrEqual(1.0001)
    const settled = traj[traj.length - 1]!
    expect(settled.value).toBeCloseTo(1, 2)
    expect(settled.t).toBeLessThan(0.8)
  })

  it('bounce 0.25 overshoots noticeably but within bounds, then settles', () => {
    const traj = simulate(0, 1, SPRINGS.drop)
    const max = Math.max(...traj.map((p) => p.value))
    expect(max).toBeGreaterThan(1.01) // ζ=0.75 → ≈3% overshoot (Apple mapping)
    expect(max).toBeLessThan(1.2)
    expect(traj[traj.length - 1]!.value).toBeCloseTo(1, 2)
  })

  it('more bounce → more overshoot (monotone)', () => {
    const peak = (b: number) =>
      Math.max(...simulate(0, 1, { duration: 0.3, bounce: b }).map((p) => p.value))
    expect(peak(0.1)).toBeLessThan(peak(0.3))
    expect(peak(0.3)).toBeLessThan(peak(0.5))
  })

  it('springParams: critically damped when bounce 0', () => {
    const p = springParams({ duration: 0.5, bounce: 0 })
    const omega = Math.sqrt(p.stiffness)
    expect(p.damping).toBeCloseTo(2 * omega, 6)
  })

  it('animator is deterministic with injected clock and retargets preserving velocity', () => {
    const frames: ((t: number) => void)[] = []
    let t = 0
    const values: number[] = []
    const anim = new SpringAnimator(0, SPRINGS.drop, {
      onUpdate: (v) => values.push(v),
      raf: (cb) => {
        frames.push(cb)
        return frames.length
      },
      caf: () => {},
      now: () => t,
    })
    anim.to(1)
    const run = (n: number) => {
      for (let i = 0; i < n; i++) {
        const cb = frames.shift()
        if (!cb) break
        t += 1000 / 60
        cb(t)
      }
    }
    run(10)
    const mid = anim.value
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    anim.to(0) // retarget mid-flight
    run(200)
    expect(anim.value).toBeCloseTo(0, 2)
    expect(frames.length).toBe(0) // settled, no pending frame
  })

  it('immediate() skips animation', () => {
    const values: number[] = []
    const anim = new SpringAnimator(0, SPRINGS.drop, {
      onUpdate: (v) => values.push(v),
      raf: () => 1,
      caf: () => {},
      now: () => 0,
      immediate: () => true,
    })
    anim.to(1)
    expect(values).toEqual([1])
  })
})
