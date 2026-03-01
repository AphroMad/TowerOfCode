import Phaser from 'phaser'
import { I18nManager } from '@/i18n/I18nManager'
import { SaveManager } from '@/systems/SaveManager'


export class MenuScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.Text[] = []
  private selectedIndex = 0
  private cursor!: Phaser.GameObjects.Text
  private langHandler?: () => void

  constructor() {
    super({ key: 'MenuScene' })
  }

  create(): void {
    const cam = this.cameras.main
    const cx = cam.centerX
    const i18n = I18nManager.getInstance()
    const save = SaveManager.getInstance()

    i18n.setLanguage(save.getData().language)
    this.cameras.main.fadeIn(300, 26, 26, 46)

    // Restart scene when language is toggled via HTML button
    this.langHandler = () => this.scene.restart()
    window.addEventListener('toggle-language', this.langHandler)
    this.events.on('shutdown', () => {
      if (this.langHandler) {
        window.removeEventListener('toggle-language', this.langHandler)
        this.langHandler = undefined
      }
    })

    // Title
    this.add.text(cx, 100, i18n.t('game_title'), {
      fontSize: '36px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Subtitle
    this.add.text(cx, 145, '~ ~ ~', {
      fontSize: '14px',
      color: '#555555',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    // Menu items
    const startY = 220
    const items: { key: string; action: () => void }[] = []

    if (save.hasSave()) {
      items.push({ key: 'menu_continue', action: () => this.startGame() })
    }
    items.push({ key: 'menu_new_game', action: () => this.newGame() })

    items.forEach((item, i) => {
      const text = this.add.text(cx, startY + i * 40, i18n.t(item.key), {
        fontSize: '20px',
        color: '#cccccc',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setData('action', item.action)
      this.menuItems.push(text)
    })

    // Cursor
    this.cursor = this.add.text(cx - 140, startY, '>', {
      fontSize: '20px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.updateCursor()

    const upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    const downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)

    upKey.on('down', () => {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1)
      this.updateCursor()
    })
    downKey.on('down', () => {
      this.selectedIndex = Math.min(this.menuItems.length - 1, this.selectedIndex + 1)
      this.updateCursor()
    })
    spaceKey.on('down', () => this.selectItem())
    enterKey.on('down', () => this.selectItem())
  }

  private updateCursor(): void {
    if (this.menuItems[this.selectedIndex]) {
      this.cursor.y = this.menuItems[this.selectedIndex].y
    }
    this.menuItems.forEach((t, i) => {
      t.setColor(i === this.selectedIndex ? '#ffffff' : '#888888')
    })
  }

  private selectItem(): void {
    const action = this.menuItems[this.selectedIndex].getData('action') as () => void
    action()
  }

  private startGame(): void {
    this.cameras.main.fadeOut(300, 26, 26, 46)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene')
    })
  }

  private newGame(): void {
    SaveManager.getInstance().reset()
    this.startGame()
  }
}
