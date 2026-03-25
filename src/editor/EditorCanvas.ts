import type { EditorState } from './EditorState'
import type { UndoManager } from './UndoManager'
import { loadAllTileImages, getTileImage } from './tileImageCache'
import { MoverTool } from './MoverTool'
import { EntityRenderer } from './EntityRenderer'

const TILE_SIZE = 32

// ── Colors ──
const COL_BG = '#111119'
const COL_GRID = 'rgba(255,255,255,0.1)'
const COL_HOVER = 'rgba(255, 221, 68, 0.6)'
const COL_EFFECT_ICE = 'rgba(68, 136, 204, 0.45)'
const COL_EFFECT_REDIRECT = 'rgba(204, 136, 68, 0.45)'
const COL_EFFECT_TEXT = '#fff'

export class EditorCanvas {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: EditorState
  private undo: UndoManager
  private imagesLoaded = false
  private painting = false
  private lastPaintTile: { x: number; y: number } | null = null
  private mover: MoverTool
  private entityRenderer: EntityRenderer

  constructor(container: HTMLElement, state: EditorState, undo: UndoManager) {
    this.state = state
    this.undo = undo
    this.mover = new MoverTool(state, undo)
    this.entityRenderer = new EntityRenderer()

    this.canvas = document.createElement('canvas')
    this.canvas.style.cursor = 'crosshair'
    container.appendChild(this.canvas)

    this.ctx = this.canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false

    loadAllTileImages().then(() => {
      this.imagesLoaded = true
      this.render()
    }).catch(err => console.error('EditorCanvas: failed to load images', err))

    let prevW = this.state.snapshot.mapWidth
    let prevH = this.state.snapshot.mapHeight
    let prevZ = this.state.snapshot.zoom
    this.state.onChange(() => {
      if (this.state.snapshot.activeTool !== 'mover') this.mover.reset()
      if (this.state.snapshot.activeLayer !== 'walls' && this.state.snapshot.selectedWallTile) {
        this.state.mutateQuiet(d => { d.selectedWallTile = null })
      }
      const { mapWidth, mapHeight, zoom } = this.state.snapshot
      if (mapWidth !== prevW || mapHeight !== prevH || zoom !== prevZ) {
        prevW = mapWidth
        prevH = mapHeight
        prevZ = zoom
        this.updateSize()
      }
      this.render()
    })
    this.bindEvents()
    this.updateSize()
  }

  updateSize(): void {
    const { zoom, mapWidth, mapHeight } = this.state.snapshot
    this.canvas.width = mapWidth * TILE_SIZE * zoom
    this.canvas.height = mapHeight * TILE_SIZE * zoom
    this.ctx.imageSmoothingEnabled = false
    this.render()
  }

  private tileFromMouse(e: MouseEvent): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect()
    const { zoom, mapWidth, mapHeight } = this.state.snapshot
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / (TILE_SIZE * zoom))
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / (TILE_SIZE * zoom))
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return null
    return { x, y }
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      const tile = this.tileFromMouse(e)
      if (!tile) return

      const d = this.state.snapshot

      // Right-click: toggle wall collision or delete entity
      if (e.button === 2) {
        e.preventDefault()
        if (d.activeLayer === 'walls') {
          const wallTile = this.state.getTile('walls', tile.x, tile.y)
          if (wallTile !== '') {
            this.undo.save()
            this.state.toggleWallCollision(tile.x, tile.y)
            this.state.emit()
            this.undo.save()
            return
          }
        }
        const entity = this.state.findEntityAt(tile.x, tile.y)
        if (entity) {
          this.undo.save()
          this.state.mutateQuiet(md => {
            if (entity.type === 'player') {
              md.playerSpawn = null
            } else if (entity.type === 'npc') {
              md.npcs.splice(entity.index, 1)
            } else if (entity.type === 'stair') {
              md.stairs.splice(entity.index, 1)
            } else if (entity.type === 'teleport') {
              md.teleports.splice(entity.index, 1)
            } else if (entity.type === 'block') {
              md.blocks.splice(entity.index, 1)
            } else if (entity.type === 'heart') {
              md.hearts.splice(entity.index, 1)
            }
          })
          this.state.deselectEntity()
          this.undo.save()
        }
        return
      }

      // Entity placement mode
      if (d.placingEntity) {
        const existing = this.state.findEntityAt(tile.x, tile.y)
        if (existing) {
          this.state.selectEntity(existing.type, existing.index)
          this.state.mutate(md => { md.placingEntity = null })
          return
        }
        this.undo.save()
        if (d.placingEntity === 'player') {
          this.state.mutateQuiet(md => {
            md.playerSpawn = { tileX: tile.x, tileY: tile.y, facing: 'down' }
          })
          this.state.selectEntity('player', 0)
        } else if (d.placingEntity === 'npc') {
          this.state.mutateQuiet(md => {
            const existingNames = new Set(md.npcs.map(n => n.name))
            let name = 'NPC'
            let counter = 1
            while (existingNames.has(name)) {
              counter++
              name = `NPC ${counter}`
            }
            md.npcs.push({
              name,
              tileX: tile.x,
              tileY: tile.y,
              spriteKey: 'npc',
              facing: 'down',
              behavior: 'static',
            })
          })
          this.state.selectEntity('npc', this.state.snapshot.npcs.length - 1)
        } else if (d.placingEntity === 'stair') {
          this.state.mutateQuiet(md => {
            md.stairs.push({ tileX: tile.x, tileY: tile.y, targetFloorId: null })
          })
          this.state.selectEntity('stair', this.state.snapshot.stairs.length - 1)
        } else if (d.placingEntity === 'teleport') {
          this.state.mutateQuiet(md => {
            const existingIds = new Set(md.teleports.map(t => t.id))
            let id = 'tp-1'
            let counter = 1
            while (existingIds.has(id)) {
              counter++
              id = `tp-${counter}`
            }
            md.teleports.push({ id, tileX: tile.x, tileY: tile.y, role: 'sender' })
          })
          this.state.selectEntity('teleport', this.state.snapshot.teleports.length - 1)
        } else if (d.placingEntity === 'block') {
          this.state.mutateQuiet(md => {
            md.blocks.push({ tileX: tile.x, tileY: tile.y })
          })
          this.state.selectEntity('block', this.state.snapshot.blocks.length - 1)
        } else if (d.placingEntity === 'heart') {
          this.state.mutateQuiet(md => {
            md.hearts.push({ tileX: tile.x, tileY: tile.y })
          })
          this.state.selectEntity('heart', this.state.snapshot.hearts.length - 1)
        }
        this.state.mutate(md => { md.placingEntity = null })
        this.undo.save()
        return
      }

      // Shift+click: add patrol waypoint to selected NPC
      if (e.shiftKey && d.selectedEntityType === 'npc' && d.selectedEntityIndex >= 0) {
        const npc = this.state.snapshot.npcs[d.selectedEntityIndex]
        if (npc && npc.behavior === 'patrol') {
          this.state.mutate(md => {
            const targetNpc = md.npcs[d.selectedEntityIndex]
            if (!targetNpc.patrolPath) targetNpc.patrolPath = []
            targetNpc.patrolPath.push({ x: tile.x, y: tile.y })
          })
          return
        }
      }

      // Entity tool: click to select existing
      if (d.activeTool === 'entity') {
        const entity = this.state.findEntityAt(tile.x, tile.y)
        if (entity) {
          this.state.selectEntity(entity.type, entity.index)
        } else {
          this.state.deselectEntity()
        }
        return
      }

      // Mover tool
      if (d.activeTool === 'mover') {
        this.mover.onMouseDown(tile)
        this.render()
        return
      }

      // Clear wall tile selection when clicking
      if (d.activeLayer === 'walls') {
        this.state.mutateQuiet(md => { md.selectedWallTile = null })
      }

      // Brush / eraser
      this.painting = true
      this.lastPaintTile = null
      this.undo.save()
      this.paintTile(tile)
    })

    this.canvas.addEventListener('mousemove', (e) => {
      const tile = this.tileFromMouse(e)
      this.state.mutateQuiet(d => { d.hoverTile = tile })

      // Mover drag
      if (this.state.snapshot.activeTool === 'mover' && tile) {
        const cursor = this.mover.onMouseMove(tile)
        this.canvas.style.cursor = cursor
        this.render()
        return
      }

      this.canvas.style.cursor = 'crosshair'
      if (this.painting && tile) {
        this.paintTile(tile)
      }
      this.render()
    })

    this.canvas.addEventListener('mouseup', () => {
      // Mover: finalize selection or apply move
      if (this.mover.onMouseUp()) {
        this.render()
        return
      }

      if (this.painting) {
        const painted = this.lastPaintTile
        this.painting = false
        this.lastPaintTile = null
        this.undo.save()
        if (painted && this.state.snapshot.activeLayer === 'walls') {
          const wallKey = this.state.getTile('walls', painted.x, painted.y)
          this.state.mutate(md => {
            md.selectedWallTile = wallKey !== '' ? { x: painted.x, y: painted.y } : null
          })
        }
      }
    })

    this.canvas.addEventListener('mouseleave', () => {
      this.state.mutateQuiet(d => { d.hoverTile = null })
      if (this.mover.phase === 'selecting') {
        this.mover.reset()
      }
      if (this.painting) {
        this.painting = false
        this.lastPaintTile = null
        this.undo.save()
      }
      this.render()
    })

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Escape cancels mover selection
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.snapshot.activeTool === 'mover' && this.mover.phase !== 'idle') {
        this.mover.reset()
        this.render()
      }
    })
  }

  private paintTile(tile: { x: number; y: number }): void {
    if (this.lastPaintTile && this.lastPaintTile.x === tile.x && this.lastPaintTile.y === tile.y) return
    this.lastPaintTile = tile

    const d = this.state.snapshot

    if (d.activeTool === 'brush' && d.activeLayer !== 'effects' && d.selectedTileKey === '') return

    if (d.activeLayer === 'effects') {
      const effectId = d.activeTool === 'eraser' ? 0 : d.selectedEffectId
      this.state.setTile(tile.x, tile.y, effectId)
    } else {
      const tileKey = d.activeTool === 'eraser' ? '' : d.selectedTileKey
      this.state.setTile(tile.x, tile.y, tileKey)
    }
    this.render()
  }

  render(): void {
    if (!this.imagesLoaded) return

    const ctx = this.ctx
    const z = this.state.snapshot.zoom
    const s = TILE_SIZE * z

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    ctx.fillStyle = COL_BG
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    const d = this.state.snapshot

    // Ground layer
    if (d.groundVisible) {
      const alpha = d.activeLayer === 'ground' ? 1 : d.activeLayer === 'entities' ? 0.6 : 0.4
      this.drawLayer(d.groundLayer, s, alpha)
    }

    // Walls layer
    if (d.wallsVisible) {
      const alpha = d.activeLayer === 'walls' ? 1 : d.activeLayer === 'entities' ? 0.6 : 0.4
      this.drawLayer(d.wallsLayer, s, alpha)
      this.drawCollisionOverlay(s)
    }

    // Effects layer
    if (d.effectsVisible) {
      const alpha = d.activeLayer === 'effects' ? 1 : 0.4
      this.drawEffectsLayer(d.effectsLayer, s, alpha)
    }

    // Grid lines
    const mw = d.mapWidth
    const mh = d.mapHeight
    ctx.strokeStyle = COL_GRID
    ctx.lineWidth = 1
    for (let x = 0; x <= mw; x++) {
      ctx.beginPath()
      ctx.moveTo(x * s + 0.5, 0)
      ctx.lineTo(x * s + 0.5, mh * s)
      ctx.stroke()
    }
    for (let y = 0; y <= mh; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * s + 0.5)
      ctx.lineTo(mw * s, y * s + 0.5)
      ctx.stroke()
    }

    // Entities
    if (d.entitiesVisible) {
      this.entityRenderer.draw(ctx, d, s)
    }

    // Hover highlight
    if (d.hoverTile && this.mover.phase !== 'moving') {
      ctx.strokeStyle = COL_HOVER
      ctx.lineWidth = 2
      ctx.strokeRect(d.hoverTile.x * s + 1, d.hoverTile.y * s + 1, s - 2, s - 2)
    }

    // Mover overlay
    if (d.activeTool === 'mover') {
      this.mover.drawOverlay(ctx, s, this.drawTile.bind(this), d.mapWidth)
    }
  }

  private drawLayer(layer: string[], s: number, alpha: number): void {
    const ctx = this.ctx
    const { mapWidth, mapHeight } = this.state.snapshot
    ctx.globalAlpha = alpha
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tileKey = layer[y * mapWidth + x]
        if (tileKey === '') continue
        this.drawTile(ctx, tileKey, x * s, y * s, s)
      }
    }
    ctx.globalAlpha = 1
  }

  private drawCollisionOverlay(s: number): void {
    const ctx = this.ctx
    const d = this.state.snapshot
    for (let y = 0; y < d.mapHeight; y++) {
      for (let x = 0; x < d.mapWidth; x++) {
        const idx = y * d.mapWidth + x
        if (d.wallsLayer[idx] === '' || d.wallsCollision[idx]) continue
        const dx = x * s
        const dy = y * s
        const r = Math.max(4, s * 0.15)
        ctx.fillStyle = 'rgba(68, 255, 68, 0.6)'
        ctx.beginPath()
        ctx.arc(dx + s - r - 2, dy + r + 2, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${Math.round(r * 1.2)}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('P', dx + s - r - 2, dy + r + 2)
      }
    }
  }

  private drawEffectsLayer(layer: number[], s: number, alpha: number): void {
    const ctx = this.ctx
    const { mapWidth, mapHeight } = this.state.snapshot
    ctx.globalAlpha = alpha

    const arrows: Record<number, string> = { 2: '\u2193', 3: '\u2191', 4: '\u2190', 5: '\u2192' }

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const effectId = layer[y * mapWidth + x]
        if (effectId === 0) continue

        const dx = x * s
        const dy = y * s

        if (effectId === 1) {
          ctx.fillStyle = COL_EFFECT_ICE
          ctx.fillRect(dx, dy, s, s)
          ctx.fillStyle = COL_EFFECT_TEXT
          ctx.font = `bold ${Math.round(s * 0.28)}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('ICE', dx + s / 2, dy + s / 2)
        } else if (effectId === 6) {
          ctx.fillStyle = 'rgba(34, 17, 0, 0.7)'
          ctx.fillRect(dx, dy, s, s)
          ctx.fillStyle = COL_EFFECT_TEXT
          ctx.font = `bold ${Math.round(s * 0.24)}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('HOLE', dx + s / 2, dy + s / 2)
        } else if (effectId >= 2 && effectId <= 5) {
          ctx.fillStyle = COL_EFFECT_REDIRECT
          ctx.fillRect(dx, dy, s, s)
          ctx.fillStyle = COL_EFFECT_TEXT
          ctx.font = `bold ${Math.round(s * 0.5)}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(arrows[effectId], dx + s / 2, dy + s / 2)
        }
      }
    }
    ctx.globalAlpha = 1
  }

  private drawTile(ctx: CanvasRenderingContext2D, tileKey: string, dx: number, dy: number, size: number): void {
    if (tileKey === 'objects/collision_invisible') {
      this.drawInvisibleWall(ctx, dx, dy, size)
      return
    }

    const img = getTileImage(tileKey)
    if (img) {
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, size, size)
    } else {
      ctx.fillStyle = '#ff00ff'
      ctx.fillRect(dx, dy, size, size)
      ctx.fillStyle = '#fff'
      ctx.font = `${Math.round(size * 0.2)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', dx + size / 2, dy + size / 2)
    }
  }

  private drawInvisibleWall(ctx: CanvasRenderingContext2D, dx: number, dy: number, size: number): void {
    ctx.save()
    ctx.beginPath()
    ctx.rect(dx, dy, size, size)
    ctx.clip()

    ctx.fillStyle = 'rgba(80, 20, 20, 0.4)'
    ctx.fillRect(dx, dy, size, size)
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.4)'
    ctx.lineWidth = 1
    for (let i = -size; i < size * 2; i += 8) {
      ctx.beginPath()
      ctx.moveTo(dx + i, dy)
      ctx.lineTo(dx + i + size, dy + size)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(dx + 4, dy + 4)
    ctx.lineTo(dx + size - 4, dy + size - 4)
    ctx.moveTo(dx + size - 4, dy + 4)
    ctx.lineTo(dx + 4, dy + size - 4)
    ctx.stroke()

    ctx.restore()
  }
}
