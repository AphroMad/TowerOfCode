import Phaser from 'phaser'
import type { Direction, NPCData } from '@/data/types'
import { tileToPixel } from '@/utils/helpers'

// Same 4x4 layout as player: row 0=down, 1=left, 2=right, 3=up
const DIR_ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 }

export class NPC {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly data: NPCData
  facing: Direction

  constructor(scene: Phaser.Scene, npcData: NPCData) {
    this.data = npcData
    this.facing = npcData.facing

    const row = DIR_ROW[npcData.facing]
    this.sprite = scene.add.sprite(
      tileToPixel(npcData.tileX),
      tileToPixel(npcData.tileY),
      npcData.spriteKey,
      row * 4 // idle frame for this direction
    )
    this.sprite.setOrigin(0.5, 0.75)
    this.createAnimations(scene)
  }

  private createAnimations(scene: Phaser.Scene): void {
    const dirs: Direction[] = ['down', 'left', 'right', 'up']
    dirs.forEach(dir => {
      const row = DIR_ROW[dir]
      const base = row * 4
      const key = `${this.data.id}-idle-${dir}`
      if (!scene.anims.exists(key)) {
        scene.anims.create({
          key,
          frames: [{ key: this.data.spriteKey, frame: base }],
          frameRate: 1,
        })
      }
    })
  }

  faceDirection(dir: Direction): void {
    this.facing = dir
    this.sprite.play(`${this.data.id}-idle-${dir}`, true)
  }

  facePlayer(playerTileX: number, playerTileY: number): void {
    const dx = playerTileX - this.data.tileX
    const dy = playerTileY - this.data.tileY

    if (Math.abs(dx) > Math.abs(dy)) {
      this.faceDirection(dx > 0 ? 'right' : 'left')
    } else {
      this.faceDirection(dy > 0 ? 'down' : 'up')
    }
  }
}
