import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { I18nManager } from '@/i18n/I18nManager'
import { getFloorById } from '@/data/floors/FloorRegistry'
import { tileToPixel } from '@/utils/helpers'
import type { GridMovementSystem } from '@/systems/GridMovementSystem'
import type { Direction, FloorData } from '@/data/types'

export class WarpManager {
  private scene: Phaser.Scene
  private gridMovement: GridMovementSystem
  private floor: FloorData
  private player: Player
  private sparkleEmitter: Phaser.GameObjects.Particles.ParticleEmitter
  isTransitioning = false
  private lastTeleportId: string | null = null

  constructor(
    scene: Phaser.Scene,
    gridMovement: GridMovementSystem,
    floor: FloorData,
    player: Player,
  ) {
    this.scene = scene
    this.gridMovement = gridMovement
    this.floor = floor
    this.player = player

    // Generate sparkle texture (tiny diamond shape)
    if (!scene.textures.exists('sparkle')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 }, false)
      gfx.fillStyle(0xffffff, 1)
      gfx.fillRect(2, 0, 2, 6)
      gfx.fillRect(0, 2, 6, 2)
      gfx.generateTexture('sparkle', 6, 6)
      gfx.destroy()
    }

    this.sparkleEmitter = scene.add.particles(0, 0, 'sparkle', {
      speed: { min: 30, max: 80 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      tint: [0xaa66ff, 0xcc88ff, 0xeeddff],
      emitting: false,
      quantity: 12,
    })
    this.sparkleEmitter.setDepth(9999)
  }

  check(): void {
    const playerTile = this.gridMovement.getPlayerTile()

    // Intra-map teleport (senders only)
    const teleport = this.floor.teleports?.find(
      t => t.role === 'sender' && t.tileX === playerTile.x && t.tileY === playerTile.y
    )
    if (teleport) {
      if (this.lastTeleportId === teleport.id) return

      const target = teleport.targetId
        ? this.floor.teleports?.find(t => t.id === teleport.targetId)
        : undefined
      if (target) {
        this.isTransitioning = true
        this.gridMovement.freeze()
        // Sparkle burst at departure
        this.sparkleEmitter.emitParticleAt(this.player.sprite.x, this.player.sprite.y)
        this.player.sprite.x = tileToPixel(target.tileX)
        this.player.sprite.y = tileToPixel(target.tileY)
        // Sparkle burst at arrival
        this.sparkleEmitter.emitParticleAt(this.player.sprite.x, this.player.sprite.y)
        this.lastTeleportId = target.id
        this.isTransitioning = false
        this.gridMovement.unfreeze()
      }
      return
    }

    // Clear step-off guard when player leaves any teleport tile
    if (this.lastTeleportId) {
      const stillOnTeleport = this.floor.teleports?.some(
        t => t.tileX === playerTile.x && t.tileY === playerTile.y
      )
      if (!stillOnTeleport) this.lastTeleportId = null
    }

    // Floor warp
    const stair = this.floor.stairs.find(
      s => s.tileX === playerTile.x && s.tileY === playerTile.y
    )
    if (!stair) return

    const i18n = I18nManager.getInstance()

    if (stair.targetFloorId === null) {
      this.isTransitioning = true
      this.gridMovement.freeze()
      this.showToast(i18n.t('stairs_coming_soon'))
      return
    }

    const fromDirection = stair.tileY < this.floor.playerStart.tileY ? 'up' : 'down'

    this.isTransitioning = true
    this.gridMovement.freeze()
    this.sparkleEmitter.emitParticleAt(this.player.sprite.x, this.player.sprite.y)
    const targetFloor = getFloorById(stair.targetFloorId)
    const floorNameKey = `${stair.targetFloorId.replace('-', '_')}_name`
    this.scene.scene.launch('TransitionScene', {
      floorId: stair.targetFloorId,
      floorName: targetFloor ? i18n.t(floorNameKey) : stair.targetFloorId,
      fromDirection,
      fromFloorId: this.floor.id,
    })
  }

  private showToast(message: string): void {
    const toast = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.height - 40,
      message,
      {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 6 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200)

    this.scene.time.delayedCall(2000, () => {
      this.scene.tweens.add({
        targets: toast,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          toast.destroy()
          this.isTransitioning = false
          this.gridMovement.unfreeze()
        },
      })
    })
  }

  static resolveSpawn(
    floor: FloorData,
    fromDirection?: 'up' | 'down',
    fromFloorId?: string,
  ): { tileX: number; tileY: number; facing: Direction } {
    if (fromDirection === 'down' && fromFloorId) {
      const stair = floor.stairs.find(s => s.targetFloorId === fromFloorId)
      if (stair) {
        return { tileX: stair.tileX, tileY: stair.tileY + 1, facing: 'down' }
      }
    }
    return floor.playerStart
  }
}
