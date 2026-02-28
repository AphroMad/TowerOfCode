import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { NPC } from '@/entities/NPC'
import { GridMovementSystem } from '@/systems/GridMovementSystem'
import { InteractionSystem } from '@/systems/InteractionSystem'
import { FloorManager } from '@/systems/FloorManager'
import { SaveManager } from '@/systems/SaveManager'
import { floor01 } from '@/data/floors/floor-01'
import { I18nManager } from '@/i18n/I18nManager'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private npcs: NPC[] = []
  private gridMovement!: GridMovementSystem
  private interaction!: InteractionSystem
  private floorManager!: FloorManager
  private wallLayer!: Phaser.Tilemaps.TilemapLayer

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    const floor = floor01
    this.floorManager = new FloorManager(floor)
    const map = this.make.tilemap({ key: floor.mapKey })
    const tileset = map.addTilesetImage('tileset', floor.tilesetKey)!

    // Ground layer
    map.createLayer('Ground', tileset, 0, 0)

    // Walls layer (collision)
    this.wallLayer = map.createLayer('Walls', tileset, 0, 0)!

    // Player
    const start = floor.playerStart
    this.player = new Player(this, start.tileX, start.tileY)
    this.player.facing = start.facing

    // Grid movement
    this.gridMovement = new GridMovementSystem(this, this.player, this.wallLayer)

    // NPCs
    this.npcs = floor.npcs.map(npcData => {
      const npc = new NPC(this, npcData)
      this.gridMovement.blockTile(npcData.tileX, npcData.tileY)
      return npc
    })

    // Interaction system
    this.interaction = new InteractionSystem(this, this.npcs, this.gridMovement)

    // NPC interaction handler
    this.events.on('npc-interact', (npc: NPC) => {
      this.handleNPCInteraction(npc)
    })

    // Camera
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
    this.cameras.main.startFollow(this.player.sprite, true)
    this.cameras.main.setRoundPixels(true)

    // Floor title banner
    const i18n = I18nManager.getInstance()
    const banner = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 40,
      i18n.t('floor_01_name'),
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

  update(): void {
    if (this.gridMovement) {
      this.gridMovement.update()
    }
    if (this.interaction) {
      this.interaction.update()
    }

    // Y-sort: sprites lower on screen render on top
    this.player.sprite.setDepth(this.player.sprite.y)
    for (const npc of this.npcs) {
      npc.sprite.setDepth(npc.sprite.y)
    }
  }

  private handleNPCInteraction(npc: NPC): void {
    const save = SaveManager.getInstance()

    let dialogKey = npc.data.dialogKey
    let challengeId = npc.data.challengeId

    if (npc.data.role === 'gatekeeper') {
      dialogKey = this.floorManager.getGatekeeperDialogKey()
      challengeId = undefined
    }

    if (npc.data.role === 'professor' && challengeId && save.isChallengeCompleted(challengeId)) {
      challengeId = undefined
    }

    this.scene.pause()
    this.scene.launch('DialogScene', {
      dialogKey,
      npcName: npc.data.name,
      challengeId,
      npcRole: npc.data.role,
    })
  }
}
