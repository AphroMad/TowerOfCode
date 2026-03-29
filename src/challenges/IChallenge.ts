import type { ChallengeConfig } from '@/data/types'

export interface IChallenge {
  create(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void): void
  createInPanel(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void, panel: HTMLDivElement): void
  update(): void
  destroy(): void
  softDestroy(): void
  getPanel(): HTMLDivElement | null
}
