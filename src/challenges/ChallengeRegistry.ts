import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig } from '@/data/types'
import { ClExplanationChallenge } from '@/challenges/ClExplanationChallenge'
import { ClMultipleChoiceChallenge } from '@/challenges/ClMultipleChoiceChallenge'
import { ClFillInTextChallenge } from '@/challenges/ClFillInTextChallenge'
import { ClMatchingPairsChallenge } from '@/challenges/ClMatchingPairsChallenge'
import { ClCodeChallenge } from '@/challenges/ClCodeChallenge'

type ChallengeConstructor = new () => IChallenge

const registry = new Map<string, ChallengeConstructor>()

registry.set('explanation', ClExplanationChallenge)
registry.set('multiple_choice', ClMultipleChoiceChallenge)
registry.set('fill_in_text', ClFillInTextChallenge)
registry.set('matching_pairs', ClMatchingPairsChallenge)
registry.set('challenge', ClCodeChallenge)

/** Validate that a challenge config has the required fields for its type. */
function validateConfig(config: ChallengeConfig): void {
  if (!config.id) console.warn('Challenge missing id')
  if (!config.title) console.warn(`Challenge "${config.id}" missing title`)
  if (!config.content) {
    console.warn(`Challenge "${config.id}" missing content`)
    return
  }
  if (!('question' in config.content) || !config.content.question) {
    console.warn(`Challenge "${config.id}" missing content.question`)
  }
  switch (config.type) {
    case 'multiple_choice':
      if (!config.content.exercise?.options?.length) console.warn(`Challenge "${config.id}" (multiple_choice) missing options`)
      if (config.content.exercise?.correctAnswer === undefined) console.warn(`Challenge "${config.id}" (multiple_choice) missing correctAnswer`)
      break
    case 'fill_in_text':
      if (!config.content.exercise?.text) console.warn(`Challenge "${config.id}" (fill_in_text) missing exercise.text`)
      break
    case 'matching_pairs':
      if (!config.content.exercise?.pairs?.length) console.warn(`Challenge "${config.id}" (matching_pairs) missing exercise.pairs`)
      break
  }
}

export function createChallenge(type: string, config?: ChallengeConfig): IChallenge {
  if (config) validateConfig(config)
  const Ctor = registry.get(type)
  if (!Ctor) throw new Error(`Unknown challenge type: ${type}`)
  return new Ctor()
}
