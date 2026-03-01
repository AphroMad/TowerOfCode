import type { ChallengeConfig } from '@/data/types'

import lessonVariables from './exercises/lesson-variables.json'
import whatIsVariable from './exercises/what-is-variable.json'
import fillVariableName from './exercises/fill-variable-name.json'
import chooseVariableValue from './exercises/choose-variable-value.json'
import orderVariableCode from './exercises/order-variable-code.json'
import matchTypes from './exercises/match-types.json'
import writeAgeVariable from './exercises/write-age-variable.json'

const allChallenges = new Map<string, ChallengeConfig>()

const exercises: ChallengeConfig[] = [
  lessonVariables as ChallengeConfig,
  whatIsVariable as ChallengeConfig,
  fillVariableName as ChallengeConfig,
  chooseVariableValue as ChallengeConfig,
  orderVariableCode as ChallengeConfig,
  matchTypes as ChallengeConfig,
  writeAgeVariable as ChallengeConfig,
]

for (const c of exercises) allChallenges.set(c.id, c)

export function getChallenge(id: string): ChallengeConfig | undefined {
  return allChallenges.get(id)
}

export function getAllChallenges(): ChallengeConfig[] {
  return exercises
}
