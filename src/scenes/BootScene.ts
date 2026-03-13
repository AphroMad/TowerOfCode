import Phaser from 'phaser'
import { getAllTiles } from '@/data/tiles/TileRegistry'
import { getAllSprites } from '@/data/sprites/SpriteRegistry'
import { normalizeTileTextures } from '@/utils/normalizeTileTextures'
import { normalizeSpriteTextures } from '@/utils/normalizeSpriteTextures'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    this.createLoadingBar()

    // Tilesets (auto-discovered from src/assets/tilesets/)
    for (const tile of getAllTiles()) {
      this.load.image(tile.key, tile.url)
    }
    // Sprites (auto-discovered, loaded as images — converted to spritesheets in create)
    for (const sprite of getAllSprites()) {
      this.load.image(sprite.key, sprite.url)
    }
    // Stairs
    this.load.image('stairs_straight', 'assets/tilesets/stairs_straight.png')
    // UI
    this.load.image('dialog-box', 'assets/ui/dialog-box.png')
  }

  create(): void {
    normalizeTileTextures(this)
    normalizeSpriteTextures(this)
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
