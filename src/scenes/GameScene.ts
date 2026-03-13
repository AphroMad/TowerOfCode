import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { NPC } from '@/entities/NPC'
import { GridMovementSystem } from '@/systems/GridMovementSystem'
import { InteractionSystem } from '@/systems/InteractionSystem'
import { NpcBehaviorSystem } from '@/systems/NpcBehaviorSystem'
import { SaveManager } from '@/systems/SaveManager'
import { getFloorById } from '@/data/floors/FloorRegistry'
import { I18nManager } from '@/i18n/I18nManager'
import { getChallenge } from '@/data/challenges'
import { MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from '@/config/game.config'
import type { ChallengeConfig, Direction, FloorData } from '@/data/types'
import { buildTiledMapJson } from '@/utils/buildTiledMapJson'
import { tileToPixel } from '@/utils/helpers'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private npcs: NPC[] = []
  private gridMovement!: GridMovementSystem
  private interaction!: InteractionSystem
  private behaviorSystem!: NpcBehaviorSystem
  private wallLayer!: Phaser.Tilemaps.TilemapLayer
  private langHandler?: () => void
  private escKey?: Phaser.Input.Keyboard.Key
  private floor!: FloorData
  private isTransitioning = false
  private lastTeleportId: string | null = null // prevent re-trigger until player steps off

  constructor() {
    super({ key: 'GameScene' })
  }

  create(data?: { floorId?: string; fromDirection?: 'up' | 'down'; fromFloorId?: string; floorData?: FloorData }): void {
    this.isTransitioning = false
    this.lastTeleportId = null

    // Resolve floor: from direct data (test mode), then registry, then save, fallback
    const save = SaveManager.getInstance()
    const floorId = data?.floorId ?? save.getData().currentFloor
    const floor = data?.floorData ?? getFloorById(floorId) ?? getFloorById('floor-01')!
    this.floor = floor

    // Persist current floor (skip in test mode)
    if (!data?.floorData) save.setCurrentFloor(floor.id)

    // Build Tiled JSON from floor tile data and inject into cache
    const mapW = floor.width ?? MAP_WIDTH_TILES
    const mapH = floor.height ?? MAP_HEIGHT_TILES
    const mapJson = buildTiledMapJson(floor.groundLayer, floor.wallsLayer, mapW, mapH)
    this.cache.tilemap.add(floor.id, {
      data: mapJson,
      format: Phaser.Tilemaps.Formats.TILED_JSON,
    })

    const map = this.make.tilemap({ key: floor.id })
    // Dynamically bind all tilesets referenced in the JSON
    const tilesets: Phaser.Tilemaps.Tileset[] = []
    for (const tsData of map.tilesets) {
      // tileset name in JSON matches the Phaser cache key (tile registry key)
      const ts = map.addTilesetImage(tsData.name, tsData.name)
      if (ts) tilesets.push(ts)
    }

    // Ground layer
    map.createLayer('Ground', tilesets, 0, 0)

    // Walls layer (collision)
    this.wallLayer = map.createLayer('Walls', tilesets, 0, 0)!

    // Determine player spawn: near the arrival stair, or default playerStart
    const spawn = this.resolveSpawn(floor, data?.fromDirection, data?.fromFloorId)
    this.player = new Player(this, spawn.tileX, spawn.tileY)
    this.player.facing = spawn.facing

    // Grid movement
    this.gridMovement = new GridMovementSystem(this, this.player, this.wallLayer)
    if (floor.tileEffects?.length) {
      this.gridMovement.setTileEffects(floor.tileEffects)
    }

    // Non-collision wall tiles (passable overrides)
    if (floor.wallsCollision) {
      const passableWalls = new Set<string>()
      for (let i = 0; i < floor.wallsLayer.length; i++) {
        if (floor.wallsLayer[i] !== '' && !floor.wallsCollision[i]) {
          passableWalls.add(`${i % mapW},${Math.floor(i / mapW)}`)
        }
      }
      if (passableWalls.size > 0) this.gridMovement.setPassableWalls(passableWalls)
    }

    // NPCs
    this.npcs = floor.npcs.map(npcData => {
      const npc = new NPC(this, npcData)
      this.gridMovement.blockTile(npcData.tileX, npcData.tileY)
      return npc
    })

    // Behavior system (detect, lookout, patrol)
    this.behaviorSystem = new NpcBehaviorSystem(this, this.npcs, this.gridMovement, this.player)

    // Interaction system
    this.interaction = new InteractionSystem(this, this.npcs, this.gridMovement, this.player)

    // Hide gatekeepers if floor is already complete
    this.updateGatekeepers()

    // NPC interaction handler
    this.events.on('npc-interact', (npc: NPC) => {
      // Prevent re-detection after dialog (both auto-detect and manual space press)
      this.behaviorSystem.markDetected(npc)
      this.handleNPCInteraction(npc)
    })

    // On resume (after dialog/challenge): flush stale keyboard state,
    // briefly block interactions, and re-check gatekeepers
    this.events.on('resume', () => {
      this.input.keyboard!.resetKeys()
      this.interaction.setEnabled(false)
      this.time.delayedCall(300, () => this.interaction.setEnabled(true))
      this.updateGatekeepers()
    })

    // Camera
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
    this.cameras.main.startFollow(this.player.sprite, true)
    this.cameras.main.setRoundPixels(true)

    // Floor title banner
    const i18n = I18nManager.getInstance()
    const floorNameKey = `${floor.id.replace('-', '_')}_name`
    const banner = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 40,
      i18n.t(floorNameKey),
      { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace', backgroundColor: '#000000aa', padding: { x: 12, y: 6 } }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100)

    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: banner,
        alpha: 0,
        duration: 500,
        onComplete: () => banner.destroy(),
      })
    })

    // ESC to return to menu
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escKey.on('down', () => this.scene.start('MenuScene'))

    // Restart scene when language is toggled via HTML button
    this.langHandler = () => this.scene.restart()
    window.addEventListener('toggle-language', this.langHandler)
    this.events.on('shutdown', () => {
      if (this.langHandler) {
        window.removeEventListener('toggle-language', this.langHandler)
        this.langHandler = undefined
      }
      if (this.escKey) {
        this.input.keyboard!.removeKey(this.escKey)
        this.escKey = undefined
      }
    })
  }

  update(_time: number, delta: number): void {
    if (this.gridMovement) {
      this.gridMovement.update()
    }
    if (this.interaction) {
      this.interaction.update()
    }
    if (this.behaviorSystem) {
      this.behaviorSystem.update(delta)
    }

    // Y-sort: sprites lower on screen render on top
    this.player.sprite.setDepth(this.player.sprite.y)
    for (const npc of this.npcs) {
      npc.sprite.setDepth(npc.sprite.y)
    }

    // Stair trigger: check when player stops on a stair tile
    if (!this.isTransitioning && !this.gridMovement.moving) {
      this.checkStairTrigger()
    }
  }

  private resolveSpawn(
    floor: FloorData,
    fromDirection?: 'up' | 'down',
    fromFloorId?: string,
  ): { tileX: number; tileY: number; facing: Direction } {
    if (fromDirection === 'down' && fromFloorId) {
      // Player went DOWN → spawn at the stair that links back to the source floor
      const stair = floor.stairs.find(s => s.targetFloorId === fromFloorId)
      if (stair) {
        return { tileX: stair.tileX, tileY: stair.tileY + 1, facing: 'down' }
      }
    }
    // Player went UP or default → spawn at playerStart
    return floor.playerStart
  }

  private checkStairTrigger(): void {
    const playerTile = this.gridMovement.getPlayerTile()

    // Intra-map teleport (senders only)
    const teleport = this.floor.teleports?.find(
      t => t.role === 'sender' && t.tileX === playerTile.x && t.tileY === playerTile.y
    )
    if (teleport) {
      // Step-off guard: don't re-trigger if player just landed here from another teleport
      if (this.lastTeleportId === teleport.id) return

      const target = teleport.targetId
        ? this.floor.teleports?.find(t => t.id === teleport.targetId)
        : undefined
      if (target) {
        this.isTransitioning = true
        this.gridMovement.freeze()
        this.player.sprite.x = tileToPixel(target.tileX)
        this.player.sprite.y = tileToPixel(target.tileY)
        this.lastTeleportId = target.id // mark landing tile
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

    // No target floor yet
    if (stair.targetFloorId === null) {
      this.isTransitioning = true
      this.gridMovement.freeze()
      this.showToast(i18n.t('stairs_coming_soon'))
      return
    }

    // Determine direction: stair above spawn → going up, below → going down
    const fromDirection = stair.tileY < this.floor.playerStart.tileY ? 'up' : 'down'

    // Transition to target floor
    this.isTransitioning = true
    this.gridMovement.freeze()
    const targetFloor = getFloorById(stair.targetFloorId)
    const floorNameKey = `${stair.targetFloorId.replace('-', '_')}_name`
    this.scene.launch('TransitionScene', {
      floorId: stair.targetFloorId,
      floorName: targetFloor ? i18n.t(floorNameKey) : stair.targetFloorId,
      fromDirection,
      fromFloorId: this.floor.id,
    })
  }

  private showToast(message: string): void {
    const toast = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.height - 40,
      message,
      {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 6 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200)

    this.time.delayedCall(2000, () => {
      this.tweens.add({
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

  private updateGatekeepers(): void {
    const save = SaveManager.getInstance()
    const allDone = this.floor.requiredChallenges.length > 0
      && this.floor.requiredChallenges.every(id => save.isChallengeCompleted(id))

    for (const npc of this.npcs) {
      if (npc.data.behavior !== 'gatekeeper') continue
      if (allDone && npc.sprite.visible) {
        npc.sprite.setVisible(false)
        this.gridMovement.unblockTile(npc.data.tileX, npc.data.tileY)
      }
    }
  }

  private handleNPCInteraction(npc: NPC): void {
    // Gatekeepers use a fixed dialog key
    const dialogKey = npc.data.behavior === 'gatekeeper'
      ? 'gatekeeper_blocked'
      : npc.data.dialogKey

    // Always resolve challenge config; flag if already completed
    let challengeConfig: ChallengeConfig | undefined
    let challengeCompleted = false
    const save = SaveManager.getInstance()
    if (npc.data.challengeId) {
      challengeConfig = getChallenge(npc.data.challengeId)
      challengeCompleted = save.isChallengeCompleted(npc.data.challengeId)
    }

    this.scene.pause()
    this.scene.launch('DialogScene', {
      dialogKey,
      npcName: npc.data.name,
      challengeConfig,
      challengeCompleted,
    })
  }
}
