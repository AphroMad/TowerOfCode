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
import type { ChallengeConfig, FloorData } from '@/data/types'
import { buildTiledMapJson } from '@/utils/buildTiledMapJson'
import { AnimatedTileSystem } from '@/systems/AnimatedTileSystem'
import { HpManager } from '@/systems/HpManager'
import { HeartHud } from '@/ui/HeartHud'
import { BlockManager } from './managers/BlockManager'
import { HeartPickupManager } from './managers/HeartPickupManager'
import { WarpManager } from './managers/WarpManager'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private npcs: NPC[] = []
  private gridMovement!: GridMovementSystem
  private interaction!: InteractionSystem
  private behaviorSystem!: NpcBehaviorSystem
  private wallLayer!: Phaser.Tilemaps.TilemapLayer
  private animatedTiles?: AnimatedTileSystem
  private blockManager!: BlockManager
  public hpManager!: HpManager
  private heartHud?: HeartHud
  private heartPickupManager!: HeartPickupManager
  private warpManager!: WarpManager
  private langHandler?: () => void
  private escKey?: Phaser.Input.Keyboard.Key
  private floor!: FloorData
  private pristineFloor!: string  // JSON snapshot for clean restart
  private challengeStateOnEntry: string[] = []
  private isDead = false
  private talkingNpc?: NPC

  constructor() {
    super({ key: 'GameScene' })
  }

  create(data?: { floorId?: string; fromDirection?: 'up' | 'down'; fromFloorId?: string; floorData?: FloorData }): void {
    this.isDead = false

    // Resolve floor: from direct data (test mode), then registry, then save, fallback
    // Deep-clone to avoid mutating the source (blocks/hearts get modified at runtime)
    const save = SaveManager.getInstance()
    const floorId = data?.floorId ?? save.getData().currentFloor
    const rawFloor = data?.floorData ?? getFloorById(floorId) ?? getFloorById('floor-01')!
    // Keep a pristine JSON snapshot for clean restarts (before any runtime mutations)
    this.pristineFloor = JSON.stringify(rawFloor)
    const floor: FloorData = JSON.parse(this.pristineFloor)
    this.floor = floor

    // Persist current floor (skip in test mode)
    if (!data?.floorData) save.setCurrentFloor(floor.id)

    // Snapshot challenge state so we can restore on death
    this.challengeStateOnEntry = [...save.getCompletedChallenges()]

    // Build Tiled JSON from floor tile data and inject into cache
    const mapW = floor.width ?? MAP_WIDTH_TILES
    const mapH = floor.height ?? MAP_HEIGHT_TILES
    const { json: mapJson, keyToGid } = buildTiledMapJson(floor.groundLayer, floor.wallsLayer, mapW, mapH)
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
    const groundTileLayer = map.createLayer('Ground', tilesets, 0, 0)!

    // Walls layer (collision)
    this.wallLayer = map.createLayer('Walls', tilesets, 0, 0)!

    // Animated tiles (cycles frames for tiles with _f1/_f2/... naming)
    this.animatedTiles = new AnimatedTileSystem([groundTileLayer, this.wallLayer], keyToGid)

    // Determine player spawn: near the arrival stair, or default playerStart
    const spawn = WarpManager.resolveSpawn(floor, data?.fromDirection, data?.fromFloorId)
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

    // Pushable blocks
    this.blockManager = new BlockManager(this, this.gridMovement, floor)
    this.blockManager.init()

    // HP system
    this.hpManager = new HpManager(floor.startingHp)
    this.heartHud = new HeartHud(this, this.hpManager.maxHp, this.hpManager.isInfinite)
    this.heartHud.update(this.hpManager.hp)

    // Heart pickups
    this.heartPickupManager = new HeartPickupManager(this, this.gridMovement, this.hpManager, this.heartHud)
    this.heartPickupManager.init(floor.hearts ?? [])

    // Warp system (stairs, teleports)
    this.warpManager = new WarpManager(this, this.gridMovement, floor, this.player)

    // Sync HUD when returning from challenge (HP may have changed)
    this.events.on('challenge-closed', () => {
      this.heartHud?.update(this.hpManager.hp)
      if (this.hpManager.isDead) {
        this.handleDeath()
      }
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
      // Show "..." speech bubble while talking (no animation — scene pauses immediately)
      npc.showBubble(this, '...', false)
      this.talkingNpc = npc
      this.handleNPCInteraction(npc)
    })

    // On resume (after dialog/challenge): flush stale keyboard state,
    // briefly block interactions, and re-check gatekeepers
    this.events.on('resume', () => {
      this.input.keyboard!.resetKeys()
      // Hide the "..." bubble from the NPC we were talking to
      if (this.talkingNpc) {
        this.talkingNpc.hideBubble()
        this.talkingNpc = undefined
      }
      // Don't re-enable anything if player is dead (death handler takes over)
      if (this.hpManager.isDead) return
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
    // Freeze everything on death
    if (this.isDead) return

    // Check warps/hearts BEFORE movement so walking through a teleport
    // tile triggers it (otherwise gridMovement.update() starts the next
    // move and the check never sees moving=false on that tile)
    if (!this.warpManager.isTransitioning && !this.gridMovement.moving) {
      this.heartPickupManager.check()
      this.warpManager.check()
    }

    if (this.gridMovement) {
      this.gridMovement.update()
    }
    if (this.interaction) {
      this.interaction.update()
    }
    if (this.behaviorSystem) {
      this.behaviorSystem.update(delta)
    }
    if (this.animatedTiles) {
      this.animatedTiles.update(delta)
    }

    // Y-sort: sprites lower on screen render on top
    this.player.sprite.setDepth(this.player.sprite.y)
    for (const npc of this.npcs) {
      npc.sprite.setDepth(npc.sprite.y)
    }
    this.blockManager.depthSort()
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


  // ── Damage & Death ──

  private handleDeath(): void {
    this.isDead = true
    this.gridMovement.freeze()
    this.interaction.setEnabled(false)
    this.behaviorSystem.freeze()

    const i18n = I18nManager.getInstance()

    // DOM overlay so it renders above everything (including challenge DOM elements)
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10010;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0);pointer-events:none;font-family:monospace;transition:background 0.5s;'
    document.body.appendChild(overlay)

    const title = document.createElement('div')
    title.style.cssText =
      'font-size:28px;color:#ff4444;opacity:0;transform:scale(0.8);transition:opacity 0.4s,transform 0.4s;'
    title.textContent = i18n.t('death_message')
    overlay.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.style.cssText =
      'font-size:14px;color:#888;margin-top:10px;opacity:0;transition:opacity 0.6s 0.3s;'
    subtitle.textContent = i18n.t('death_restart')
    overlay.appendChild(subtitle)

    // Animate in
    requestAnimationFrame(() => {
      overlay.style.background = 'rgba(0,0,0,0.75)'
      title.style.opacity = '1'
      title.style.transform = 'scale(1)'
      subtitle.style.opacity = '1'
    })

    // Restart floor after delay — restore challenge state so NPCs re-trigger
    this.time.delayedCall(2000, () => {
      overlay.remove()
      SaveManager.getInstance().setCompletedChallenges(this.challengeStateOnEntry)
      // Use pristine snapshot so NPCs/blocks/hearts are in original positions
      const cleanFloor: FloorData = JSON.parse(this.pristineFloor)
      this.scene.start('GameScene', { floorId: cleanFloor.id, floorData: cleanFloor })
    })
  }
}
