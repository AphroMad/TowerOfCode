import type { ChallengeConfig } from '@/data/types'

const modules = import.meta.glob('./clExercises/*.json', { eager: true }) as Record<
  string,
  { default: ChallengeConfig }
>

const allChallenges = new Map<string, ChallengeConfig>()
const exercises: ChallengeConfig[] = []

for (const mod of Object.values(modules)) {
  const config = mod.default
  exercises.push(config)
  allChallenges.set(config.id, config)
}

export function getChallenge(id: string): ChallengeConfig | undefined {
  return allChallenges.get(id)
}

export function getAllChallenges(): ChallengeConfig[] {
  return exercises
}

export function getAllChallengeIds(): string[] {
  return exercises.map(c => c.id)
}
