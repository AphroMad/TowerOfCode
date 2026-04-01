import Phaser from 'phaser'
import { DialogSystem } from '@/systems/DialogSystem'
import { i18n } from '@/i18n/I18nManager'
import type { ChallengeConfig } from '@/data/types'
import { SCENE } from '@/utils/constants'

interface DialogSceneData {
  dialogKey?: string
  npcName?: string
  challengeConfig?: ChallengeConfig
  challengeIds?: string[]
  challengeCompleted?: boolean
}

export class DialogScene extends Phaser.Scene {
  private dialogSystem!: DialogSystem
  private speakerText!: Phaser.GameObjects.Text
  private dialogText!: Phaser.GameObjects.Text
  private advanceIndicator!: Phaser.GameObjects.Text
  private advanceTween?: Phaser.Tweens.Tween
  private sceneData!: DialogSceneData
  private inReplayPrompt = false
  private transitioning = false
  private selectedOption = 0 // 0 = yes, 1 = no
  private optionsText?: Phaser.GameObjects.Text
  private yesLabel = ''
  private noLabel = ''

  constructor() {
    super({ key: SCENE.DIALOG })
  }

  create(data: DialogSceneData): void {
    this.sceneData = data
    this.inReplayPrompt = false
    this.transitioning = false
    this.selectedOption = 1
    const cam = this.cameras.main
    const boxY = cam.height - 58

    // Semi-transparent background overlay
    this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0.3)
      .setDepth(0)

    // Dialog box
    this.add.image(cam.centerX, boxY, 'dialog-box')
      .setDepth(1)

    // Speaker name
    this.speakerText = this.add.text(cam.centerX - 286, boxY - 36, '', {
      fontSize: '16px',
      color: '#ffdd44',
      fontFamily: 'monospace',
    }).setDepth(2)

    // Dialog text
    this.dialogText = this.add.text(cam.centerX - 286, boxY - 14, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      wordWrap: { width: 572 },
      lineSpacing: 6,
    }).setDepth(2)

    // Advance indicator
    this.advanceIndicator = this.add.text(cam.centerX + 286, boxY + 32, '>', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setDepth(2)

    this.advanceTween = this.tweens.add({
      targets: this.advanceIndicator,
      alpha: 0.3,
      yoyo: true,
      repeat: -1,
      duration: 500,
    })

    // Dialog system
    this.dialogSystem = new DialogSystem(
      this,
      (text, speaker) => {
        this.dialogText.setText(text)
        if (speaker) this.speakerText.setText(speaker)
      },
      () => this.onDialogComplete(),
    )

    // Get dialog lines from i18n
    const lines = data.dialogKey
      ? i18n.getDialog(data.dialogKey, data.npcName)
      : []
    this.dialogSystem.start(lines)

    // Input
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (this.transitioning) return
      if (this.inReplayPrompt) {
        this.confirmReplayChoice()
      } else {
        this.dialogSystem.advance()
      }
    })

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.transitioning) return
      if (this.inReplayPrompt) this.confirmReplayChoice()
    })

    this.input.keyboard!.on('keydown-UP', () => {
      if (this.inReplayPrompt) {
        this.selectedOption = 0
        this.updateReplayHighlight()
      }
    })

    this.input.keyboard!.on('keydown-DOWN', () => {
      if (this.inReplayPrompt) {
        this.selectedOption = 1
        this.updateReplayHighlight()
      }
    })

    // Cleanup on shutdown (use 'once' to prevent listener accumulation across scene restarts)
    this.events.once('shutdown', () => {
      this.input.keyboard!.off('keydown-SPACE')
      this.input.keyboard!.off('keydown-ENTER')
      this.input.keyboard!.off('keydown-UP')
      this.input.keyboard!.off('keydown-DOWN')
      if (this.advanceTween) {
        this.advanceTween.stop()
        this.advanceTween = undefined
      }
      this.dialogSystem.destroy()
    })
  }

  private onDialogComplete(): void {
    if (this.transitioning) return
    if (this.sceneData.challengeConfig) {
      if (this.sceneData.challengeCompleted) {
        this.showReplayPrompt()
      } else {
        this.transitioning = true
        this.playCombatTransition(() => {
          this.scene.stop()
          this.scene.launch(SCENE.CHALLENGE, {
            challengeConfig: this.sceneData.challengeConfig,
            challengeIds: this.sceneData.challengeIds,
          })
        })
      }
    } else {
      this.scene.stop()
      this.scene.resume(SCENE.GAME)
    }
  }

  /** Classic RPG spiral-in battle transition */
  private playCombatTransition(onDone: () => void): void {
    const cam = this.cameras.main
    const w = cam.width
    const h = cam.height
    const cx = cam.centerX
    const cy = cam.centerY
    const maxRadius = Math.sqrt(cx * cx + cy * cy) + 20

    // Phase 1: Two quick white flashes
    const flash = this.add.rectangle(cx, cy, w, h, 0xffffff, 0).setDepth(100)

    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.7 },
      duration: 80,
      yoyo: true,
      onComplete: () => {
        this.tweens.add({
          targets: flash,
          alpha: { from: 0, to: 0.5 },
          duration: 60,
          yoyo: true,
          onComplete: () => {
            flash.destroy()
            this.playSpiralWipe(cx, cy, maxRadius, w, h, onDone)
          },
        })
      },
    })
  }

  /** Iris-wipe closing circle with spinning accent — classic RPG battle entry */
  private playSpiralWipe(cx: number, cy: number, maxRadius: number, w: number, h: number, onDone: () => void): void {
    // Black rectangle that covers the screen — masked by a shrinking circle
    const blackBg = this.add.rectangle(cx, cy, w, h, 0x111122).setDepth(99)

    // Circle shape used as geometry mask (visible area = inside the circle)
    const maskShape = this.make.graphics({ x: 0, y: 0 })
    maskShape.fillStyle(0xffffff)
    maskShape.fillCircle(cx, cy, maxRadius)

    const mask = maskShape.createGeometryMask()
    mask.invertAlpha = true // Invert: black shows OUTSIDE the circle
    blackBg.setMask(mask)

    // Accent ring that spins as it closes
    const ringGfx = this.add.graphics().setDepth(100)

    const duration = 650
    const startTime = this.time.now

    const updateEvent = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const elapsed = this.time.now - startTime
        const t = Math.min(elapsed / duration, 1)
        // Ease-in curve — starts fast, decelerates at the end
        const eased = 1 - Math.pow(1 - t, 3)

        const r = maxRadius * (1 - eased)

        // Redraw the mask circle at new radius
        maskShape.clear()
        maskShape.fillStyle(0xffffff)
        maskShape.fillCircle(cx, cy, Math.max(r, 0))

        // Spinning accent ring
        ringGfx.clear()
        if (r > 4) {
          const spin = eased * Math.PI * 6
          // Thin outer ring
          ringGfx.lineStyle(2, 0xffdd44, 0.5 * (1 - eased))
          ringGfx.strokeCircle(cx, cy, r)
          // Bright spinning arc
          ringGfx.lineStyle(3, 0xffdd44, 0.8 * (1 - eased * 0.5))
          ringGfx.beginPath()
          ringGfx.arc(cx, cy, r, spin, spin + 1.2)
          ringGfx.strokePath()
          // Secondary accent arc (opposite side)
          ringGfx.lineStyle(2, 0x4488cc, 0.6 * (1 - eased))
          ringGfx.beginPath()
          ringGfx.arc(cx, cy, r, spin + Math.PI, spin + Math.PI + 0.8)
          ringGfx.strokePath()
        }

        if (t >= 1) {
          updateEvent.destroy()
          ringGfx.destroy()
          // Remove mask, just show full black
          blackBg.clearMask(true)
          maskShape.destroy()
          blackBg.setFillStyle(0x111122)
          this.time.delayedCall(120, onDone)
        }
      },
    })
  }

  private showReplayPrompt(): void {
    this.inReplayPrompt = true
    this.selectedOption = 0 // default Yes

    // Show prompt as regular dialog text
    this.dialogText.setText(i18n.t('challenge_replay_prompt'))

    // Hide the pulsing advance indicator
    this.advanceIndicator.setVisible(false)
    if (this.advanceTween) {
      this.advanceTween.stop()
      this.advanceTween = undefined
    }

    // Options displayed ABOVE the dialog box (player's response, not NPC speech)
    const cam = this.cameras.main
    const boxY = cam.height - 58
    const optX = cam.centerX + 180
    const optY = boxY - 110

    this.yesLabel = i18n.t('yes')
    this.noLabel = i18n.t('no')

    // Small background panel for the options
    this.add.rectangle(optX + 40, optY + 14, 110, 48, 0x000000, 0.8)
      .setDepth(2).setStrokeStyle(1, 0x444444)

    this.optionsText = this.add.text(optX, optY, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      lineSpacing: 4,
    }).setDepth(3)

    this.updateReplayHighlight()
  }

  private updateReplayHighlight(): void {
    if (!this.optionsText) return
    const arrow = '>'
    const blank = ' '
    const yesLine = `${this.selectedOption === 0 ? arrow : blank} ${this.yesLabel}`
    const noLine = `${this.selectedOption === 1 ? arrow : blank} ${this.noLabel}`
    this.optionsText.setText(`${yesLine}\n${noLine}`)
  }

  private confirmReplayChoice(): void {
    if (this.transitioning) return
    if (this.selectedOption === 0) {
      this.transitioning = true
      this.playCombatTransition(() => {
        this.scene.stop()
        this.scene.launch(SCENE.CHALLENGE, {
          challengeConfig: this.sceneData.challengeConfig,
          challengeIds: this.sceneData.challengeIds,
        })
      })
    } else {
      this.scene.stop()
      this.scene.resume(SCENE.GAME)
    }
  }
}
