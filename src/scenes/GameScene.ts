import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { NPC } from '@/entities/NPC'
import { GridMovementSystem } from '@/systems/GridMovementSystem'
import { InteractionSystem } from '@/systems/InteractionSystem'
import { NpcBehaviorSystem } from '@/systems/NpcBehaviorSystem'
import { FloorManager } from '@/systems/FloorManager'
import { SaveManager } from '@/systems/SaveManager'
import { getFloorById } from '@/data/floors/FloorRegistry'
import { I18nManager } from '@/i18n/I18nManager'
import { getChallenge } from '@/data/challenges'
import type { ChallengeConfig, Direction, FloorData } from '@/data/types'
import { buildTiledMapJson } from '@/utils/buildTiledMapJson'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private npcs: NPC[] = []
  private gridMovement!: GridMovementSystem
  private interaction!: InteractionSystem
  private behaviorSystem!: NpcBehaviorSystem
  floorManager!: FloorManager
  private wallLayer!: Phaser.Tilemaps.TilemapLayer
  private langHandler?: () => void
  private escKey?: Phaser.Input.Keyboard.Key
  private floor!: FloorData
  private isTransitioning = false

  constructor() {
    super({ key: 'GameScene' })
  }

  create(data?: { floorId?: string; fromDirection?: 'up' | 'down'; fromFloorId?: string; floorData?: FloorData }): void {
    this.isTransitioning = false

    // Resolve floor: from direct data (test mode), then registry, then save, fallback
    const save = SaveManager.getInstance()
    const floorId = data?.floorId ?? save.getData().currentFloor
    const floor = data?.floorData ?? getFloorById(floorId) ?? getFloorById('floor-01')!
    this.floor = floor
    this.floorManager = new FloorManager(floor)

    // Persist current floor (skip in test mode)
    if (!data?.floorData) save.setCurrentFloor(floor.id)

    // Build Tiled JSON from floor tile data and inject into cache
    const mapJson = buildTiledMapJson(floor.groundLayer, floor.wallsLayer)
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

    // NPC interaction handler
    this.events.on('npc-interact', (npc: NPC) => {
      this.handleNPCInteraction(npc)
    })

    // On resume (after dialog/challenge): flush stale keyboard state and
    // briefly block interactions so the SPACE that closed dialog can't re-trigger
    this.events.on('resume', () => {
      this.input.keyboard!.resetKeys()
      this.interaction.setEnabled(false)
      this.time.delayedCall(300, () => this.interaction.setEnabled(true))
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
    const stair = this.floor.stairs.find(
      s => s.tileX === playerTile.x && s.tileY === playerTile.y
    )
    if (!stair) return

    const i18n = I18nManager.getInstance()

    // No target floor yet
    if (stair.targetFloorId === null) {
      this.isTransitioning = true
      this.showToast(i18n.t('stairs_coming_soon'))
      return
    }

    // Determine direction: stair above spawn → going up, below → going down
    const fromDirection = stair.tileY < this.floor.playerStart.tileY ? 'up' : 'down'

    // Transition to target floor
    this.isTransitioning = true
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
        },
      })
    })
  }

  private handleNPCInteraction(npc: NPC): void {
    const dialogKey = npc.data.dialogKey
    let challengeConfig: ChallengeConfig | undefined

    if (npc.data.challengeId) {
      challengeConfig = getChallenge(npc.data.challengeId)
    }

    this.scene.pause()
    this.scene.launch('DialogScene', {
      dialogKey,
      npcName: npc.data.name,
      challengeConfig,
    })
  }
}
