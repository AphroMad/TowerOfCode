import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { NPC } from '@/entities/NPC'
import { GridMovementSystem } from '@/systems/GridMovementSystem'
import { InteractionSystem } from '@/systems/InteractionSystem'
import { NpcBehaviorSystem } from '@/systems/NpcBehaviorSystem'
import { SaveManager } from '@/systems/SaveManager'
import { getMapById } from '@/data/maps/MapRegistry'
import { I18nManager } from '@/i18n/I18nManager'
import { getChallenge } from '@/data/challenges'
import { MAP_WIDTH_TILES, MAP_HEIGHT_TILES, TILE_SIZE } from '@/config/game.config'
import type { ChallengeConfig, MapData } from '@/data/types'
import { buildTiledMapJson } from '@/utils/buildTiledMapJson'
import { AnimatedTileSystem } from '@/systems/AnimatedTileSystem'
import { HpManager } from '@/systems/HpManager'
import { HeartHud } from '@/ui/HeartHud'
import { BlockManager } from './managers/BlockManager'
import { HeartPickupManager } from './managers/HeartPickupManager'
import { WarpManager } from './managers/WarpManager'
import { Companion } from '@/entities/Companion'

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
  private escKey?: Phaser.Input.Keyboard.Key
  private mapData!: MapData
  private pristineMap!: string  // JSON snapshot for clean restart
  private challengeStateOnEntry: string[] = []
  private isDead = false
  private talkingNpc?: NPC
  private companion?: Companion

  constructor() {
    super({ key: 'GameScene' })
  }

  create(data?: { mapId?: string; fromDirection?: 'up' | 'down'; fromMapId?: string; mapData?: MapData }): void {
    this.isDead = false

    // Resolve map: from direct data (test mode), then registry, then save, fallback
    const save = SaveManager.getInstance()
    const mapId = data?.mapId ?? save.getData().currentMap
    const rawMap = data?.mapData ?? getMapById(mapId) ?? getMapById('map-01')!
    this.pristineMap = JSON.stringify(rawMap)
    const mapData: MapData = JSON.parse(this.pristineMap)
    this.mapData = mapData

    // Persist current map (skip in test mode)
    if (!data?.mapData) save.setCurrentMap(mapData.id)

    // Snapshot challenge state so we can restore on death
    this.challengeStateOnEntry = [...save.getCompletedChallenges()]

    const mapW = mapData.width ?? MAP_WIDTH_TILES
    const mapH = mapData.height ?? MAP_HEIGHT_TILES

    const map = this.buildTilemap(mapData, mapW, mapH)
    this.setupPlayer(mapData, data?.fromDirection, data?.fromMapId)
    this.setupCompanion()
    this.setupMovement(mapData, mapW)
    this.setupEntities(mapData)
    this.setupEventHandlers()
    this.setupCamera(map)
    this.showMapName(mapData)
    this.setupInputAndLifecycle()
  }

  private buildTilemap(mapData: MapData, mapW: number, mapH: number): Phaser.Tilemaps.Tilemap {
    const { json: mapJson, keyToGid } = buildTiledMapJson(mapData.groundLayer, mapData.wallsLayer, mapW, mapH)
    this.cache.tilemap.add(mapData.id, {
      data: mapJson,
      format: Phaser.Tilemaps.Formats.TILED_JSON,
    })

    const map = this.make.tilemap({ key: mapData.id })
    const tilesets: Phaser.Tilemaps.Tileset[] = []
    for (const tsData of map.tilesets) {
      const ts = map.addTilesetImage(tsData.name, tsData.name)
      if (ts) tilesets.push(ts)
    }

    const groundTileLayer = map.createLayer('Ground', tilesets, 0, 0)!
    this.wallLayer = map.createLayer('Walls', tilesets, 0, 0)!

    // Animated tiles (cycles frames for tiles with _f1/_f2/... naming)
    this.animatedTiles = new AnimatedTileSystem([groundTileLayer, this.wallLayer], keyToGid)

    return map
  }

  private setupPlayer(mapData: MapData, fromDirection?: 'up' | 'down', fromMapId?: string): void {
    const spawn = WarpManager.resolveSpawn(mapData, fromDirection, fromMapId)
    this.player = new Player(this, spawn.tileX, spawn.tileY)
    this.player.facing = spawn.facing
  }

  private setupCompanion(): void {
    const spriteKey = SaveManager.getInstance().getCompanion()
    if (!spriteKey) {
      this.companion = undefined
      return
    }

    const behind = Companion.behindPosition(this.player.tileX, this.player.tileY, this.player.facing)
    this.companion = new Companion(this, spriteKey, behind.x, behind.y, this.player.facing)
  }

  private setupMovement(mapData: MapData, mapW: number): void {
    this.gridMovement = new GridMovementSystem(this, this.player, this.wallLayer)

    // Companion follows player 1 tile behind
    if (this.companion) {
      this.gridMovement.onMoveComplete((fromX, fromY, _toX, _toY, _dir) => {
        this.companion?.walkToTile(this, fromX, fromY)
      })
    }

    if (mapData.tileEffects?.length) {
      this.gridMovement.setTileEffects(mapData.tileEffects)

      // Render ledge indicators
      const ledgeEffects = mapData.tileEffects.filter(e => e.effect === 'ledge')
      if (ledgeEffects.length > 0) {
        const ledgeGfx = this.add.graphics()
        ledgeGfx.setDepth(-1)
        for (const l of ledgeEffects) {
          const px = l.tileX * TILE_SIZE
          const py = l.tileY * TILE_SIZE
          ledgeGfx.fillStyle(0xddaa28, 0.2)
          ledgeGfx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        }
      }
    }

    // Non-collision wall tiles (passable overrides)
    const passableWalls = new Set<string>()
    if (mapData.wallsCollision) {
      for (let i = 0; i < mapData.wallsLayer.length; i++) {
        if (mapData.wallsLayer[i] !== '' && !mapData.wallsCollision[i]) {
          passableWalls.add(`${i % mapW},${Math.floor(i / mapW)}`)
        }
      }
    }
    if (mapData.noCollision) {
      for (const nc of mapData.noCollision) {
        passableWalls.add(`${nc.tileX},${nc.tileY}`)
      }
    }
    if (passableWalls.size > 0) this.gridMovement.setPassableWalls(passableWalls)
  }

  private setupEntities(mapData: MapData): void {
    // NPCs
    this.npcs = mapData.npcs.map(npcData => {
      const npc = new NPC(this, npcData)
      this.gridMovement.blockTile(npcData.tileX, npcData.tileY)
      return npc
    })

    // Pushable blocks
    this.blockManager = new BlockManager(this, this.gridMovement, mapData)
    this.blockManager.init()

    // HP system
    this.hpManager = new HpManager(mapData.startingHp)
    this.heartHud = new HeartHud(this, this.hpManager.maxHp, this.hpManager.isInfinite)
    this.heartHud.update(this.hpManager.hp)

    // Heart pickups
    this.heartPickupManager = new HeartPickupManager(this, this.gridMovement, this.hpManager, this.heartHud)
    this.heartPickupManager.init(mapData.hearts ?? [])

    // Warp system (stairs, teleports)
    this.warpManager = new WarpManager(this, this.gridMovement, mapData, this.player)
  }

  private setupEventHandlers(): void {
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

    // Hide gatekeepers if map is already complete
    this.updateGatekeepers()

    // NPC interaction handler
    this.events.on('npc-interact', (npc: NPC) => {
      this.behaviorSystem.markDetected(npc)
      npc.showBubble(this, '...', false)
      this.talkingNpc = npc
      this.handleNPCInteraction(npc)
    })

    // On resume (after dialog/challenge): flush stale keyboard state,
    // briefly block interactions, and re-check gatekeepers
    this.events.on('resume', () => {
      this.input.keyboard!.resetKeys()
      if (this.talkingNpc) {
        this.talkingNpc.hideBubble()
        this.talkingNpc = undefined
      }
      if (this.hpManager.isDead) return
      this.interaction.setEnabled(false)
      this.time.delayedCall(300, () => this.interaction.setEnabled(true))
      this.updateGatekeepers()
    })
  }

  private setupCamera(map: Phaser.Tilemaps.Tilemap): void {
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
    this.cameras.main.startFollow(this.player.sprite, true)
    this.cameras.main.setRoundPixels(true)
  }

  private showMapName(mapData: MapData): void {
    const i18n = I18nManager.getInstance()
    const mapNameKey = `${mapData.id.replace('-', '_')}_name`
    const banner = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 40,
      i18n.t(mapNameKey),
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
  }

  private setupInputAndLifecycle(): void {
    // ESC to return to menu
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escKey.on('down', () => this.scene.start('MenuScene'))

    // Hide language toggle during gameplay
    const langBtn = document.getElementById('lang-toggle')
    if (langBtn) langBtn.style.display = 'none'

    this.events.on('shutdown', () => {
      if (langBtn) langBtn.style.display = ''
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
    if (this.companion) {
      this.companion.sprite.setDepth(this.companion.sprite.y)
    }
    for (const npc of this.npcs) {
      npc.sprite.setDepth(npc.sprite.y)
    }
    this.blockManager.depthSort()
  }

  private updateGatekeepers(): void {
    const save = SaveManager.getInstance()
    const allDone = this.mapData.requiredChallenges.length > 0
      && this.mapData.requiredChallenges.every(id => save.isChallengeCompleted(id))

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

    // Always present challenges fresh — NPCs are independent
    let challengeConfig: ChallengeConfig | undefined
    if (npc.data.challengeIds?.length) {
      challengeConfig = getChallenge(npc.data.challengeIds[0])
    }

    this.scene.pause()
    this.scene.launch('DialogScene', {
      dialogKey,
      npcName: npc.data.name,
      challengeConfig,
      challengeIds: npc.data.challengeIds,
      challengeCompleted: false,
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

    // Restart map after delay — restore challenge state so NPCs re-trigger
    this.time.delayedCall(2000, () => {
      overlay.remove()
      SaveManager.getInstance().setCompletedChallenges(this.challengeStateOnEntry)
      // Use pristine snapshot so NPCs/blocks/hearts are in original positions
      const cleanMap: MapData = JSON.parse(this.pristineMap)
      this.scene.start('GameScene', { mapId: cleanMap.id, mapData: cleanMap })
    })
  }
}
