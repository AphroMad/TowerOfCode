import type { EditorState } from './EditorState'
import type { UndoManager } from './UndoManager'
import type { EntityType } from './EditorState'

export type MoverPhase = 'idle' | 'selecting' | 'selected' | 'moving'

// ── Colors ──
const COL_MOVER_SEL = 'rgba(68, 170, 255, 0.8)'
const COL_MOVER_FILL = 'rgba(68, 170, 255, 0.15)'
const COL_MOVER_ORIGIN = 'rgba(255, 100, 100, 0.4)'
const COL_MOVER_DEST = 'rgba(68, 255, 68, 0.8)'

export class MoverTool {
  private state: EditorState
  private undo: UndoManager

  phase: MoverPhase = 'idle'
  private selStart: { x: number; y: number } | null = null
  private selEnd: { x: number; y: number } | null = null
  private rect: { x: number; y: number; w: number; h: number } | null = null
  private tiles: string[] = []
  private walls: string[] = []
  private collision: boolean[] = []
  private effects: number[] = []
  private entities: { type: EntityType; localX: number; localY: number }[] = []
  private dragStart: { x: number; y: number } | null = null
  private offset = { dx: 0, dy: 0 }

  constructor(state: EditorState, undo: UndoManager) {
    this.state = state
    this.undo = undo
  }

  onMouseDown(tile: { x: number; y: number }): boolean {
    if (this.phase === 'idle' || this.phase === 'selecting') {
      this.phase = 'selecting'
      this.selStart = { x: tile.x, y: tile.y }
      this.selEnd = { x: tile.x, y: tile.y }
      this.rect = null
      this.tiles = []
      return true
    }

    if (this.phase === 'selected' && this.rect) {
      const r = this.rect
      if (tile.x >= r.x && tile.x < r.x + r.w && tile.y >= r.y && tile.y < r.y + r.h) {
        this.phase = 'moving'
        this.dragStart = { x: tile.x, y: tile.y }
        this.offset = { dx: 0, dy: 0 }
        this.undo.save()
      } else {
        this.phase = 'selecting'
        this.selStart = { x: tile.x, y: tile.y }
        this.selEnd = { x: tile.x, y: tile.y }
        this.rect = null
        this.tiles = []
      }
      return true
    }

    return false
  }

  /** Returns the cursor to use */
  onMouseMove(tile: { x: number; y: number }): string {
    if (this.phase === 'selecting' && this.selStart) {
      this.selEnd = { x: tile.x, y: tile.y }
      return 'crosshair'
    }

    if (this.phase === 'moving' && this.dragStart) {
      this.offset = {
        dx: tile.x - this.dragStart.x,
        dy: tile.y - this.dragStart.y,
      }
      return 'grabbing'
    }

    if (this.phase === 'selected' && this.rect) {
      const r = this.rect
      if (tile.x >= r.x && tile.x < r.x + r.w && tile.y >= r.y && tile.y < r.y + r.h) {
        return 'grab'
      }
    }

    return 'crosshair'
  }

  /** Returns true if the mouseup was consumed by the mover */
  onMouseUp(): boolean {
    if (this.phase === 'selecting' && this.selStart && this.selEnd) {
      this.finalizeSelection()
      return true
    }

    if (this.phase === 'moving' && this.rect) {
      this.applyMove()
      return true
    }

    return false
  }

  reset(): void {
    this.phase = 'idle'
    this.selStart = null
    this.selEnd = null
    this.rect = null
    this.tiles = []
    this.walls = []
    this.collision = []
    this.effects = []
    this.entities = []
    this.dragStart = null
    this.offset = { dx: 0, dy: 0 }
  }

  drawOverlay(
    ctx: CanvasRenderingContext2D,
    s: number,
    drawTile: (ctx: CanvasRenderingContext2D, tileKey: string, dx: number, dy: number, size: number) => void,
    mapWidth: number,
  ): void {
    if (this.phase === 'selecting' && this.selStart && this.selEnd) {
      const x1 = Math.min(this.selStart.x, this.selEnd.x)
      const y1 = Math.min(this.selStart.y, this.selEnd.y)
      const w = Math.max(this.selStart.x, this.selEnd.x) - x1 + 1
      const h = Math.max(this.selStart.y, this.selEnd.y) - y1 + 1

      ctx.fillStyle = COL_MOVER_FILL
      ctx.fillRect(x1 * s, y1 * s, w * s, h * s)
      ctx.strokeStyle = COL_MOVER_SEL
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(x1 * s + 1, y1 * s + 1, w * s - 2, h * s - 2)
      ctx.setLineDash([])
    }

    if (this.phase === 'selected' && this.rect) {
      const r = this.rect
      ctx.fillStyle = COL_MOVER_FILL
      ctx.fillRect(r.x * s, r.y * s, r.w * s, r.h * s)
      ctx.strokeStyle = COL_MOVER_SEL
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(r.x * s + 1, r.y * s + 1, r.w * s - 2, r.h * s - 2)
      ctx.setLineDash([])
    }

    if (this.phase === 'moving' && this.rect) {
      const r = this.rect
      const { dx, dy } = this.offset

      ctx.strokeStyle = COL_MOVER_ORIGIN
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeRect(r.x * s + 1, r.y * s + 1, r.w * s - 2, r.h * s - 2)
      ctx.setLineDash([])

      const nx = r.x + dx
      const ny = r.y + dy
      const mapH = Math.floor(this.state.snapshot.groundLayer.length / mapWidth)
      ctx.globalAlpha = 0.6
      for (let row = 0; row < r.h; row++) {
        for (let col = 0; col < r.w; col++) {
          const tileKey = this.tiles[row * r.w + col]
          if (tileKey === '') continue
          const px = (nx + col) * s
          const py = (ny + row) * s
          if (nx + col >= 0 && nx + col < mapWidth && ny + row >= 0 && ny + row < mapH) {
            drawTile(ctx, tileKey, px, py, s)
          }
        }
      }
      ctx.globalAlpha = 1

      ctx.strokeStyle = COL_MOVER_DEST
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(nx * s + 1, ny * s + 1, r.w * s - 2, r.h * s - 2)
      ctx.setLineDash([])
    }
  }

  private finalizeSelection(): void {
    const x1 = Math.min(this.selStart!.x, this.selEnd!.x)
    const y1 = Math.min(this.selStart!.y, this.selEnd!.y)
    const x2 = Math.max(this.selStart!.x, this.selEnd!.x)
    const y2 = Math.max(this.selStart!.y, this.selEnd!.y)
    const w = x2 - x1 + 1
    const h = y2 - y1 + 1

    const d = this.state.snapshot
    const mW = d.mapWidth

    this.tiles = []
    this.walls = []
    this.collision = []
    this.effects = []
    this.entities = []

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const idx = (y1 + row) * mW + (x1 + col)
        this.tiles.push(d.groundLayer[idx])
        this.walls.push(d.wallsLayer[idx])
        this.collision.push(d.wallsCollision[idx])
        this.effects.push(d.effectsLayer[idx])
      }
    }

    // Capture entities in selection
    if (d.playerSpawn && d.playerSpawn.tileX >= x1 && d.playerSpawn.tileX <= x2
        && d.playerSpawn.tileY >= y1 && d.playerSpawn.tileY <= y2) {
      this.entities.push({ type: 'player', localX: d.playerSpawn.tileX - x1, localY: d.playerSpawn.tileY - y1 })
    }
    for (const npc of d.npcs) {
      if (npc.tileX >= x1 && npc.tileX <= x2 && npc.tileY >= y1 && npc.tileY <= y2) {
        this.entities.push({ type: 'npc', localX: npc.tileX - x1, localY: npc.tileY - y1 })
      }
    }
    for (const stair of d.stairs) {
      if (stair.tileX >= x1 && stair.tileX <= x2 && stair.tileY >= y1 && stair.tileY <= y2) {
        this.entities.push({ type: 'stair', localX: stair.tileX - x1, localY: stair.tileY - y1 })
      }
    }
    for (const tp of d.teleports) {
      if (tp.tileX >= x1 && tp.tileX <= x2 && tp.tileY >= y1 && tp.tileY <= y2) {
        this.entities.push({ type: 'teleport', localX: tp.tileX - x1, localY: tp.tileY - y1 })
      }
    }
    for (const block of d.blocks) {
      if (block.tileX >= x1 && block.tileX <= x2 && block.tileY >= y1 && block.tileY <= y2) {
        this.entities.push({ type: 'block', localX: block.tileX - x1, localY: block.tileY - y1 })
      }
    }
    for (const heart of d.hearts) {
      if (heart.tileX >= x1 && heart.tileX <= x2 && heart.tileY >= y1 && heart.tileY <= y2) {
        this.entities.push({ type: 'heart', localX: heart.tileX - x1, localY: heart.tileY - y1 })
      }
    }

    const hasContent = this.tiles.some(t => t !== '')
      || this.walls.some(t => t !== '')
      || this.effects.some(e => e !== 0)
      || this.entities.length > 0

    if (hasContent) {
      this.rect = { x: x1, y: y1, w, h }
      this.phase = 'selected'
    } else {
      this.reset()
    }
  }

  private applyMove(): void {
    const r = this.rect!
    const { dx, dy } = this.offset

    if (dx === 0 && dy === 0) {
      this.phase = 'selected'
      return
    }

    const mW = this.state.snapshot.mapWidth
    const mH = this.state.snapshot.mapHeight

    this.state.mutateQuiet(d => {
      // Clear source tiles
      for (let row = 0; row < r.h; row++) {
        for (let col = 0; col < r.w; col++) {
          const ox = r.x + col
          const oy = r.y + row
          if (ox >= 0 && ox < mW && oy >= 0 && oy < mH) {
            const idx = oy * mW + ox
            d.groundLayer[idx] = ''
            d.wallsLayer[idx] = ''
            d.wallsCollision[idx] = true
            d.effectsLayer[idx] = 0
          }
        }
      }
      // Write destination tiles
      for (let row = 0; row < r.h; row++) {
        for (let col = 0; col < r.w; col++) {
          const nx = r.x + col + dx
          const ny = r.y + row + dy
          if (nx >= 0 && nx < mW && ny >= 0 && ny < mH) {
            const idx = ny * mW + nx
            const si = row * r.w + col
            d.groundLayer[idx] = this.tiles[si]
            d.wallsLayer[idx] = this.walls[si]
            d.wallsCollision[idx] = this.collision[si]
            d.effectsLayer[idx] = this.effects[si]
          }
        }
      }
      // Move entities
      for (const ent of this.entities) {
        const newX = r.x + ent.localX + dx
        const newY = r.y + ent.localY + dy
        if (newX < 0 || newX >= mW || newY < 0 || newY >= mH) continue
        if (ent.type === 'player' && d.playerSpawn) {
          d.playerSpawn.tileX = newX
          d.playerSpawn.tileY = newY
        } else if (ent.type === 'npc') {
          const npc = d.npcs.find(n => n.tileX === r.x + ent.localX && n.tileY === r.y + ent.localY)
          if (npc) {
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

    // Update selection to new position and re-capture
    this.rect = { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }
    this.recapture()
    this.phase = 'selected'
    this.dragStart = null
    this.offset = { dx: 0, dy: 0 }
    this.state.emit()
  }

  private recapture(): void {
    const snap = this.state.snapshot
    const nr = this.rect!
    const mW = snap.mapWidth
    const mH = snap.mapHeight

    this.tiles = []
    this.walls = []
    this.collision = []
    this.effects = []
    this.entities = []

    for (let row = 0; row < nr.h; row++) {
      for (let col = 0; col < nr.w; col++) {
        const nx = nr.x + col
        const ny = nr.y + row
        const inBounds = nx >= 0 && nx < mW && ny >= 0 && ny < mH
        const idx = inBounds ? ny * mW + nx : -1
        this.tiles.push(inBounds ? snap.groundLayer[idx] : '')
        this.walls.push(inBounds ? snap.wallsLayer[idx] : '')
        this.collision.push(inBounds ? snap.wallsCollision[idx] : true)
        this.effects.push(inBounds ? snap.effectsLayer[idx] : 0)
      }
    }

    if (snap.playerSpawn && snap.playerSpawn.tileX >= nr.x && snap.playerSpawn.tileX < nr.x + nr.w
        && snap.playerSpawn.tileY >= nr.y && snap.playerSpawn.tileY < nr.y + nr.h) {
      this.entities.push({ type: 'player', localX: snap.playerSpawn.tileX - nr.x, localY: snap.playerSpawn.tileY - nr.y })
    }
    for (const npc of snap.npcs) {
      if (npc.tileX >= nr.x && npc.tileX < nr.x + nr.w && npc.tileY >= nr.y && npc.tileY < nr.y + nr.h) {
        this.entities.push({ type: 'npc', localX: npc.tileX - nr.x, localY: npc.tileY - nr.y })
      }
    }
    for (const stair of snap.stairs) {
      if (stair.tileX >= nr.x && stair.tileX < nr.x + nr.w && stair.tileY >= nr.y && stair.tileY < nr.y + nr.h) {
        this.entities.push({ type: 'stair', localX: stair.tileX - nr.x, localY: stair.tileY - nr.y })
      }
    }
    for (const tp of snap.teleports) {
      if (tp.tileX >= nr.x && tp.tileX < nr.x + nr.w && tp.tileY >= nr.y && tp.tileY < nr.y + nr.h) {
        this.entities.push({ type: 'teleport', localX: tp.tileX - nr.x, localY: tp.tileY - nr.y })
      }
    }
    for (const block of snap.blocks) {
      if (block.tileX >= nr.x && block.tileX < nr.x + nr.w && block.tileY >= nr.y && block.tileY < nr.y + nr.h) {
        this.entities.push({ type: 'block', localX: block.tileX - nr.x, localY: block.tileY - nr.y })
      }
    }
    for (const heart of snap.hearts) {
      if (heart.tileX >= nr.x && heart.tileX < nr.x + nr.w && heart.tileY >= nr.y && heart.tileY < nr.y + nr.h) {
        this.entities.push({ type: 'heart', localX: heart.tileX - nr.x, localY: heart.tileY - nr.y })
      }
    }
  }
}
