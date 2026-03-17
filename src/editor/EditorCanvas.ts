import type { EditorState } from './EditorState'
import type { UndoManager } from './UndoManager'
import { loadAllTileImages, getTileImage } from './tileImageCache'

const TILE_SIZE = 32

// ── Entity rendering ratios ──
const ENTITY_PAD = 0.25
const FONT_LG = 0.35
const FONT_MD = 0.3
const FONT_SM = 0.22
const SIGHT_ARROW_LEN = 0.4
const WAYPOINT_DOT_MIN = 6
const WAYPOINT_DOT_RATIO = 0.15
const ENTITY_ALPHA = 0.7

// ── Colors ──
const COL_PLAYER = '#22cc22'
const COL_PLAYER_SEL = '#44ff44'
const COL_NPC_CHALLENGE = '#44cc44'
const COL_NPC_PLAIN = '#ccaa44'
const COL_WARP = '#aa66ff'
const COL_WARP_SEL = '#cc88ff'
const COL_TELEPORT = '#ff6688'
const COL_TELEPORT_SEL = '#ff88aa'
const COL_SELECTION = '#ffffff'
const COL_BG = '#111119'
const COL_GRID = 'rgba(255,255,255,0.1)'
const COL_HOVER = 'rgba(255, 221, 68, 0.6)'
const COL_SIGHT_FILL = 'rgba(255, 80, 80, 0.15)'
const COL_SIGHT_ARROW = 'rgba(255, 80, 80, 0.6)'
const COL_PATROL_LINE = 'rgba(100, 200, 255, 0.5)'
const COL_PATROL_DOT = 'rgba(100, 200, 255, 0.7)'
const COL_EFFECT_ICE = 'rgba(68, 136, 204, 0.45)'
const COL_EFFECT_REDIRECT = 'rgba(204, 136, 68, 0.45)'
const COL_EFFECT_TEXT = '#fff'
const COL_MOVER_SEL = 'rgba(68, 170, 255, 0.8)'
const COL_MOVER_FILL = 'rgba(68, 170, 255, 0.15)'
const COL_MOVER_ORIGIN = 'rgba(255, 100, 100, 0.4)'
const COL_MOVER_DEST = 'rgba(68, 255, 68, 0.8)'

export class EditorCanvas {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: EditorState
  private undo: UndoManager
  private imagesLoaded = false
  private painting = false
  private lastPaintTile: { x: number; y: number } | null = null

  // Mover tool state
  private moverPhase: 'idle' | 'selecting' | 'selected' | 'moving' = 'idle'
  private moverSelStart: { x: number; y: number } | null = null
  private moverSelEnd: { x: number; y: number } | null = null
  private moverRect: { x: number; y: number; w: number; h: number } | null = null
  private moverTiles: string[] = []        // ground
  private moverWalls: string[] = []        // walls
  private moverCollision: boolean[] = []   // wallsCollision
  private moverEffects: number[] = []      // effects
  private moverEntities: { type: 'player' | 'npc' | 'stair' | 'teleport' | 'block' | 'heart'; localX: number; localY: number }[] = []
  private moverDragStart: { x: number; y: number } | null = null
  private moverOffset = { dx: 0, dy: 0 }

  constructor(container: HTMLElement, state: EditorState, undo: UndoManager) {
    this.state = state
    this.undo = undo

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
      if (this.state.snapshot.activeTool !== 'mover') this.resetMover()
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
        // Toggle collision on wall tiles
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
        // Prevent placing on occupied cell
        const existing = this.state.findEntityAt(tile.x, tile.y)
        if (existing) {
          // Select the existing entity instead
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
            // Generate a unique default name
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
            md.stairs.push({
              tileX: tile.x,
              tileY: tile.y,
              targetFloorId: null,
            })
          })
          this.state.selectEntity('stair', this.state.snapshot.stairs.length - 1)
        } else if (d.placingEntity === 'teleport') {
          this.state.mutateQuiet(md => {
            // Generate unique id
            const existingIds = new Set(md.teleports.map(t => t.id))
            let id = 'tp-1'
            let counter = 1
            while (existingIds.has(id)) {
              counter++
              id = `tp-${counter}`
            }
            md.teleports.push({
              id,
              tileX: tile.x,
              tileY: tile.y,
              role: 'sender',
            })
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

      // Mover tool (moves ALL layers at once)
      if (d.activeTool === 'mover') {
        if (this.moverPhase === 'idle' || this.moverPhase === 'selecting') {
          this.moverPhase = 'selecting'
          this.moverSelStart = { x: tile.x, y: tile.y }
          this.moverSelEnd = { x: tile.x, y: tile.y }
          this.moverRect = null
          this.moverTiles = []
          this.render()
        } else if (this.moverPhase === 'selected' && this.moverRect) {
          const r = this.moverRect
          if (tile.x >= r.x && tile.x < r.x + r.w && tile.y >= r.y && tile.y < r.y + r.h) {
            this.moverPhase = 'moving'
            this.moverDragStart = { x: tile.x, y: tile.y }
            this.moverOffset = { dx: 0, dy: 0 }
            this.undo.save()
          } else {
            this.moverPhase = 'selecting'
            this.moverSelStart = { x: tile.x, y: tile.y }
            this.moverSelEnd = { x: tile.x, y: tile.y }
            this.moverRect = null
            this.moverTiles = []
            this.render()
          }
        }
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
        if (this.moverPhase === 'selecting' && this.moverSelStart) {
          this.moverSelEnd = { x: tile.x, y: tile.y }
        } else if (this.moverPhase === 'moving' && this.moverDragStart) {
          this.moverOffset = {
            dx: tile.x - this.moverDragStart.x,
            dy: tile.y - this.moverDragStart.y,
          }
        }
        // Update cursor
        if (this.moverPhase === 'moving') {
          this.canvas.style.cursor = 'grabbing'
        } else if (this.moverPhase === 'selected' && this.moverRect) {
          const r = this.moverRect
          if (tile.x >= r.x && tile.x < r.x + r.w && tile.y >= r.y && tile.y < r.y + r.h) {
            this.canvas.style.cursor = 'grab'
          } else {
            this.canvas.style.cursor = 'crosshair'
          }
        } else {
          this.canvas.style.cursor = 'crosshair'
        }
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
      if (this.moverPhase === 'selecting' && this.moverSelStart && this.moverSelEnd) {
        const x1 = Math.min(this.moverSelStart.x, this.moverSelEnd.x)
        const y1 = Math.min(this.moverSelStart.y, this.moverSelEnd.y)
        const x2 = Math.max(this.moverSelStart.x, this.moverSelEnd.x)
        const y2 = Math.max(this.moverSelStart.y, this.moverSelEnd.y)
        const w = x2 - x1 + 1
        const h = y2 - y1 + 1

        // Capture all layers
        const d2 = this.state.snapshot
        const mW = d2.mapWidth
        this.moverTiles = []
        this.moverWalls = []
        this.moverCollision = []
        this.moverEffects = []
        this.moverEntities = []
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            const idx = (y1 + row) * mW + (x1 + col)
            this.moverTiles.push(d2.groundLayer[idx])
            this.moverWalls.push(d2.wallsLayer[idx])
            this.moverCollision.push(d2.wallsCollision[idx])
            this.moverEffects.push(d2.effectsLayer[idx])
          }
        }
        // Capture entities in selection
        if (d2.playerSpawn && d2.playerSpawn.tileX >= x1 && d2.playerSpawn.tileX <= x2
            && d2.playerSpawn.tileY >= y1 && d2.playerSpawn.tileY <= y2) {
          this.moverEntities.push({ type: 'player', localX: d2.playerSpawn.tileX - x1, localY: d2.playerSpawn.tileY - y1 })
        }
        for (const npc of d2.npcs) {
          if (npc.tileX >= x1 && npc.tileX <= x2 && npc.tileY >= y1 && npc.tileY <= y2) {
            this.moverEntities.push({ type: 'npc', localX: npc.tileX - x1, localY: npc.tileY - y1 })
          }
        }
        for (const stair of d2.stairs) {
          if (stair.tileX >= x1 && stair.tileX <= x2 && stair.tileY >= y1 && stair.tileY <= y2) {
            this.moverEntities.push({ type: 'stair', localX: stair.tileX - x1, localY: stair.tileY - y1 })
          }
        }
        for (const tp of d2.teleports) {
          if (tp.tileX >= x1 && tp.tileX <= x2 && tp.tileY >= y1 && tp.tileY <= y2) {
            this.moverEntities.push({ type: 'teleport', localX: tp.tileX - x1, localY: tp.tileY - y1 })
          }
        }
        for (const block of d2.blocks) {
          if (block.tileX >= x1 && block.tileX <= x2 && block.tileY >= y1 && block.tileY <= y2) {
            this.moverEntities.push({ type: 'block', localX: block.tileX - x1, localY: block.tileY - y1 })
          }
        }
        for (const heart of d2.hearts) {
          if (heart.tileX >= x1 && heart.tileX <= x2 && heart.tileY >= y1 && heart.tileY <= y2) {
            this.moverEntities.push({ type: 'heart', localX: heart.tileX - x1, localY: heart.tileY - y1 })
          }
        }

        const hasContent = this.moverTiles.some(t => t !== '')
          || this.moverWalls.some(t => t !== '')
          || this.moverEffects.some(e => e !== 0)
          || this.moverEntities.length > 0
        if (hasContent) {
          this.moverRect = { x: x1, y: y1, w, h }
          this.moverPhase = 'selected'
        } else {
          this.resetMover()
        }
        this.render()
        return
      }

      if (this.moverPhase === 'moving' && this.moverRect) {
        const r = this.moverRect
        const { dx, dy } = this.moverOffset

        if (dx === 0 && dy === 0) {
          this.moverPhase = 'selected'
          this.render()
          return
        }

        // Clear old positions, write new positions (ALL layers)
        const mW2 = this.state.snapshot.mapWidth
        const mH2 = this.state.snapshot.mapHeight
        this.state.mutateQuiet(d => {
          // Clear source tiles (all layers)
          for (let row = 0; row < r.h; row++) {
            for (let col = 0; col < r.w; col++) {
              const ox = r.x + col
              const oy = r.y + row
              if (ox >= 0 && ox < mW2 && oy >= 0 && oy < mH2) {
                const idx = oy * mW2 + ox
                d.groundLayer[idx] = ''
                d.wallsLayer[idx] = ''
                d.wallsCollision[idx] = true
                d.effectsLayer[idx] = 0
              }
            }
          }
          // Write destination tiles (all layers)
          for (let row = 0; row < r.h; row++) {
            for (let col = 0; col < r.w; col++) {
              const nx = r.x + col + dx
              const ny = r.y + row + dy
              if (nx >= 0 && nx < mW2 && ny >= 0 && ny < mH2) {
                const idx = ny * mW2 + nx
                const si = row * r.w + col
                d.groundLayer[idx] = this.moverTiles[si]
                d.wallsLayer[idx] = this.moverWalls[si]
                d.wallsCollision[idx] = this.moverCollision[si]
                d.effectsLayer[idx] = this.moverEffects[si]
              }
            }
          }
          // Move entities
          for (const ent of this.moverEntities) {
            const newX = r.x + ent.localX + dx
            const newY = r.y + ent.localY + dy
            if (newX < 0 || newX >= mW2 || newY < 0 || newY >= mH2) continue
            if (ent.type === 'player' && d.playerSpawn) {
              d.playerSpawn.tileX = newX
              d.playerSpawn.tileY = newY
            } else if (ent.type === 'npc') {
              const npc = d.npcs.find(n => n.tileX === r.x + ent.localX && n.tileY === r.y + ent.localY)
              if (npc) {
                // Also shift patrol path
                if (npc.patrolPath) {
                  for (const p of npc.patrolPath) {
                    p.x += dx
                    p.y += dy
                  }
                }
                npc.tileX = newX
                npc.tileY = newY
              }
            } else if (ent.type === 'stair') {
              const stair = d.stairs.find(s => s.tileX === r.x + ent.localX && s.tileY === r.y + ent.localY)
              if (stair) {
                stair.tileX = newX
                stair.tileY = newY
              }
            } else if (ent.type === 'teleport') {
              const tp = d.teleports.find(t => t.tileX === r.x + ent.localX && t.tileY === r.y + ent.localY)
              if (tp) {
                tp.tileX = newX
                tp.tileY = newY
              }
            } else if (ent.type === 'block') {
              const block = d.blocks.find(b => b.tileX === r.x + ent.localX && b.tileY === r.y + ent.localY)
              if (block) {
                block.tileX = newX
                block.tileY = newY
              }
            } else if (ent.type === 'heart') {
              const heart = d.hearts.find(h => h.tileX === r.x + ent.localX && h.tileY === r.y + ent.localY)
              if (heart) {
                heart.tileX = newX
                heart.tileY = newY
              }
            }
          }
        })

        this.undo.save()

        // Update selection to new position and re-capture all layers
        this.moverRect = { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }
        const snap = this.state.snapshot
        const nr = this.moverRect
        this.moverTiles = []
        this.moverWalls = []
        this.moverCollision = []
        this.moverEffects = []
        this.moverEntities = []
        for (let row = 0; row < nr.h; row++) {
          for (let col = 0; col < nr.w; col++) {
            const nx = nr.x + col
            const ny = nr.y + row
            const inBounds = nx >= 0 && nx < mW2 && ny >= 0 && ny < mH2
            const idx = inBounds ? ny * mW2 + nx : -1
            this.moverTiles.push(inBounds ? snap.groundLayer[idx] : '')
            this.moverWalls.push(inBounds ? snap.wallsLayer[idx] : '')
            this.moverCollision.push(inBounds ? snap.wallsCollision[idx] : true)
            this.moverEffects.push(inBounds ? snap.effectsLayer[idx] : 0)
          }
        }
        // Re-capture entities at new positions
        if (snap.playerSpawn && snap.playerSpawn.tileX >= nr.x && snap.playerSpawn.tileX < nr.x + nr.w
            && snap.playerSpawn.tileY >= nr.y && snap.playerSpawn.tileY < nr.y + nr.h) {
          this.moverEntities.push({ type: 'player', localX: snap.playerSpawn.tileX - nr.x, localY: snap.playerSpawn.tileY - nr.y })
        }
        for (const npc of snap.npcs) {
          if (npc.tileX >= nr.x && npc.tileX < nr.x + nr.w && npc.tileY >= nr.y && npc.tileY < nr.y + nr.h) {
            this.moverEntities.push({ type: 'npc', localX: npc.tileX - nr.x, localY: npc.tileY - nr.y })
          }
        }
        for (const stair of snap.stairs) {
          if (stair.tileX >= nr.x && stair.tileX < nr.x + nr.w && stair.tileY >= nr.y && stair.tileY < nr.y + nr.h) {
            this.moverEntities.push({ type: 'stair', localX: stair.tileX - nr.x, localY: stair.tileY - nr.y })
          }
        }
        for (const tp of snap.teleports) {
          if (tp.tileX >= nr.x && tp.tileX < nr.x + nr.w && tp.tileY >= nr.y && tp.tileY < nr.y + nr.h) {
            this.moverEntities.push({ type: 'teleport', localX: tp.tileX - nr.x, localY: tp.tileY - nr.y })
          }
        }
        for (const block of snap.blocks) {
          if (block.tileX >= nr.x && block.tileX < nr.x + nr.w && block.tileY >= nr.y && block.tileY < nr.y + nr.h) {
            this.moverEntities.push({ type: 'block', localX: block.tileX - nr.x, localY: block.tileY - nr.y })
          }
        }
        for (const heart of snap.hearts) {
          if (heart.tileX >= nr.x && heart.tileX < nr.x + nr.w && heart.tileY >= nr.y && heart.tileY < nr.y + nr.h) {
            this.moverEntities.push({ type: 'heart', localX: heart.tileX - nr.x, localY: heart.tileY - nr.y })
          }
        }
        this.moverPhase = 'selected'
        this.moverDragStart = null
        this.moverOffset = { dx: 0, dy: 0 }
        this.state.emit()
        return
      }

      if (this.painting) {
        const painted = this.lastPaintTile
        this.painting = false
        this.lastPaintTile = null
        this.undo.save()
        // Select wall tile after single-tile paint/click
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
      if (this.moverPhase === 'selecting') {
        this.resetMover()
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
      if (e.key === 'Escape' && this.state.snapshot.activeTool === 'mover' && this.moverPhase !== 'idle') {
        this.resetMover()
        this.render()
      }
    })
  }

  private paintTile(tile: { x: number; y: number }): void {
    if (this.lastPaintTile && this.lastPaintTile.x === tile.x && this.lastPaintTile.y === tile.y) return
    this.lastPaintTile = tile

    const d = this.state.snapshot

    // Don't paint if no tile is selected (brush with empty key = no-op)
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

    // Background
    ctx.fillStyle = COL_BG
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    const d = this.state.snapshot

    // Draw ground layer
    if (d.groundVisible) {
      const alpha = d.activeLayer === 'ground' ? 1 : d.activeLayer === 'entities' ? 0.6 : 0.4
      this.drawLayer(d.groundLayer, s, alpha)
    }

    // Draw walls layer
    if (d.wallsVisible) {
      const alpha = d.activeLayer === 'walls' ? 1 : d.activeLayer === 'entities' ? 0.6 : 0.4
      this.drawLayer(d.wallsLayer, s, alpha)
      this.drawCollisionOverlay(s)
    }

    // Draw effects layer
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
      this.drawEntities(s)
    }

    // Hover highlight (hide during mover moving phase)
    if (d.hoverTile && this.moverPhase !== 'moving') {
      ctx.strokeStyle = COL_HOVER
      ctx.lineWidth = 2
      ctx.strokeRect(d.hoverTile.x * s + 1, d.hoverTile.y * s + 1, s - 2, s - 2)
    }

    // Mover overlay
    if (d.activeTool === 'mover') {
      this.drawMoverOverlay(s)
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
          // Ice
          ctx.fillStyle = COL_EFFECT_ICE
          ctx.fillRect(dx, dy, s, s)
          ctx.fillStyle = COL_EFFECT_TEXT
          ctx.font = `bold ${Math.round(s * 0.28)}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('ICE', dx + s / 2, dy + s / 2)
        } else if (effectId === 6) {
          // Hole
          ctx.fillStyle = 'rgba(34, 17, 0, 0.7)'
          ctx.fillRect(dx, dy, s, s)
          ctx.fillStyle = COL_EFFECT_TEXT
          ctx.font = `bold ${Math.round(s * 0.24)}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('HOLE', dx + s / 2, dy + s / 2)
        } else if (effectId >= 2 && effectId <= 5) {
          // Redirect
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
    // Special case: invisible wall — procedural red-hatch overlay
    if (tileKey === 'objects/collision_invisible') {
      this.drawInvisibleWall(ctx, dx, dy, size)
      return
    }

    const img = getTileImage(tileKey)
    if (img) {
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, size, size)
    } else {
      // Fallback: pink square for missing tile
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

  private drawEntities(s: number): void {
    const ctx = this.ctx
    const d = this.state.snapshot
    const pad = Math.round(s * ENTITY_PAD)

    // Player spawn — green square with "S"
    if (d.playerSpawn) {
      const x = d.playerSpawn.tileX * s
      const y = d.playerSpawn.tileY * s
      const selected = d.selectedEntityType === 'player'

      ctx.globalAlpha = ENTITY_ALPHA
      ctx.fillStyle = selected ? COL_PLAYER_SEL : COL_PLAYER
      ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2)
      ctx.globalAlpha = 1

      ctx.strokeStyle = selected ? COL_SELECTION : COL_PLAYER
      ctx.lineWidth = 2
      ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2)

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(s * FONT_LG)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('S', x + s / 2, y + s / 2)
    }

    // NPCs — green if has challenge, yellow otherwise
    for (let i = 0; i < d.npcs.length; i++) {
      const npc = d.npcs[i]
      const x = npc.tileX * s
      const y = npc.tileY * s
      const selected = d.selectedEntityType === 'npc' && d.selectedEntityIndex === i
      const color = npc.challengeId ? COL_NPC_CHALLENGE : COL_NPC_PLAIN

      ctx.globalAlpha = ENTITY_ALPHA
      ctx.fillStyle = color
      ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2)
      ctx.globalAlpha = 1

      ctx.strokeStyle = selected ? COL_SELECTION : color
      ctx.lineWidth = 2
      ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2)

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(s * FONT_MD)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(npc.challengeId ? 'C' : 'N', x + s / 2, y + s / 2)
    }

    // Warp points — purple square with "W"
    for (let i = 0; i < d.stairs.length; i++) {
      const stair = d.stairs[i]
      const x = stair.tileX * s
      const y = stair.tileY * s
      const selected = d.selectedEntityType === 'stair' && d.selectedEntityIndex === i

      ctx.globalAlpha = ENTITY_ALPHA
      ctx.fillStyle = selected ? COL_WARP_SEL : COL_WARP
      ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2)
      ctx.globalAlpha = 1

      ctx.strokeStyle = selected ? COL_SELECTION : COL_WARP
      ctx.lineWidth = 2
      ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2)

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(s * FONT_MD)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('W', x + s / 2, y + s / 2)
    }

    // Teleport points — pink for senders, cyan for receivers
    const COL_RECEIVER = '#44cccc'
    const COL_RECEIVER_SEL = '#66eeee'
    for (let i = 0; i < d.teleports.length; i++) {
      const tp = d.teleports[i]
      const x = tp.tileX * s
      const y = tp.tileY * s
      const selected = d.selectedEntityType === 'teleport' && d.selectedEntityIndex === i
      const isSender = tp.role === 'sender'
      const col = isSender ? COL_TELEPORT : COL_RECEIVER
      const colSel = isSender ? COL_TELEPORT_SEL : COL_RECEIVER_SEL

      ctx.globalAlpha = ENTITY_ALPHA
      ctx.fillStyle = selected ? colSel : col
      ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2)
      ctx.globalAlpha = 1

      ctx.strokeStyle = selected ? COL_SELECTION : col
      ctx.lineWidth = 2
      ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2)

      // Label: id on top, role letter below
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(s * FONT_SM)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(tp.id, x + s / 2, y + s / 2 - s * 0.12)
      ctx.font = `${Math.round(s * FONT_SM * 0.8)}px monospace`
      ctx.fillText(isSender ? 'send' : 'recv', x + s / 2, y + s / 2 + s * 0.15)

      // Draw line from sender to its target teleport when selected
      if (selected && isSender && tp.targetId) {
        const target = d.teleports.find(t => t.id === tp.targetId)
        if (target) {
          const tx = target.tileX * s + s / 2
          const ty = target.tileY * s + s / 2
          ctx.strokeStyle = COL_TELEPORT
          ctx.lineWidth = 2
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.moveTo(x + s / 2, y + s / 2)
          ctx.lineTo(tx, ty)
          ctx.stroke()
          ctx.setLineDash([])

          // Target marker
          ctx.strokeStyle = COL_TELEPORT
          ctx.lineWidth = 2
          ctx.strokeRect(target.tileX * s + pad, target.tileY * s + pad, s - pad * 2, s - pad * 2)
        }
      }
    }

    // Pushable blocks — tile image if spriteKey set, else brown square with "B"
    const COL_BLOCK = '#8B6914'
    const COL_BLOCK_SEL = '#b08a1a'
    for (let i = 0; i < d.blocks.length; i++) {
      const block = d.blocks[i]
      const x = block.tileX * s
      const y = block.tileY * s
      const selected = d.selectedEntityType === 'block' && d.selectedEntityIndex === i

      if (block.spriteKey) {
        const img = getTileImage(block.spriteKey)
        if (img) {
          ctx.globalAlpha = selected ? 1 : ENTITY_ALPHA
          ctx.drawImage(img, 0, 0, img.width, img.height, x, y, s, s)
          ctx.globalAlpha = 1
        }
      } else {
        ctx.globalAlpha = ENTITY_ALPHA
        ctx.fillStyle = selected ? COL_BLOCK_SEL : COL_BLOCK
        ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2)
        ctx.globalAlpha = 1
      }

      ctx.strokeStyle = selected ? COL_SELECTION : COL_BLOCK
      ctx.lineWidth = 2
      ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2)

      // Small "B" label in corner
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(s * (block.spriteKey ? FONT_SM : FONT_MD))}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (block.spriteKey) {
        ctx.fillText('B', x + s - pad, y + pad)
      } else {
        ctx.fillText('B', x + s / 2, y + s / 2)
      }
    }

    // Heart pickups — red circle with ♥
    const COL_HEART = '#ff4466'
    const COL_HEART_SEL = '#ff6688'
    for (let i = 0; i < d.hearts.length; i++) {
      const heart = d.hearts[i]
      const x = heart.tileX * s
      const y = heart.tileY * s
      const selected = d.selectedEntityType === 'heart' && d.selectedEntityIndex === i

      ctx.globalAlpha = ENTITY_ALPHA
      ctx.fillStyle = selected ? COL_HEART_SEL : COL_HEART
      const cx = x + s / 2
      const cy = y + s / 2
      const r = (s - pad * 2) / 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      ctx.strokeStyle = selected ? COL_SELECTION : COL_HEART
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(s * FONT_MD)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('♥', cx, cy)
    }

    // Sight line for selected NPC with detect/lookout/patrol behavior
    if (d.selectedEntityType === 'npc' && d.selectedEntityIndex >= 0) {
      const npc = d.npcs[d.selectedEntityIndex]
      if (npc && npc.behavior !== 'static' && npc.behavior !== 'gatekeeper') {
        this.drawSightLine(npc, s)
      }
    }

    // Patrol path for selected NPC
    if (d.selectedEntityType === 'npc' && d.selectedEntityIndex >= 0) {
      const npc = d.npcs[d.selectedEntityIndex]
      if (npc && npc.behavior === 'patrol' && npc.patrolPath && npc.patrolPath.length > 0) {
        this.drawPatrolPath(npc, s)
      }
    }
  }

  private drawSightLine(npc: import('@/data/types').NPCData, s: number): void {
    const ctx = this.ctx
    const d = this.state.snapshot
    const offsets: Record<string, { dx: number; dy: number }> = {
      up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
    }
    const off = offsets[npc.facing]
    if (!off) return

    let tx = npc.tileX + off.dx
    let ty = npc.tileY + off.dy

    const { mapWidth, mapHeight } = this.state.snapshot
    ctx.fillStyle = COL_SIGHT_FILL
    while (tx >= 0 && tx < mapWidth && ty >= 0 && ty < mapHeight) {
      // Check wall on wallsLayer — non-empty string with collision means wall
      const wallIdx = ty * mapWidth + tx
      if (d.wallsLayer[wallIdx] !== '' && d.wallsCollision[wallIdx]) break
      ctx.fillRect(tx * s, ty * s, s, s)
      tx += off.dx
      ty += off.dy
    }

    // Draw a small arrow from NPC center in facing direction
    const cx = npc.tileX * s + s / 2
    const cy = npc.tileY * s + s / 2
    ctx.strokeStyle = COL_SIGHT_ARROW
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + off.dx * s * SIGHT_ARROW_LEN, cy + off.dy * s * SIGHT_ARROW_LEN)
    ctx.stroke()
  }

  private resetMover(): void {
    this.moverPhase = 'idle'
    this.moverSelStart = null
    this.moverSelEnd = null
    this.moverRect = null
    this.moverTiles = []
    this.moverWalls = []
    this.moverCollision = []
    this.moverEffects = []
    this.moverEntities = []
    this.moverDragStart = null
    this.moverOffset = { dx: 0, dy: 0 }
    this.canvas.style.cursor = 'crosshair'
  }

  private drawMoverOverlay(s: number): void {
    const ctx = this.ctx

    if (this.moverPhase === 'selecting' && this.moverSelStart && this.moverSelEnd) {
      const x1 = Math.min(this.moverSelStart.x, this.moverSelEnd.x)
      const y1 = Math.min(this.moverSelStart.y, this.moverSelEnd.y)
      const x2 = Math.max(this.moverSelStart.x, this.moverSelEnd.x)
      const y2 = Math.max(this.moverSelStart.y, this.moverSelEnd.y)
      const w = x2 - x1 + 1
      const h = y2 - y1 + 1

      ctx.fillStyle = COL_MOVER_FILL
      ctx.fillRect(x1 * s, y1 * s, w * s, h * s)
      ctx.strokeStyle = COL_MOVER_SEL
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(x1 * s + 1, y1 * s + 1, w * s - 2, h * s - 2)
      ctx.setLineDash([])
    }

    if (this.moverPhase === 'selected' && this.moverRect) {
      const r = this.moverRect
      ctx.fillStyle = COL_MOVER_FILL
      ctx.fillRect(r.x * s, r.y * s, r.w * s, r.h * s)
      ctx.strokeStyle = COL_MOVER_SEL
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(r.x * s + 1, r.y * s + 1, r.w * s - 2, r.h * s - 2)
      ctx.setLineDash([])
    }

    if (this.moverPhase === 'moving' && this.moverRect) {
      const r = this.moverRect
      const { dx, dy } = this.moverOffset

      // Ghost at original position
      ctx.strokeStyle = COL_MOVER_ORIGIN
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeRect(r.x * s + 1, r.y * s + 1, r.w * s - 2, r.h * s - 2)
      ctx.setLineDash([])

      // Preview tiles at destination
      const nx = r.x + dx
      const ny = r.y + dy
      ctx.globalAlpha = 0.6
      for (let row = 0; row < r.h; row++) {
        for (let col = 0; col < r.w; col++) {
          const tileKey = this.moverTiles[row * r.w + col]
          if (tileKey === '') continue
          const px = (nx + col) * s
          const py = (ny + row) * s
          if (nx + col >= 0 && nx + col < this.state.snapshot.mapWidth && ny + row >= 0 && ny + row < this.state.snapshot.mapHeight) {
            this.drawTile(ctx, tileKey, px, py, s)
          }
        }
      }
      ctx.globalAlpha = 1

      // Destination outline
      ctx.strokeStyle = COL_MOVER_DEST
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(nx * s + 1, ny * s + 1, r.w * s - 2, r.h * s - 2)
      ctx.setLineDash([])
    }
  }

  private drawPatrolPath(npc: import('@/data/types').NPCData, s: number): void {
    const ctx = this.ctx
    const path = npc.patrolPath!
    const half = s / 2

    // Lines connecting waypoints
    ctx.strokeStyle = COL_PATROL_LINE
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(npc.tileX * s + half, npc.tileY * s + half)
    for (const p of path) {
      ctx.lineTo(p.x * s + half, p.y * s + half)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Numbered dots at waypoints
    for (let i = 0; i < path.length; i++) {
      const px = path[i].x * s + half
      const py = path[i].y * s + half
      ctx.fillStyle = COL_PATROL_DOT
      ctx.beginPath()
      ctx.arc(px, py, Math.max(WAYPOINT_DOT_MIN, s * WAYPOINT_DOT_RATIO), 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(s * FONT_SM)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), px, py)
    }
  }
}
