import { describe, expect, it } from 'vitest'
import { parseHealth, stepsCommitment, workoutCommitment } from './health'
import { CONTRACT_PRESETS } from './presets'
import type { Commitment } from './types'

describe('parseHealth', () => {
  it('reads steps and sums workouts per day', () => {
    const parsed = parseHealth('COLDARC\nS 2026-10-01 8,123\nS 2026-10-02 10432.5\nW 2026-10-01 34\nW 2026-10-01 12\n')
    expect(parsed?.steps.get('2026-10-01')).toBe(8123)
    expect(parsed?.steps.get('2026-10-02')).toBe(10432.5)
    expect(parsed?.workoutMinutes.get('2026-10-01')).toBe(46)
  })

  it('reads a workout length the same whichever way round the dates were', () => {
    expect(parseHealth('COLDARC\nW 2026-10-01 -34')?.workoutMinutes.get('2026-10-01')).toBe(34)
  })

  it('rejects clipboard text that did not come from the shortcut', () => {
    expect(parseHealth('hello')).toBeNull()
    expect(parseHealth('')).toBeNull()
  })

  it('skips lines it cannot understand', () => {
    const parsed = parseHealth('coldarc\r\nS yesterday 500\nX 2026-10-01 3\nS 2026-10-03 abc\nS 2026-10-04 900')
    expect([...parsed!.steps.entries()]).toEqual([['2026-10-04', 900]])
  })
})

describe('matching commitments', () => {
  const asCommitments = (id: string) =>
    CONTRACT_PRESETS.find((p) => p.id === id)!.commitments.map(
      (c, i): Commitment => ({ ...c, id: `c${i}`, arcId: 'a', order: i, archivedAt: null }),
    )

  it('finds steps and workout in the Cut & Study contract', () => {
    const cs = asCommitments('cut-and-study')
    expect(stepsCommitment(cs)?.label).toBe('Steps')
    expect(workoutCommitment(cs)?.label).toBe('Workout')
  })

  it('finds a yes/no training habit too', () => {
    expect(workoutCommitment(asCommitments('winter-arc'))?.label).toBe('Train')
  })
})
