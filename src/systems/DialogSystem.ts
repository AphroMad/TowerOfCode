import Phaser from 'phaser'
import { TYPEWRITER_SPEED } from '@/config/game.config'

export interface DialogLine {
  speaker?: string
  text: string
}

export class DialogSystem {
  private scene: Phaser.Scene
  private lines: DialogLine[] = []
  private currentLineIndex = 0
  private currentCharIndex = 0
  private isTyping = false
  private timer: Phaser.Time.TimerEvent | null = null
  private onTextUpdate: (text: string, speaker?: string) => void
  private onComplete: () => void
  private displayedText = ''

  constructor(
    scene: Phaser.Scene,
    onTextUpdate: (text: string, speaker?: string) => void,
    onComplete: () => void,
  ) {
    this.scene = scene
    this.onTextUpdate = onTextUpdate
    this.onComplete = onComplete
  }

  start(lines: DialogLine[]): void {
    this.lines = lines
    this.currentLineIndex = 0
    this.typeLine()
  }

  advance(): void {
    if (this.isTyping) {
      this.skipTyping()
    } else if (this.currentLineIndex < this.lines.length - 1) {
      this.currentLineIndex++
      this.typeLine()
    } else {
      this.onComplete()
    }
  }

  destroy(): void {
    if (this.timer) {
      this.timer.destroy()
      this.timer = null
    }
  }

  private typeLine(): void {
    const line = this.lines[this.currentLineIndex]
    this.displayedText = ''
    this.currentCharIndex = 0
    this.isTyping = true

    this.onTextUpdate('', line.speaker)

    this.timer = this.scene.time.addEvent({
      delay: TYPEWRITER_SPEED,
      loop: true,
      callback: () => {
        if (this.currentCharIndex < line.text.length) {
          this.displayedText += line.text[this.currentCharIndex]
          this.currentCharIndex++
          this.onTextUpdate(this.displayedText, line.speaker)
        } else {
          this.isTyping = false
          if (this.timer) {
            this.timer.destroy()
            this.timer = null
          }
        }
      },
    })
  }

  private skipTyping(): void {
    if (this.timer) {
      this.timer.destroy()
      this.timer = null
    }
    const line = this.lines[this.currentLineIndex]
    this.displayedText = line.text
    this.isTyping = false
    this.onTextUpdate(this.displayedText, line.speaker)
  }
}
