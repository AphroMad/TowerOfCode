import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    this.createLoadingBar()

    // Tileset
    this.load.image('tiles', 'assets/tilesets/tileset.png')
    // Tilemap
    this.load.tilemapTiledJSON('floor-01', 'assets/maps/floor-01.json')
    // Player: 256x256 sheet, 4 cols x 4 rows = 64x64 per frame
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 64,
      frameHeight: 64,
    })
    // NPC: 128x256 sheet, 2 cols x 4 rows = 64x64 per frame
    this.load.spritesheet('npc', 'assets/sprites/npc.png', {
      frameWidth: 64,
      frameHeight: 64,
    })
    // UI
    this.load.image('dialog-box', 'assets/ui/dialog-box.png')
  }

  create(): void {
    this.scene.start('MenuScene')
  }

  private createLoadingBar(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    const barBg = this.add.rectangle(width / 2, height / 2, 300, 24, 0x222222)
    const bar = this.add.rectangle(width / 2 - 146, height / 2, 0, 18, 0x4fc3f7)
    bar.setOrigin(0, 0.5)

    const text = this.add.text(width / 2, height / 2 - 28, 'Loading...', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      bar.width = 292 * value
    })

    this.load.on('complete', () => {
      barBg.destroy()
      bar.destroy()
      text.destroy()
    })
  }
}
