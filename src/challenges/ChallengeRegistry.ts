import type { IChallenge } from '@/challenges/IChallenge'
import { ClExplanationChallenge } from '@/challenges/ClExplanationChallenge'
import { ClMultipleChoiceChallenge } from '@/challenges/ClMultipleChoiceChallenge'
import { ClFillInTextChallenge } from '@/challenges/ClFillInTextChallenge'
import { ClMatchingPairsChallenge } from '@/challenges/ClMatchingPairsChallenge'
import { ClChallengeChallenge } from '@/challenges/ClChallengeChallenge'

type ChallengeConstructor = new () => IChallenge

const registry = new Map<string, ChallengeConstructor>()

registry.set('cl-explanation', ClExplanationChallenge)
registry.set('cl-multiple-choice', ClMultipleChoiceChallenge)
registry.set('cl-fill-in-text', ClFillInTextChallenge)
registry.set('cl-matching-pairs', ClMatchingPairsChallenge)
registry.set('cl-challenge', ClChallengeChallenge)

export function createChallenge(type: string): IChallenge {
  const Ctor = registry.get(type)
  if (!Ctor) throw new Error(`Unknown challenge type: ${type}`)
  return new Ctor()
}
