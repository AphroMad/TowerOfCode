import type { IChallenge } from '@/challenges/IChallenge'
import { MultipleChoiceChallenge } from '@/challenges/MultipleChoiceChallenge'

type ChallengeConstructor = new () => IChallenge

const registry = new Map<string, ChallengeConstructor>()

registry.set('multiple-choice', MultipleChoiceChallenge)

export function createChallenge(type: string): IChallenge {
  const Ctor = registry.get(type)
  if (!Ctor) throw new Error(`Unknown challenge type: ${type}`)
  return new Ctor()
}
