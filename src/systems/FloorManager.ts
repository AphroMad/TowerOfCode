import type { FloorData } from '@/data/types'
import { SaveManager } from '@/systems/SaveManager'

export class FloorManager {
  private floor: FloorData
  private saveManager: SaveManager

  constructor(floor: FloorData) {
    this.floor = floor
    this.saveManager = SaveManager.getInstance()
  }

  isFloorComplete(): boolean {
    return this.floor.requiredChallenges.every(
      id => this.saveManager.isChallengeCompleted(id)
    )
  }

  getGatekeeperDialogKey(): string {
    return this.isFloorComplete()
      ? 'gatekeeper_unlocked'
      : 'gatekeeper_blocked'
  }
}
