import { getTileImage } from './tileImageCache'
import type { EditorData } from './EditorState'
import type { NPCData } from '@/data/types'

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
const COL_SIGHT_FILL = 'rgba(255, 80, 80, 0.15)'
const COL_SIGHT_ARROW = 'rgba(255, 80, 80, 0.6)'
const COL_PATROL_LINE = 'rgba(100, 200, 255, 0.5)'
const COL_PATROL_DOT = 'rgba(100, 200, 255, 0.7)'

export class EntityRenderer {
  draw(ctx: CanvasRenderingContext2D, d: Readonly<EditorData>, s: number): void {
    const pad = Math.round(s * ENTITY_PAD)

    // Player spawn
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

    // NPCs
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

    // Warp points
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

    // Teleport points
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

      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(s * FONT_SM)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(tp.id, x + s / 2, y + s / 2 - s * 0.12)
      ctx.font = `${Math.round(s * FONT_SM * 0.8)}px monospace`
      ctx.fillText(isSender ? 'send' : 'recv', x + s / 2, y + s / 2 + s * 0.15)

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

          ctx.strokeStyle = COL_TELEPORT
          ctx.lineWidth = 2
          ctx.strokeRect(target.tileX * s + pad, target.tileY * s + pad, s - pad * 2, s - pad * 2)
        }
      }
    }

    // Pushable blocks
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

    // Heart pickups
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
      ctx.fillText('\u2665', cx, cy)
    }

    // Sight line for selected NPC
    if (d.selectedEntityType === 'npc' && d.selectedEntityIndex >= 0) {
      const npc = d.npcs[d.selectedEntityIndex]
      if (npc && npc.behavior !== 'static' && npc.behavior !== 'gatekeeper') {
        this.drawSightLine(ctx, d, npc, s)
      }
      if (npc && npc.behavior === 'patrol' && npc.patrolPath && npc.patrolPath.length > 0) {
        this.drawPatrolPath(ctx, npc, s)
      }
    }
  }

  private drawSightLine(ctx: CanvasRenderingContext2D, d: Readonly<EditorData>, npc: NPCData, s: number): void {
    const offsets: Record<string, { dx: number; dy: number }> = {
      up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
    }
    const off = offsets[npc.facing]
    if (!off) return

    let tx = npc.tileX + off.dx
    let ty = npc.tileY + off.dy

    const { mapWidth, mapHeight } = d
    ctx.fillStyle = COL_SIGHT_FILL
    while (tx >= 0 && tx < mapWidth && ty >= 0 && ty < mapHeight) {
      const wallIdx = ty * mapWidth + tx
      if (d.wallsLayer[wallIdx] !== '' && d.wallsCollision[wallIdx]) break
      ctx.fillRect(tx * s, ty * s, s, s)
      tx += off.dx
      ty += off.dy
    }

    const cx = npc.tileX * s + s / 2
    const cy = npc.tileY * s + s / 2
    ctx.strokeStyle = COL_SIGHT_ARROW
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + off.dx * s * SIGHT_ARROW_LEN, cy + off.dy * s * SIGHT_ARROW_LEN)
    ctx.stroke()
  }

  private drawPatrolPath(ctx: CanvasRenderingContext2D, npc: NPCData, s: number): void {
    const path = npc.patrolPath!
    const half = s / 2

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
