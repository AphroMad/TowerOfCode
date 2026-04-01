import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { TILE_SIZE, PLAYER_MOVE_SPEED } from '@/config/game.config'
import { tileToPixel, DIR_OFFSETS } from '@/utils/helpers'
import { ensureDustTexture } from '@/utils/AnimationFactory'
import { TileChecker } from '@/systems/TileChecker'
import type { Direction, TileEffectData } from '@/data/types'

export class GridMovementSystem {
  private player: Player
  private scene: Phaser.Scene
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private isMoving = false
  private isFrozen = false
  readonly tiles: TileChecker
  private lastDirection: Direction = 'down'
  private isSliding = false
  private pushBlockCallback: ((blockTileX: number, blockTileY: number, dir: Direction) => boolean) | null = null
  private moveCompleteCallback: ((fromX: number, fromY: number, toX: number, toY: number, dir: Direction) => void) | null = null
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter

  constructor(
    scene: Phaser.Scene,
    player: Player,
    wallLayer: Phaser.Tilemaps.TilemapLayer,
  ) {
    this.scene = scene
    this.player = player
    this.tiles = new TileChecker(wallLayer)
    this.cursors = scene.input.keyboard!.createCursorKeys()

    ensureDustTexture(scene)

    this.dustEmitter = scene.add.particles(0, 0, 'dust', {
      speed: { min: 8, max: 20 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 300,
      tint: 0xc8b896,
      emitting: false,
      quantity: 3,
    })
    this.dustEmitter.setDepth(9999)
  }

  // Delegate tile operations to TileChecker
  blockTile(tileX: number, tileY: number): void { this.tiles.blockTile(tileX, tileY) }
  unblockTile(tileX: number, tileY: number): void { this.tiles.unblockTile(tileX, tileY) }
  setPassableWalls(tiles: Set<string>): void { this.tiles.setPassableWalls(tiles) }
  setTileEffects(effects: TileEffectData[]): void { this.tiles.setTileEffects(effects) }
  removeTileEffect(tileX: number, tileY: number): void { this.tiles.removeTileEffect(tileX, tileY) }
  isWallAt(tileX: number, tileY: number): boolean { return this.tiles.isWallAt(tileX, tileY) }
  isBlocked(tileX: number, tileY: number): boolean { return this.tiles.isTileBlocked(tileX, tileY) }
  get mapWidth(): number { return this.tiles.mapWidth }
  get mapHeight(): number { return this.tiles.mapHeight }

  setPushBlockCallback(cb: (blockTileX: number, blockTileY: number, dir: Direction) => boolean): void {
    this.pushBlockCallback = cb
  }

  onMoveComplete(cb: (fromX: number, fromY: number, toX: number, toY: number, dir: Direction) => void): void {
    this.moveCompleteCallback = cb
  }

  get moving(): boolean {
    return this.isMoving
  }

  get sliding(): boolean {
    return this.isSliding
  }

  freeze(): void {
    this.isFrozen = true
  }

  unfreeze(): void {
    this.isFrozen = false
  }

  /** Returns a promise that resolves once any in-progress move finishes */
  waitForMove(): Promise<void> {
    if (!this.isMoving) return Promise.resolve()
    return new Promise(resolve => {
      const check = () => {
        if (!this.isMoving) resolve()
        else this.scene.time.delayedCall(16, check)
      }
      check()
    })
  }

  get frozen(): boolean {
    return this.isFrozen
  }

  update(): void {
    if (this.isMoving || this.isFrozen) return

    let dir: Direction | null = null

    if (this.cursors.down.isDown) dir = 'down'
    else if (this.cursors.up.isDown) dir = 'up'
    else if (this.cursors.left.isDown) dir = 'left'
    else if (this.cursors.right.isDown) dir = 'right'

    if (dir === null) {
      this.player.playIdle()
      return
    }

    this.player.facing = dir
    this.executeMove(dir)
  }

  private executeMove(dir: Direction): void {
    const off = DIR_OFFSETS[dir]
    const targetTileX = this.player.tileX + off.x
    const targetTileY = this.player.tileY + off.y

    const targetKey = `${targetTileX},${targetTileY}`
    const isBlockedTile = this.tiles.isBlockedTile(targetKey)
    const targetEffect = this.tiles.getEffect(targetTileX, targetTileY)
    const isHole = targetEffect?.effect === 'hole'

    if (isBlockedTile && this.pushBlockCallback) {
      const pushed = this.pushBlockCallback(targetTileX, targetTileY, dir)
      if (!pushed) {
        this.isSliding = false
        this.isMoving = false
        this.player.playIdle()
        return
      }
    } else if (isHole || this.tiles.isTileBlocked(targetTileX, targetTileY, dir)) {
      this.isSliding = false
      this.isMoving = false
      this.player.playIdle()
      return
    }

    const fromX = this.player.tileX
    const fromY = this.player.tileY

    this.isMoving = true
    this.lastDirection = dir
    this.player.facing = dir
    if (!this.isSliding) {
      this.player.playWalk(dir)
      this.dustEmitter.emitParticleAt(this.player.sprite.x, this.player.sprite.y)
    } else {
      this.player.playIdle()
    }

    const targetX = tileToPixel(targetTileX)
    const targetY = tileToPixel(targetTileY)
    const duration = (TILE_SIZE / PLAYER_MOVE_SPEED) * 1000

    this.scene.tweens.add({
      targets: this.player.sprite,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Linear',
      onComplete: () => {
        this.moveCompleteCallback?.(fromX, fromY, targetTileX, targetTileY, dir)
        this.processLandingEffect()
      },
    })
  }

  private processLandingEffect(): void {
    if (this.isFrozen) {
      this.isSliding = false
      this.isMoving = false
      return
    }

    const effect = this.tiles.getEffect(this.player.tileX, this.player.tileY)

    if (effect?.effect === 'ice') {
      this.isSliding = true
      this.executeMove(this.lastDirection)
      return
    }

    if (effect?.effect === 'redirect' && effect.direction) {
      this.isSliding = true
      this.executeMove(effect.direction)
      return
    }

    this.isSliding = false
    this.isMoving = false
  }

  getPlayerTile(): { x: number; y: number } {
    return { x: this.player.tileX, y: this.player.tileY }
  }

  getFacingTile(): { x: number; y: number } {
    const off = DIR_OFFSETS[this.player.facing]
    return {
      x: this.player.tileX + off.x,
      y: this.player.tileY + off.y,
    }
  }
}
