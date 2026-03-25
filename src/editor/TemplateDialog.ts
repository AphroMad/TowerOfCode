import type { EditorState } from './EditorState'
import type { UndoManager } from './UndoManager'
import { generateMaze, generateTerrain, generateMazeGrid, generateTerrainGrid } from './MazeGenerator'
import { MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from '@/config/game.config'

type TemplateName = 'empty' | 'maze' | 'terrain'

const PREVIEW_W = 500
const PREVIEW_H = 360

export class TemplateDialog {
  private overlay: HTMLDivElement | null = null
  private state: EditorState
  private undo: UndoManager

  // Current settings
  private template: TemplateName = 'maze'
  private width = MAP_WIDTH_TILES
  private height = MAP_HEIGHT_TILES
  private previewCanvas: HTMLCanvasElement | null = null
  // Store preview grid so we can render it
  private previewGrid: boolean[][] = []
  private previewSpawn: { x: number; y: number } | null = null
  private previewStair: { x: number; y: number } | null = null

  constructor(state: EditorState, undo: UndoManager) {
    this.state = state
    this.undo = undo
  }

  open(): void {
    if (this.overlay) return
    this.width = this.state.snapshot.mapWidth
    this.height = this.state.snapshot.mapHeight
    this.template = 'maze'

    // Overlay
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      background: rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center;
    `
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close()
    })
    this.overlay = overlay

    // Dialog
    const dialog = document.createElement('div')
    dialog.style.cssText = `
      background: #1a1a2e; border: 1px solid #444; border-radius: 8px;
      padding: 20px; min-width: 400px; max-width: 90vw;
      display: flex; flex-direction: column; gap: 16px;
      font-family: 'Courier New', monospace; color: #ccc;
    `
    overlay.appendChild(dialog)

    // Title
    const title = document.createElement('div')
    title.textContent = 'New Map'
    title.style.cssText = `
      color: #ffdd44; font-size: 16px; text-transform: uppercase;
      letter-spacing: 2px; text-align: center;
    `
    dialog.appendChild(title)

    // Template selection
    const templateRow = document.createElement('div')
    templateRow.style.cssText = 'display: flex; gap: 8px; justify-content: center;'
    dialog.appendChild(templateRow)

    const templates: { name: TemplateName; label: string; desc: string }[] = [
      { name: 'empty', label: 'Empty', desc: 'Blank canvas' },
      { name: 'maze', label: 'Maze', desc: 'Corridors & walls' },
      { name: 'terrain', label: 'Terrain', desc: 'Open field with rocks' },
    ]

    const templateBtns: HTMLButtonElement[] = []
    for (const t of templates) {
      const btn = document.createElement('button')
      btn.style.cssText = `
        flex: 1; padding: 10px 8px; border-radius: 6px; cursor: pointer;
        border: 2px solid #444; background: #222; color: #ccc;
        font-family: 'Courier New', monospace; font-size: 12px;
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        transition: all 0.15s;
      `
      const nameEl = document.createElement('span')
      nameEl.textContent = t.label
      nameEl.style.cssText = 'font-size: 14px; font-weight: bold;'
      btn.appendChild(nameEl)
      const descEl = document.createElement('span')
      descEl.textContent = t.desc
      descEl.style.cssText = 'font-size: 10px; color: #888;'
      btn.appendChild(descEl)

      btn.addEventListener('click', () => {
        this.template = t.name
        this.updateTemplateBtns(templateBtns, templates)
        this.refreshPreview()
      })
      templateBtns.push(btn)
      templateRow.appendChild(btn)
    }

    // Size controls
    const sizeRow = document.createElement('div')
    sizeRow.style.cssText = 'display: flex; gap: 12px; align-items: center; justify-content: center;'
    dialog.appendChild(sizeRow)

    const makeNumInput = (label: string, value: number, onChange: (v: number) => void) => {
      const lbl = document.createElement('span')
      lbl.textContent = label
      lbl.style.cssText = 'color: #888; font-size: 12px;'
      sizeRow.appendChild(lbl)
      const input = document.createElement('input')
      input.type = 'number'
      input.min = '3'
      input.max = '1024'
      input.value = String(value)
      input.style.cssText = `
        width: 60px; background: #222; border: 1px solid #444; color: #ccc;
        font-family: 'Courier New', monospace; font-size: 13px;
        padding: 4px 6px; border-radius: 4px; text-align: center;
      `
      input.addEventListener('input', () => {
        const v = parseInt(input.value)
        if (!isNaN(v) && v >= 3 && v <= 1024) onChange(v)
      })
      sizeRow.appendChild(input)
      return input
    }

    makeNumInput('Width:', this.width, (v) => { this.width = v; this.refreshPreview() })
    const sep = document.createElement('span')
    sep.textContent = 'x'
    sep.style.cssText = 'color: #666; font-size: 12px;'
    sizeRow.appendChild(sep)
    makeNumInput('Height:', this.height, (v) => { this.height = v; this.refreshPreview() })

    // Randomize button
    const randBtn = document.createElement('button')
    randBtn.textContent = 'Randomize'
    randBtn.style.cssText = `
      background: #2a2a4e; border: 1px solid #444; color: #aaa;
      font-family: 'Courier New', monospace; font-size: 11px;
      padding: 4px 10px; border-radius: 4px; cursor: pointer; margin-left: 8px;
    `
    randBtn.addEventListener('click', () => this.refreshPreview())
    sizeRow.appendChild(randBtn)

    // Preview canvas — fixed size container, canvas scales to fit
    const previewWrap = document.createElement('div')
    previewWrap.style.cssText = `
      display: flex; justify-content: center; align-items: center;
      background: #111; border: 1px solid #333; border-radius: 4px;
      width: ${PREVIEW_W + 24}px; height: ${PREVIEW_H + 24}px;
      padding: 12px; margin: 0 auto;
    `
    dialog.appendChild(previewWrap)

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'image-rendering: pixelated;'
    previewWrap.appendChild(canvas)
    this.previewCanvas = canvas

    // Bottom buttons
    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;'
    dialog.appendChild(btnRow)

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.style.cssText = `
      background: #2a2a4e; border: 1px solid #444; color: #ccc;
      font-family: 'Courier New', monospace; font-size: 13px;
      padding: 8px 20px; border-radius: 4px; cursor: pointer;
    `
    cancelBtn.addEventListener('click', () => this.close())
    btnRow.appendChild(cancelBtn)

    const goBtn = document.createElement('button')
    goBtn.textContent = 'Generate'
    goBtn.style.cssText = `
      background: #335533; border: 1px solid #44aa44; color: #88ff88;
      font-family: 'Courier New', monospace; font-size: 13px;
      padding: 8px 24px; border-radius: 4px; cursor: pointer; font-weight: bold;
    `
    goBtn.addEventListener('click', () => this.apply())
    btnRow.appendChild(goBtn)

    document.body.appendChild(overlay)

    // Esc to close
    this._onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close()
    }
    document.addEventListener('keydown', this._onKey)

    this.updateTemplateBtns(templateBtns, templates)
    this.refreshPreview()
  }

  private _onKey: ((e: KeyboardEvent) => void) | null = null

  private close(): void {
    if (this.overlay) {
      document.body.removeChild(this.overlay)
      this.overlay = null
    }
    if (this._onKey) {
      document.removeEventListener('keydown', this._onKey)
      this._onKey = null
    }
    this.previewCanvas = null
  }

  private updateTemplateBtns(
    btns: HTMLButtonElement[],
    templates: { name: TemplateName }[],
  ): void {
    for (let i = 0; i < btns.length; i++) {
      const active = templates[i].name === this.template
      btns[i].style.borderColor = active ? '#ffdd44' : '#444'
      btns[i].style.background = active ? '#2a2a3e' : '#222'
      btns[i].querySelector('span')!.style.color = active ? '#ffdd44' : '#ccc'
    }
  }

  private refreshPreview(): void {
    const w = this.width
    const h = this.height
    const canvas = this.previewCanvas
    if (!canvas) return

    // Compute scale to fit the fixed preview area — always fits, never overflows
    const scale = Math.min(PREVIEW_W / w, PREVIEW_H / h)
    const pw = Math.floor(w * scale)
    const ph = Math.floor(h * scale)

    canvas.width = pw
    canvas.height = ph
    canvas.style.width = `${pw}px`
    canvas.style.height = `${ph}px`
    const cell = scale
    const ctx = canvas.getContext('2d')!

    // Generate preview data
    this.previewSpawn = null
    this.previewStair = null

    if (this.template === 'empty') {
      this.previewGrid = Array.from({ length: h }, () => new Array(w).fill(false))
    } else if (this.template === 'maze') {
      const result = generateMazeGrid(w, h)
      this.previewGrid = result.walls
      this.previewSpawn = result.spawn
      this.previewStair = result.stair
    } else {
      const result = generateTerrainGrid(w, h)
      this.previewGrid = result.walls
      this.previewSpawn = result.spawn
      this.previewStair = result.stair
    }

    // Draw tiles
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = this.previewGrid[y][x] ? '#4a4a5e' : '#2a2a3e'
        ctx.fillRect(x * cell, y * cell, cell, cell)
      }
    }

    // Grid lines (only when cells are big enough to see them)
    if (cell >= 3) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= w; x++) {
        ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, ph); ctx.stroke()
      }
      for (let y = 0; y <= h; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(pw, y * cell); ctx.stroke()
      }
    }

    // Spawn marker
    const spawn = this.previewSpawn as { x: number; y: number } | null
    if (spawn) {
      ctx.fillStyle = '#22cc22'
      const r = Math.max(2, cell * 0.4)
      ctx.beginPath()
      ctx.arc(spawn.x * cell + cell / 2, spawn.y * cell + cell / 2, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // Stair marker
    const stair = this.previewStair as { x: number; y: number } | null
    if (stair) {
      ctx.fillStyle = '#aa66ff'
      const r = Math.max(2, cell * 0.4)
      ctx.beginPath()
      ctx.arc(stair.x * cell + cell / 2, stair.y * cell + cell / 2, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private apply(): void {
    this.undo.save()

    // Resize if needed
    if (this.width !== this.state.snapshot.mapWidth || this.height !== this.state.snapshot.mapHeight) {
      this.state.resize(this.width, this.height)
    }

    if (this.template === 'empty') {
      this.state.reset()
      // Re-apply size after reset (reset goes back to defaults)
      if (this.width !== this.state.snapshot.mapWidth || this.height !== this.state.snapshot.mapHeight) {
        this.state.resize(this.width, this.height)
      }
    } else if (this.template === 'maze') {
      generateMaze(this.state)
    } else {
      generateTerrain(this.state)
    }

    this.undo.save()
    this.close()
  }
}
