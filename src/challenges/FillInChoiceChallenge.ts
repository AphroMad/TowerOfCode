import Phaser from 'phaser'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig, FillInChoiceConfig } from '@/data/types'
import { I18nManager } from '@/i18n/I18nManager'
import { resolveText } from '@/utils/i18n-helpers'

const BLANK_MARKER = '___'

export class FillInChoiceChallenge implements IChallenge {
  private objects: Phaser.GameObjects.GameObject[] = []
  private scene!: Phaser.Scene
  private config!: FillInChoiceConfig
  private onComplete!: (success: boolean) => void
  private answered = false

  // Blank slots in the code template
  private blankSlots: Phaser.GameObjects.Text[] = []
  private filledValues: (string | null)[] = []

  // Option bank
  private bankButtons: Phaser.GameObjects.Text[] = []
  private bankValues: string[] = []
  private bankUsed: boolean[] = []

  // Submit button
  private submitBtn!: Phaser.GameObjects.Text

  create(scene: Phaser.Scene, config: ChallengeConfig, onComplete: (success: boolean) => void): void {
    this.scene = scene
    this.config = config as FillInChoiceConfig
    this.onComplete = onComplete
    this.answered = false

    const numBlanks = (this.config.codeTemplate.match(/___/g) || []).length
    this.filledValues = new Array(numBlanks).fill(null)
    this.bankValues = [...this.config.options]
    this.bankUsed = new Array(this.bankValues.length).fill(false)

    this.render()
  }

  update(): void {}

  destroy(): void {
    this.objects.forEach(obj => obj.destroy())
    this.objects = []
    this.blankSlots = []
    this.bankButtons = []
  }

  private render(): void {
    this.objects.forEach(obj => obj.destroy())
    this.objects = []
    this.blankSlots = []
    this.bankButtons = []

    const cam = this.scene.cameras.main
    const i18n = I18nManager.getInstance()

    // Question
    const question = this.scene.add.text(cam.centerX, 55, resolveText(this.config.question), {
      fontSize: '17px',
      color: '#ffffff',
      fontFamily: 'monospace',
      wordWrap: { width: 560 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(question)

    // Code template with blanks as interactive slots
    this.renderCodeTemplate(cam)

    // "Choose the correct value:" label
    const label = this.scene.add.text(cam.centerX, 250, i18n.t('challenge_choose_option'), {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(12)
    this.objects.push(label)

    // Option bank
    this.renderOptionBank(cam)

    // Submit button
    const allFilled = this.filledValues.every(v => v !== null)
    this.submitBtn = this.scene.add.text(cam.centerX, cam.height - 55, '[ENTER] to submit', {
      fontSize: '14px',
      color: allFilled ? '#aaffaa' : '#444444',
      fontFamily: 'monospace',
      backgroundColor: '#222233',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(12)
    this.objects.push(this.submitBtn)

    if (allFilled && !this.answered) {
      this.submitBtn.setInteractive({ useHandCursor: true })
      this.submitBtn.on('pointerover', () => this.submitBtn.setColor('#ffffff'))
      this.submitBtn.on('pointerout', () => this.submitBtn.setColor('#aaffaa'))
      this.submitBtn.on('pointerdown', () => this.submitAnswer())
    }

    // Keyboard submit
    if (!this.answered) {
      this.scene.input.keyboard!.once('keydown-ENTER', () => {
        if (this.filledValues.every(v => v !== null) && !this.answered) {
          this.submitAnswer()
        }
      })
    }
  }

  private renderCodeTemplate(cam: Phaser.Cameras.Scene2D.Camera): void {
    const lines = this.config.codeTemplate.split('\n')
    let blankIndex = 0

    const startY = 120
    const lineHeight = 36

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]
      const lineParts = line.split(BLANK_MARKER)
      const y = startY + lineIdx * lineHeight

      // Measure total width to center the line
      let totalWidth = 0
      const segments: { text: string; isBlank: boolean; blankIdx: number }[] = []
      for (let p = 0; p < lineParts.length; p++) {
        if (lineParts[p].length > 0) {
          segments.push({ text: lineParts[p], isBlank: false, blankIdx: -1 })
          totalWidth += lineParts[p].length * 11
        }
        if (p < lineParts.length - 1) {
          const val = this.filledValues[blankIndex]
          const display = val ?? '___'
          segments.push({ text: display, isBlank: true, blankIdx: blankIndex })
          totalWidth += Math.max(display.length, 3) * 11 + 16
          blankIndex++
        }
      }

      let x = cam.centerX - totalWidth / 2

      for (const seg of segments) {
        if (!seg.isBlank) {
          const codePart = this.scene.add.text(x, y, seg.text, {
            fontSize: '18px',
            color: '#88ddff',
            fontFamily: 'monospace',
          }).setOrigin(0, 0.5).setDepth(12)
          this.objects.push(codePart)
          x += seg.text.length * 11
        } else {
          const val = this.filledValues[seg.blankIdx]
          const display = val ?? '___'
          const slotWidth = Math.max(display.length, 3) * 11 + 16

          // Slot background
          const bg = this.scene.add.rectangle(
            x + slotWidth / 2, y,
            slotWidth, 28,
            val ? 0x335544 : 0x333355, 1
          ).setDepth(12).setStrokeStyle(1, val ? 0x44aa66 : 0x6666aa)
          this.objects.push(bg)

          const slotText = this.scene.add.text(x + slotWidth / 2, y, display, {
            fontSize: '16px',
            color: val ? '#66ffaa' : '#6666aa',
            fontFamily: 'monospace',
          }).setOrigin(0.5).setDepth(13)
          this.objects.push(slotText)
          this.blankSlots.push(slotText)

          // Make filled slots clickable to return option to bank
          if (val && !this.answered) {
            bg.setInteractive({ useHandCursor: true })
            const idx = seg.blankIdx
            bg.on('pointerdown', () => this.returnToBank(idx))
            bg.on('pointerover', () => {
              bg.setFillStyle(0x553333)
              bg.setStrokeStyle(1, 0xaa4444)
            })
            bg.on('pointerout', () => {
              bg.setFillStyle(0x335544)
              bg.setStrokeStyle(1, 0x44aa66)
            })
          }

          x += slotWidth
        }
      }
    }
  }

  private renderOptionBank(cam: Phaser.Cameras.Scene2D.Camera): void {
    const startY = 285
    const btnHeight = 36
    const btnPadding = 8
    const maxPerRow = 3
    const btnWidth = 160

    for (let i = 0; i < this.bankValues.length; i++) {
      if (this.bankUsed[i]) continue

      const visibleIndex = this.bankButtons.length
      const row = Math.floor(visibleIndex / maxPerRow)
      const col = visibleIndex % maxPerRow
      const totalCols = Math.min(maxPerRow, this.bankValues.filter((_, j) => !this.bankUsed[j]).length - row * maxPerRow)
      const rowWidth = totalCols * (btnWidth + btnPadding) - btnPadding

      const x = cam.centerX - rowWidth / 2 + col * (btnWidth + btnPadding) + btnWidth / 2
      const y = startY + row * (btnHeight + btnPadding)

      const bg = this.scene.add.rectangle(x, y, btnWidth, btnHeight, 0x2a2a44, 1)
        .setDepth(12).setStrokeStyle(1, 0x6666aa)
      this.objects.push(bg)

      const text = this.scene.add.text(x, y, this.bankValues[i], {
        fontSize: '15px',
        color: '#aaaaff',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(13)
      this.objects.push(text)
      this.bankButtons.push(text)

      if (!this.answered) {
        bg.setInteractive({ useHandCursor: true })
        const bankIdx = i
        bg.on('pointerdown', () => this.fillBlank(bankIdx))
        bg.on('pointerover', () => {
          bg.setFillStyle(0x3a3a55)
          bg.setStrokeStyle(1, 0x8888cc)
          text.setColor('#ffffff')
        })
        bg.on('pointerout', () => {
          bg.setFillStyle(0x2a2a44)
          bg.setStrokeStyle(1, 0x6666aa)
          text.setColor('#aaaaff')
        })
      }
    }
  }

  private fillBlank(bankIdx: number): void {
    if (this.answered || this.bankUsed[bankIdx]) return

    // Find first empty blank
    const emptyIdx = this.filledValues.indexOf(null)
    if (emptyIdx === -1) return

    this.filledValues[emptyIdx] = this.bankValues[bankIdx]
    this.bankUsed[bankIdx] = true
    this.render()
  }

  private returnToBank(blankIdx: number): void {
    if (this.answered) return

    const value = this.filledValues[blankIdx]
    if (value === null) return

    // Find the bank index for this value
    const bankIdx = this.bankValues.findIndex((v, i) => v === value && this.bankUsed[i])
    if (bankIdx !== -1) {
      this.bankUsed[bankIdx] = false
    }
    this.filledValues[blankIdx] = null
    this.render()
  }

  private submitAnswer(): void {
    if (this.answered) return
    if (this.filledValues.some(v => v === null)) return

    this.answered = true
    const i18n = I18nManager.getInstance()
    const cam = this.scene.cameras.main

    const correct = this.config.correctAnswers.every(
      (ans, i) => this.filledValues[i] === ans
    )

    if (correct) {
      const explanation = this.scene.add.text(
        cam.centerX, cam.height - 100,
        resolveText(this.config.explanation),
        {
          fontSize: '14px',
          color: '#aaffaa',
          fontFamily: 'monospace',
          wordWrap: { width: 560 },
          align: 'center',
        }
      ).setOrigin(0.5, 0).setDepth(12)
      this.objects.push(explanation)

      const hint = this.scene.add.text(
        cam.centerX, cam.height - 35,
        '[SPACE]',
        { fontSize: '14px', color: '#666666', fontFamily: 'monospace' }
      ).setOrigin(0.5).setDepth(12)
      this.objects.push(hint)

      this.scene.input.keyboard!.once('keydown-SPACE', () => {
        this.onComplete(true)
      })
    } else {
      const wrongText = this.scene.add.text(
        cam.centerX, cam.height - 80,
        i18n.t('challenge_wrong'),
        { fontSize: '18px', color: '#ff6666', fontFamily: 'monospace' }
      ).setOrigin(0.5).setDepth(12)
      this.objects.push(wrongText)

      this.scene.time.delayedCall(1200, () => {
        // Reset: clear all blanks, return all to bank
        this.filledValues = this.filledValues.map(() => null)
        this.bankUsed = this.bankUsed.map(() => false)
        this.answered = false
        this.render()
      })
    }
  }
}
