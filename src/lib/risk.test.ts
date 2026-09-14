/**
 * The scoring is plain arithmetic on purpose — somebody told they are « prudent » should be
 * able to count why — so these tests are mostly about the edges, and about the one property
 * that matters more than the bands: a half-filled questionnaire must not flatter anybody.
 */
import { describe, expect, it } from 'vitest'
import { RISK_MAX, RISK_QUESTIONS, isComplete, levelForAnswers, levelForScore, scoreAnswers } from './risk'

const all = (id: 'first' | 'last') =>
  Object.fromEntries(RISK_QUESTIONS.map((q) => [q.id, (id === 'first' ? q.answers[0] : q.answers[q.answers.length - 1])!.id]))

describe('the risk questionnaire', () => {
  it('asks four questions, each worth 0 to 2', () => {
    expect(RISK_QUESTIONS).toHaveLength(4)
    expect(RISK_MAX).toBe(8)
    for (const q of RISK_QUESTIONS) {
      expect(q.answers.map((a) => a.score)).toEqual([0, 1, 2])
      // Every question says why it is asked: an unexplained question about money reads as
      // a test, and someone who feels tested answers what they think is wanted.
      expect(q.why.length).toBeGreaterThan(20)
    }
  })

  it('places the most cautious answers as prudent and the boldest as dynamique', () => {
    expect(levelForAnswers(all('first'))).toBe('prudent')
    expect(levelForAnswers(all('last'))).toBe('dynamique')
  })

  it('puts the bands at a third and two thirds of the range', () => {
    expect(levelForScore(0)).toBe('prudent')
    expect(levelForScore(2)).toBe('prudent')
    expect(levelForScore(3)).toBe('equilibre')
    expect(levelForScore(5)).toBe('equilibre')
    expect(levelForScore(6)).toBe('dynamique')
    expect(levelForScore(8)).toBe('dynamique')
  })

  it('scores an unanswered question as zero, so a partial answer lands cautious', () => {
    const partial = { [RISK_QUESTIONS[0]!.id]: RISK_QUESTIONS[0]!.answers[2]!.id }
    expect(scoreAnswers(partial)).toBe(2)
    expect(levelForAnswers(partial)).toBe('prudent')
  })

  it('is complete only when every question has been answered', () => {
    expect(isComplete({})).toBe(false)
    expect(isComplete({ [RISK_QUESTIONS[0]!.id]: RISK_QUESTIONS[0]!.answers[0]!.id })).toBe(false)
    expect(isComplete(all('first'))).toBe(true)
  })

  it('ignores an answer id that belongs to no question', () => {
    expect(scoreAnswers({ ...all('last'), horizon: 'inventé' })).toBe(RISK_MAX - 2)
  })
})
