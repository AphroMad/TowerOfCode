import type { IChallenge } from '@/challenges/IChallenge'
import { ClExplanationChallenge } from '@/challenges/ClExplanationChallenge'
import { ClMultipleChoiceChallenge } from '@/challenges/ClMultipleChoiceChallenge'
import { ClFillInTextChallenge } from '@/challenges/ClFillInTextChallenge'
import { ClMatchingPairsChallenge } from '@/challenges/ClMatchingPairsChallenge'
import { ClChallengeChallenge } from '@/challenges/ClChallengeChallenge'

type ChallengeConstructor = new () => IChallenge

const registry = new Map<string, ChallengeConstructor>()

registry.set('explanation', ClExplanationChallenge)
registry.set('multiple_choice', ClMultipleChoiceChallenge)
registry.set('fill_in_text', ClFillInTextChallenge)
registry.set('matching_pairs', ClMatchingPairsChallenge)
registry.set('challenge', ClChallengeChallenge)

export function createChallenge(type: string): IChallenge {
  const Ctor = registry.get(type)
  if (!Ctor) throw new Error(`Unknown challenge type: ${type}`)
  return new Ctor()
}
