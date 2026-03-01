import Phaser from 'phaser'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig, ExplanationConfig } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'

export class ExplanationChallenge implements IChallenge {
  private objects: Phaser.GameObjects.GameObject[] = []
  private scene!: Phaser.Scene
  private config!: ExplanationConfig
  private onComplete!: (success: boolean) => void
  private currentPage = 0
  private keySpace?: Phaser.Input.Keyboard.Key

  create(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void): void {
    this.scene = scene
    this.config = config as ExplanationConfig
    this.onComplete = onComplete
    this.currentPage = 0

    this.renderPage()

    this.keySpace = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
  }

  update(): void {
    if (this.keySpace && Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.nextPage()
    }
  }

  destroy(): void {
    this.objects.forEach(obj => obj.destroy())
    this.objects = []
    if (this.keySpace) this.scene.input.keyboard!.removeKey(this.keySpace)
  }

  private renderPage(): void {
    // Clear previous page objects
    this.objects.forEach(obj => obj.destroy())
    this.objects = []

    const cam = this.scene.cameras.main
    const page = this.config.pages[this.currentPage]

    // Cream/off-white background panel that covers the ChallengeScene dark bg
    const panel = this.scene.add.rectangle(
      cam.centerX, cam.centerY, cam.width - 40, cam.height - 40,
      0xfff8e7, 1
    ).setDepth(11).setStrokeStyle(3, 0xccaa66)
    this.objects.push(panel)

    // Title
    const title = this.scene.add.text(cam.centerX, 50, resolveText(page.title), {
      fontSize: '22px',
      color: '#333333',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      wordWrap: { width: 520 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(title)

    // Body text
    const body = this.scene.add.text(cam.centerX, 100, resolveText(page.text), {
      fontSize: '15px',
      color: '#444444',
      fontFamily: 'monospace',
      wordWrap: { width: 520 },
      lineSpacing: 6,
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(body)

    // Code example (if present)
    if (page.codeExample) {
      const codeY = body.y + body.height + 20
      const codeBg = this.scene.add.rectangle(
        cam.centerX, codeY + 20, 400, 50,
        0x2d2d2d, 1
      ).setDepth(12).setStrokeStyle(1, 0x555555)
      this.objects.push(codeBg)

      const code = this.scene.add.text(cam.centerX, codeY + 20, page.codeExample, {
        fontSize: '18px',
        color: '#88ddff',
        fontFamily: 'monospace',
        align: 'center',
      }).setOrigin(0.5).setDepth(13)
      this.objects.push(code)
    }

    // Page counter
    const totalPages = this.config.pages.length
    const counter = this.scene.add.text(
      cam.centerX, cam.height - 60,
      `${this.currentPage + 1} / ${totalPages}`,
      {
        fontSize: '14px',
        color: '#888888',
        fontFamily: 'monospace',
      }
    ).setOrigin(0.5).setDepth(12)
    this.objects.push(counter)

    // Hint at bottom
    const isLast = this.currentPage === totalPages - 1
    const hint = this.scene.add.text(
      cam.centerX, cam.height - 35,
      isLast ? '[SPACE] to finish' : '[SPACE] next page',
      {
        fontSize: '13px',
        color: '#999999',
        fontFamily: 'monospace',
      }
    ).setOrigin(0.5).setDepth(12)
    this.objects.push(hint)
  }

  private nextPage(): void {
    if (this.currentPage < this.config.pages.length - 1) {
      this.currentPage++
      this.renderPage()
    } else {
      this.onComplete(true)
    }
  }
}
