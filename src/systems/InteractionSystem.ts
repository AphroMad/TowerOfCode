import Phaser from 'phaser'
import type { NPC } from '@/entities/NPC'
import { GridMovementSystem } from '@/systems/GridMovementSystem'

export class InteractionSystem {
  private scene: Phaser.Scene
  private npcs: NPC[]
  private gridMovement: GridMovementSystem
  private actionKey: Phaser.Input.Keyboard.Key
  private canInteract = true

  constructor(
    scene: Phaser.Scene,
    npcs: NPC[],
    gridMovement: GridMovementSystem,
  ) {
    this.scene = scene
    this.npcs = npcs
    this.gridMovement = gridMovement
    this.actionKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.actionKey) && this.canInteract) {
      this.tryInteract()
    }
  }

  setEnabled(enabled: boolean): void {
    this.canInteract = enabled
  }

  private tryInteract(): void {
    if (this.gridMovement.moving) return

    const facingTile = this.gridMovement.getFacingTile()
    const npc = this.findNPCAt(facingTile.x, facingTile.y)

    if (npc) {
      npc.facePlayer(
        facingTile.x - (facingTile.x - npc.data.tileX),
        facingTile.y - (facingTile.y - npc.data.tileY)
      )
      this.scene.events.emit('npc-interact', npc)
    }
  }

  private findNPCAt(tileX: number, tileY: number): NPC | null {
    return this.npcs.find(
      npc => npc.data.tileX === tileX && npc.data.tileY === tileY
    ) ?? null
  }
}
