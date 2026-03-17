import Phaser from 'phaser'

const HEART_FULL = '\u2665'   // ♥
const HEART_EMPTY = '\u2661'  // ♡
const HEART_SIZE = 22
const HEART_GAP = 4
const HUD_X = 16
const HUD_Y = 12
const HUD_DEPTH = 200

export class HeartHud {
  private scene: Phaser.Scene
  private hearts: Phaser.GameObjects.Text[] = []
  private maxHp: number
  private hidden: boolean

  constructor(scene: Phaser.Scene, maxHp: number, isInfinite: boolean) {
    this.scene = scene
    this.maxHp = maxHp
    this.hidden = isInfinite

    if (this.hidden) return

    for (let i = 0; i < maxHp; i++) {
      const heart = scene.add.text(
        HUD_X + i * (HEART_SIZE + HEART_GAP),
        HUD_Y,
        HEART_FULL,
        {
          fontSize: `${HEART_SIZE}px`,
          color: '#ff3344',
          fontFamily: 'monospace',
        }
      )
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH)
        .setOrigin(0, 0)
      this.hearts.push(heart)
    }
  }

  update(hp: number): void {
    if (this.hidden) return

    for (let i = 0; i < this.maxHp; i++) {
      const heart = this.hearts[i]
      if (!heart) continue
      const filled = i < hp
      heart.setText(filled ? HEART_FULL : HEART_EMPTY)
      heart.setColor(filled ? '#ff3344' : '#553333')
    }
  }

  playDamageAnimation(): void {
    if (this.hidden) return

    // Shake all hearts
    for (const heart of this.hearts) {
      const origX = heart.x
      this.scene.tweens.add({
        targets: heart,
        x: origX + 3,
        duration: 40,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.inOut',
        onComplete: () => { heart.x = origX },
      })
    }
  }

  playHealAnimation(hp: number): void {
    if (this.hidden) return

    // Bounce the newly filled heart
    const idx = hp - 1
    const heart = this.hearts[idx]
    if (!heart) return

    this.scene.tweens.add({
      targets: heart,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 150,
      yoyo: true,
      ease: 'Back.out',
    })
  }

  destroy(): void {
    for (const heart of this.hearts) {
      heart.destroy()
    }
    this.hearts = []
  }
}
