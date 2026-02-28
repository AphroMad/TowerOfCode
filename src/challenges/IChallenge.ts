import type { ChallengeConfig } from '@/data/types'

export interface IChallenge {
  create(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void): void
  destroy(): void
}
