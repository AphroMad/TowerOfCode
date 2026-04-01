import Phaser from 'phaser'
import type { EditorState } from './EditorState'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/game.config'
import { GameScene } from '@/scenes/GameScene'
import { DialogScene } from '@/scenes/DialogScene'
import { ChallengeScene } from '@/scenes/ChallengeScene'
import { EffectId } from '@/data/types'
import type { MapData, Direction, TileEffectData } from '@/data/types'
import { getAllTiles } from '@/data/tiles/TileRegistry'
import { getAllSprites } from '@/data/sprites/SpriteRegistry'
import { normalizeTileTextures } from '@/utils/normalizeTileTextures'
import { normalizeSpriteTextures } from '@/utils/normalizeSpriteTextures'
import { saveManager } from '@/systems/SaveManager'
import { SCENE } from '@/utils/constants'

/**
 * Boot scene for editor test mode.
 * Loads assets then starts GameScene with the editor's map data.
 * (GameScene handles tilemap injection from MapData itself.)
 */
class EditorBootScene extends Phaser.Scene {
  static pendingMapData: MapData

  constructor() {
    super({ key: 'EditorBootScene' })
  }

  preload(): void {
    for (const tile of getAllTiles()) {
      this.load.image(tile.key, tile.url)
    }
    for (const sprite of getAllSprites()) {
      this.load.image(sprite.key, sprite.url)
    }
    this.load.image('stairs_straight', 'assets/tilesets/stairs_straight.png')
    this.load.image('dialog-box', 'assets/ui/dialog-box.png')
  }

  create(): void {
    normalizeTileTextures(this)
    normalizeSpriteTextures(this)
    const mapData = EditorBootScene.pendingMapData
    this.scene.start(SCENE.GAME, {
      mapId: mapData.id,
      mapData,
    })
  }
}

/**
 * Stub menu scene for test mode — ESC dispatches stop event.
 */
class EditorMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.MENU })
  }

  create(): void {
    document.dispatchEvent(new CustomEvent('editor-stop-test'))
  }
}

/**
 * Stub transition scene (no map switching in test mode).
 */
class EditorTransitionScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.TRANSITION })
  }

  create(): void {
    this.add.text(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2,
      'Map transition not available in test mode.\nPress ESC to return to editor.',
      {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        align: 'center',
        backgroundColor: '#000000cc',
        padding: { x: 16, y: 12 },
      }
    ).setOrigin(0.5)

    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    escKey.on('down', () => {
      document.dispatchEvent(new CustomEvent('editor-stop-test'))
    })
  }
}

export class TestMode {
  private state: EditorState
  private game: Phaser.Game | null = null
  private active = false
  private listeners: (() => void)[] = []
  private stopHandler: () => void
  private savedChallenges: string[] = []

  constructor(state: EditorState) {
    this.state = state
    this.stopHandler = () => this.stop()
  }

  isActive(): boolean {
    return this.active
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  start(): boolean {
    if (this.active) return false

    const spawn = this.state.snapshot.playerSpawn
    if (!spawn) {
      alert('Place a player spawn point before testing!')
      return false
    }

    const mapData = this.buildMapData(spawn)

    // Back up and clear completed challenges so test mode starts fresh
    this.savedChallenges = saveManager.getCompletedChallenges()
    saveManager.setCompletedChallenges([])

    this.setEditorVisible(false)
    this.createTestContainer(mapData)
    document.addEventListener('editor-stop-test', this.stopHandler)

    EditorBootScene.pendingMapData = mapData
    this.game = this.createPhaserGame()

    this.active = true
    this.emit()
    return true
  }

  private buildMapData(spawn: { tileX: number; tileY: number; facing: string }): MapData {
    const d = this.state.snapshot
    return {
      id: d.mapId || 'test-map',
      name: d.mapName || 'Test Map',
      width: d.mapWidth,
      height: d.mapHeight,
      groundLayer: [...d.groundLayer],
      wallsLayer: [...d.wallsLayer],
      wallsCollision: [...d.wallsCollision],
      playerStart: {
        tileX: spawn.tileX,
        tileY: spawn.tileY,
        facing: spawn.facing as Direction,
      },
      npcs: d.npcs.map(n => ({ ...n })),
      requiredChallenges: d.npcs
        .flatMap(n => n.challengeIds ?? []),
      tileEffects: this.buildTileEffects(d.effectsLayer),
      stairs: d.stairs.map(s => ({ ...s })),
      teleports: d.teleports.map(t => ({ ...t })),
      blocks: d.blocks.map(b => ({ ...b })),
      hearts: d.hearts.map(h => ({ ...h })),
      startingHp: d.startingHp || undefined,
    }
  }

  private buildTileEffects(effectsLayer: number[]): TileEffectData[] {
    const effects: TileEffectData[] = []
    const idToEffect: Record<number, { effect: 'ice' | 'redirect' | 'hole' | 'ledge'; direction?: Direction }> = {
      [EffectId.Ice]: { effect: 'ice' },
      [EffectId.RedirectDown]: { effect: 'redirect', direction: 'down' },
      [EffectId.RedirectUp]: { effect: 'redirect', direction: 'up' },
      [EffectId.RedirectLeft]: { effect: 'redirect', direction: 'left' },
      [EffectId.RedirectRight]: { effect: 'redirect', direction: 'right' },
      [EffectId.Hole]: { effect: 'hole' },
      [EffectId.LedgeDown]: { effect: 'ledge', direction: 'down' },
      [EffectId.LedgeUp]: { effect: 'ledge', direction: 'up' },
      [EffectId.LedgeLeft]: { effect: 'ledge', direction: 'left' },
      [EffectId.LedgeRight]: { effect: 'ledge', direction: 'right' },
    }
    const mW = this.state.snapshot.mapWidth
    const mH = this.state.snapshot.mapHeight
    for (let y = 0; y < mH; y++) {
      for (let x = 0; x < mW; x++) {
        const eid = effectsLayer[y * mW + x]
        const info = idToEffect[eid]
        if (info) {
          effects.push({ tileX: x, tileY: y, ...info })
        }
      }
    }
    return effects
  }

  private createTestContainer(mapData: MapData): void {
    const container = document.createElement('div')
    container.id = 'test-game-container'
    container.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#1a1a2e;display:flex;align-items:center;justify-content:center;'
    document.body.appendChild(container)

    const bar = document.createElement('div')
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1001;background:#661111;color:#fff;font-family:monospace;font-size:13px;padding:6px 16px;display:flex;align-items:center;justify-content:space-between;'
    const label = document.createElement('span')
    label.textContent = 'TEST MODE — Playing: ' + (mapData.name || mapData.id)
    bar.appendChild(label)
    const stopBtn = document.createElement('button')
    stopBtn.textContent = 'Stop (ESC)'
    stopBtn.style.cssText = 'background:#aa2222;border:1px solid #cc4444;color:#fff;font-family:monospace;font-size:12px;padding:3px 12px;cursor:pointer;border-radius:3px;'
    stopBtn.addEventListener('click', () => this.stop())
    bar.appendChild(stopBtn)
    container.appendChild(bar)

    const gameDiv = document.createElement('div')
    gameDiv.id = 'test-game'
    gameDiv.style.cssText = 'margin-top:36px;'
    container.appendChild(gameDiv)
  }

  private createPhaserGame(): Phaser.Game {
    return new Phaser.Game({
      type: Phaser.AUTO,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#1a1a2e',
      parent: 'test-game',
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      input: {
        keyboard: {
          target: window,
        },
      },
      scene: [EditorBootScene, EditorMenuScene, GameScene, DialogScene, ChallengeScene, EditorTransitionScene],
    })
  }

  stop(): void {
    if (!this.active) return

    document.removeEventListener('editor-stop-test', this.stopHandler)

    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }

    const container = document.getElementById('test-game-container')
    if (container) container.remove()

    // Restore original challenge state
    saveManager.setCompletedChallenges(this.savedChallenges)

    this.setEditorVisible(true)

    this.active = false
    this.emit()
  }

  private setEditorVisible(visible: boolean): void {
    const display = visible ? '' : 'none'
    const els = ['toolbar', 'main', 'status-bar']
    for (const id of els) {
      const el = document.getElementById(id)
      if (el) el.style.display = display
    }
  }
}
