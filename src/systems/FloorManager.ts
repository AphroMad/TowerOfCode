import type { FloorData } from '@/data/types'
import { SaveManager } from '@/systems/SaveManager'

export class FloorManager {
  private floor: FloorData
  private saveManager: SaveManager

  constructor(floor: FloorData) {
    this.floor = floor
    this.saveManager = SaveManager.getInstance()
  }

  /** Number of required challenges completed on this floor */
  get completedCount(): number {
    return this.floor.requiredChallenges.filter(
      id => this.saveManager.isChallengeCompleted(id)
    ).length
  }

  /** Total required challenges on this floor */
  get totalCount(): number {
    return this.floor.requiredChallenges.length
  }

  /** Whether all required challenges are done */
  isFloorComplete(): boolean {
    return this.totalCount > 0 && this.completedCount >= this.totalCount
  }

  /** Dialog key for the gatekeeper based on floor completion */
  getGatekeeperDialogKey(): string {
    return this.isFloorComplete() ? 'gatekeeper_pass' : 'gatekeeper_block'
  }
}
