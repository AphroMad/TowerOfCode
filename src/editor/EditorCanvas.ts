import { type EditorState, MAP_W, MAP_H } from './EditorState'
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

export class EditorCanvas {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: EditorState
  private undo: UndoManager
  private imagesLoaded = false
  private painting = false
  private lastPaintTile: { x: number; y: number } | null = null

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

    this.state.onChange(() => this.render())
    this.bindEvents()
    this.updateSize()
  }

  updateSize(): void {
    const z = this.state.snapshot.zoom
    this.canvas.width = MAP_W * TILE_SIZE * z
    this.canvas.height = MAP_H * TILE_SIZE * z
    this.ctx.imageSmoothingEnabled = false
    this.render()
  }

  private tileFromMouse(e: MouseEvent): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect()
    const z = this.state.snapshot.zoom
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / (TILE_SIZE * z))
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / (TILE_SIZE * z))
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return null
    return { x, y }
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      const tile = this.tileFromMouse(e)
      if (!tile) return

      const d = this.state.snapshot

      // Right-click: delete entity
      if (e.button === 2) {
        e.preventDefault()
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
            }
          })
          this.state.deselectEntity()
          this.undo.save()
        }
        return
      }

      // Entity placement mode
      if (d.placingEntity) {
        this.undo.save()
        if (d.placingEntity === 'player') {
          this.state.mutateQuiet(md => {
            md.playerSpawn = { tileX: tile.x, tileY: tile.y, facing: 'down' }
          })
          this.state.selectEntity('player', 0)
        } else if (d.placingEntity === 'npc') {
          this.state.mutateQuiet(md => {
            md.npcs.push({
              name: 'NPC',
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
              direction: 'up',
              tileX: tile.x,
              tileY: tile.y,
              targetFloorId: null,
            })
          })
          this.state.selectEntity('stair', this.state.snapshot.stairs.length - 1)
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

      // Brush / eraser
      this.painting = true
      this.lastPaintTile = null
      this.undo.save()
      this.paintTile(tile)
    })

    this.canvas.addEventListener('mousemove', (e) => {
      const tile = this.tileFromMouse(e)
      this.state.mutateQuiet(d => { d.hoverTile = tile })
      if (this.painting && tile) {
        this.paintTile(tile)
      }
      this.render()
    })

    this.canvas.addEventListener('mouseup', () => {
      if (this.painting) {
        this.painting = false
        this.lastPaintTile = null
        this.undo.save()
      }
    })

    this.canvas.addEventListener('mouseleave', () => {
      this.state.mutateQuiet(d => { d.hoverTile = null })
      if (this.painting) {
        this.painting = false
        this.lastPaintTile = null
        this.undo.save()
      }
      this.render()
    })

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private paintTile(tile: { x: number; y: number }): void {
    if (this.lastPaintTile && this.lastPaintTile.x === tile.x && this.lastPaintTile.y === tile.y) return
    this.lastPaintTile = tile

    const d = this.state.snapshot
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
    }

    // Draw effects layer
    if (d.effectsVisible) {
      const alpha = d.activeLayer === 'effects' ? 1 : 0.4
      this.drawEffectsLayer(d.effectsLayer, s, alpha)
    }

    // Grid lines
    ctx.strokeStyle = COL_GRID
    ctx.lineWidth = 1
    for (let x = 0; x <= MAP_W; x++) {
      ctx.beginPath()
      ctx.moveTo(x * s + 0.5, 0)
      ctx.lineTo(x * s + 0.5, MAP_H * s)
      ctx.stroke()
    }
    for (let y = 0; y <= MAP_H; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * s + 0.5)
      ctx.lineTo(MAP_W * s, y * s + 0.5)
      ctx.stroke()
    }

    // Entities
    if (d.entitiesVisible) {
      this.drawEntities(s)
    }

    // Hover highlight
    if (d.hoverTile) {
      ctx.strokeStyle = COL_HOVER
      ctx.lineWidth = 2
      ctx.strokeRect(d.hoverTile.x * s + 1, d.hoverTile.y * s + 1, s - 2, s - 2)
    }
  }

  private drawLayer(layer: string[], s: number, alpha: number): void {
    const ctx = this.ctx
    ctx.globalAlpha = alpha
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tileKey = layer[y * MAP_W + x]
        if (tileKey === '') continue
        this.drawTile(ctx, tileKey, x * s, y * s, s)
      }
    }
    ctx.globalAlpha = 1
  }

  private drawEffectsLayer(layer: number[], s: number, alpha: number): void {
    const ctx = this.ctx
    ctx.globalAlpha = alpha

    const arrows: Record<number, string> = { 2: '\u2193', 3: '\u2191', 4: '\u2190', 5: '\u2192' }

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const effectId = layer[y * MAP_W + x]
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

    // Sight line for selected NPC with detect/lookout/patrol behavior
    if (d.selectedEntityType === 'npc' && d.selectedEntityIndex >= 0) {
      const npc = d.npcs[d.selectedEntityIndex]
      if (npc && npc.behavior !== 'static') {
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

    ctx.fillStyle = COL_SIGHT_FILL
    while (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
      // Check wall on wallsLayer — non-empty string means wall
      const wallTile = d.wallsLayer[ty * MAP_W + tx]
      if (wallTile !== '') break
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
