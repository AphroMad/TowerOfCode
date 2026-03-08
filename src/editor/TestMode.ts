import Phaser from 'phaser'
import type { EditorState } from './EditorState'
import type { ImportExport } from './ImportExport'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/game.config'
import { GameScene } from '@/scenes/GameScene'
import { DialogScene } from '@/scenes/DialogScene'
import { ChallengeScene } from '@/scenes/ChallengeScene'
import type { FloorData, Direction, TileEffectData } from '@/data/types'
import { MAP_W, MAP_H } from './EditorState'
import { getAllTiles } from '@/data/tiles/TileRegistry'

/**
 * Boot scene for editor test mode.
 * Loads the same assets as BootScene, injects map JSON into cache,
 * then starts GameScene with the editor's floor data.
 */
class EditorBootScene extends Phaser.Scene {
  // Static data set before Phaser game is created (avoids init timing issues)
  static pendingFloorData: FloorData
  static pendingMapJson: object

  constructor() {
    super({ key: 'EditorBootScene' })
  }

  preload(): void {
    // Load all tiles from registry
    for (const tile of getAllTiles()) {
      this.load.image(tile.key, tile.url)
    }
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 64,
      frameHeight: 64,
    })
    this.load.spritesheet('npc', 'assets/sprites/npc.png', {
      frameWidth: 64,
      frameHeight: 64,
    })
    this.load.image('stairs_straight', 'assets/tilesets/stairs_straight.png')
    this.load.image('dialog-box', 'assets/ui/dialog-box.png')
  }

  create(): void {
    const floorData = EditorBootScene.pendingFloorData
    const mapJson = EditorBootScene.pendingMapJson

    // Inject the editor's map JSON into Phaser's tilemap cache
    this.cache.tilemap.add(floorData.mapKey, {
      data: mapJson,
      format: Phaser.Tilemaps.Formats.TILED_JSON,
    })

    // Start the game scene with editor floor data
    this.scene.start('GameScene', {
      floorId: floorData.id,
      floorData,
    })
  }
}

/**
 * Stub menu scene for test mode — ESC dispatches stop event.
 */
class EditorMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
  }

  create(): void {
    // When GameScene goes to menu (ESC), stop the test
    document.dispatchEvent(new CustomEvent('editor-stop-test'))
  }
}

/**
 * Stub transition scene that just restarts GameScene (no floor switching in test mode).
 */
class EditorTransitionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TransitionScene' })
  }

  create(): void {
    // In test mode, floor transitions aren't supported — just show a message
    const text = this.add.text(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2,
      'Floor transition not available in test mode.\nPress ESC to return to editor.',
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

    // Auto-return after 3 seconds
    this.time.delayedCall(3000, () => {
      text.destroy()
      document.dispatchEvent(new CustomEvent('editor-stop-test'))
    })
  }
}

export class TestMode {
  private state: EditorState
  private io: ImportExport
  private game: Phaser.Game | null = null
  private active = false
  private listeners: (() => void)[] = []
  private stopHandler: () => void

  constructor(state: EditorState, io: ImportExport) {
    this.state = state
    this.io = io
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

    const floorData = this.buildFloorData(spawn)
    const mapJson = JSON.parse(this.io.exportMapJson())

    this.setEditorVisible(false)
    this.createTestContainer(floorData)
    document.addEventListener('editor-stop-test', this.stopHandler)

    EditorBootScene.pendingFloorData = floorData
    EditorBootScene.pendingMapJson = mapJson
    this.game = this.createPhaserGame()

    this.active = true
    this.emit()
    return true
  }

  private buildFloorData(spawn: { tileX: number; tileY: number; facing: string }): FloorData {
    const d = this.state.snapshot
    return {
      id: d.floorId || 'test-floor',
      name: d.floorName || 'Test Floor',
      mapKey: 'editor-test-map',
      playerStart: {
        tileX: spawn.tileX,
        tileY: spawn.tileY,
        facing: spawn.facing as Direction,
      },
      npcs: d.npcs.map(n => ({ ...n })),
      requiredChallenges: d.npcs
        .map(n => n.challengeId)
        .filter((id): id is string => !!id),
      tileEffects: this.buildTileEffects(d.effectsLayer),
      stairs: d.stairs.map(s => ({ ...s })),
    }
  }

  private buildTileEffects(effectsLayer: number[]): TileEffectData[] {
    const effects: TileEffectData[] = []
    const idToEffect: Record<number, { effect: 'ice' | 'redirect'; direction?: Direction }> = {
      1: { effect: 'ice' },
      2: { effect: 'redirect', direction: 'down' },
      3: { effect: 'redirect', direction: 'up' },
      4: { effect: 'redirect', direction: 'left' },
      5: { effect: 'redirect', direction: 'right' },
    }
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const eid = effectsLayer[y * MAP_W + x]
        const info = idToEffect[eid]
        if (info) {
          effects.push({ tileX: x, tileY: y, ...info })
        }
      }
    }
    return effects
  }

  private createTestContainer(floorData: FloorData): void {
    const container = document.createElement('div')
    container.id = 'test-game-container'
    container.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#1a1a2e;display:flex;align-items:center;justify-content:center;'
    document.body.appendChild(container)

    const bar = document.createElement('div')
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1001;background:#661111;color:#fff;font-family:monospace;font-size:13px;padding:6px 16px;display:flex;align-items:center;justify-content:space-between;'
    const label = document.createElement('span')
    label.textContent = 'TEST MODE — Playing: ' + (floorData.name || floorData.id)
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

    // Destroy Phaser game
    if (this.game) {
      this.game.destroy(true)
      this.game = null
    }

    // Remove game container
    const container = document.getElementById('test-game-container')
    if (container) container.remove()

    // Show editor UI
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
