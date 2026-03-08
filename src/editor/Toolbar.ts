import type { EditorState, Tool } from './EditorState'
import type { UndoManager } from './UndoManager'
import type { ImportExport } from './ImportExport'
import type { TestMode } from './TestMode'

export class Toolbar {
  private state: EditorState
  private undo: UndoManager
  private io: ImportExport
  private testMode: TestMode
  private statusEl: HTMLElement

  constructor(
    toolbarEl: HTMLElement,
    statusEl: HTMLElement,
    state: EditorState,
    undo: UndoManager,
    io: ImportExport,
    testMode: TestMode,
  ) {
    this.state = state
    this.undo = undo
    this.io = io
    this.testMode = testMode
    this.statusEl = statusEl

    this.buildToolbar(toolbarEl)
    this.bindKeyboard()
    state.onChange(() => this.updateStatus())
  }

  private buildToolbar(el: HTMLElement): void {
    // Left group: tools
    const toolGroup = this.makeGroup(el)
    this.makeToolBtn(toolGroup, 'Brush (B)', 'brush', 'Paint tiles on the grid')
    this.makeToolBtn(toolGroup, 'Eraser (E)', 'eraser', 'Remove tiles (set to empty)')

    this.makeSep(el)

    // Undo/Redo
    const undoGroup = this.makeGroup(el)
    const undoBtn = document.createElement('button')
    undoBtn.textContent = 'Undo'
    undoBtn.className = 'editor-btn editor-btn-sm'
    undoBtn.title = 'Undo last action (Ctrl+Z)'
    undoBtn.addEventListener('click', () => this.undo.undo())
    undoGroup.appendChild(undoBtn)

    const redoBtn = document.createElement('button')
    redoBtn.textContent = 'Redo'
    redoBtn.className = 'editor-btn editor-btn-sm'
    redoBtn.title = 'Redo (Ctrl+Shift+Z)'
    redoBtn.addEventListener('click', () => this.undo.redo())
    undoGroup.appendChild(redoBtn)

    this.makeSep(el)

    // Import/Export
    const ioGroup = this.makeGroup(el)

    const impJsonBtn = document.createElement('button')
    impJsonBtn.textContent = 'Import JSON'
    impJsonBtn.className = 'editor-btn editor-btn-sm'
    impJsonBtn.title = 'Load a Tiled map JSON file (tile layers only)'
    impJsonBtn.addEventListener('click', () => this.io.promptImportJson())
    ioGroup.appendChild(impJsonBtn)

    const impTsBtn = document.createElement('button')
    impTsBtn.textContent = 'Import TS'
    impTsBtn.className = 'editor-btn editor-btn-sm'
    impTsBtn.title = 'Load a floor config .ts file (NPCs, stairs, spawn)'
    impTsBtn.addEventListener('click', () => this.io.promptImportTs())
    ioGroup.appendChild(impTsBtn)

    const expJsonBtn = document.createElement('button')
    expJsonBtn.textContent = 'Export JSON'
    expJsonBtn.className = 'editor-btn'
    expJsonBtn.style.background = '#335533'
    expJsonBtn.title = 'Download Tiled-compatible map JSON for public/assets/maps/'
    expJsonBtn.addEventListener('click', () => this.io.downloadJson())
    ioGroup.appendChild(expJsonBtn)

    const expTsBtn = document.createElement('button')
    expTsBtn.textContent = 'Export TS'
    expTsBtn.className = 'editor-btn'
    expTsBtn.style.background = '#335533'
    expTsBtn.title = 'Download floor config TypeScript for src/data/floors/'
    expTsBtn.addEventListener('click', () => this.io.downloadTs())
    ioGroup.appendChild(expTsBtn)

    this.makeSep(el)

    // Floor metadata
    const metaGroup = this.makeGroup(el)
    this.makeTextInput(metaGroup, 'ID:', 'floorId', 90, 'Unique floor identifier (e.g. floor-03)')
    this.makeTextInput(metaGroup, 'Name:', 'floorName', 120, 'Display name shown in-game')

    this.makeSep(el)

    // New floor / Clear
    const actionGroup = this.makeGroup(el)

    const newBtn = document.createElement('button')
    newBtn.textContent = 'New'
    newBtn.className = 'editor-btn editor-btn-sm'
    newBtn.title = 'Start a blank floor (clears everything)'
    newBtn.addEventListener('click', () => {
      if (!confirm('Clear everything and start a new floor?')) return
      this.state.reset()
    })
    actionGroup.appendChild(newBtn)

    const clearBtn = document.createElement('button')
    clearBtn.textContent = 'Clear Storage'
    clearBtn.className = 'editor-btn editor-btn-sm editor-btn-danger'
    clearBtn.title = 'Remove all editor data from localStorage'
    clearBtn.addEventListener('click', () => {
      if (!confirm('Delete all editor data from localStorage?')) return
      this.io.clearAll()
      this.state.reset()
    })
    actionGroup.appendChild(clearBtn)

    this.makeSep(el)

    // Test / Play
    const testGroup = this.makeGroup(el)
    const testBtn = document.createElement('button')
    testBtn.className = 'editor-btn'
    testBtn.title = 'Test the map in-game (requires player spawn)'
    const updateTestBtn = () => {
      if (this.testMode.isActive()) {
        testBtn.textContent = 'Stop'
        testBtn.style.background = '#662222'
        testBtn.style.borderColor = '#aa4444'
        testBtn.style.color = '#ff8888'
      } else {
        testBtn.textContent = 'Test'
        testBtn.style.background = '#225522'
        testBtn.style.borderColor = '#44aa44'
        testBtn.style.color = '#88ff88'
      }
    }
    testBtn.addEventListener('click', () => {
      if (this.testMode.isActive()) {
        this.testMode.stop()
      } else {
        this.testMode.start()
      }
    })
    this.testMode.onChange(() => updateTestBtn())
    updateTestBtn()
    testGroup.appendChild(testBtn)
  }

  private makeGroup(parent: HTMLElement): HTMLElement {
    const g = document.createElement('div')
    g.style.display = 'flex'
    g.style.alignItems = 'center'
    g.style.gap = '4px'
    parent.appendChild(g)
    return g
  }

  private makeSep(parent: HTMLElement): void {
    const sep = document.createElement('div')
    sep.style.width = '1px'
    sep.style.height = '24px'
    sep.style.background = '#333'
    sep.style.margin = '0 6px'
    parent.appendChild(sep)
  }

  private makeToolBtn(parent: HTMLElement, label: string, tool: Tool, tooltip?: string): void {
    const btn = document.createElement('button')
    btn.textContent = label
    btn.className = 'editor-btn editor-btn-sm'
    if (tooltip) btn.title = tooltip
    btn.addEventListener('click', () => {
      this.state.mutate(d => {
        d.activeTool = tool
        d.placingEntity = null
        if (d.activeLayer === 'entities') d.activeLayer = 'ground'
      })
    })
    this.state.onChange(() => {
      const d = this.state.snapshot
      btn.classList.toggle('active', d.activeTool === tool && !d.placingEntity)
    })
    parent.appendChild(btn)
  }

  private makeTextInput(parent: HTMLElement, label: string, key: 'floorId' | 'floorName', width: number, tooltip?: string): void {
    const lbl = document.createElement('span')
    lbl.textContent = label
    lbl.style.color = '#888'
    lbl.style.fontSize = '12px'
    if (tooltip) lbl.title = tooltip
    parent.appendChild(lbl)

    const input = document.createElement('input')
    input.type = 'text'
    input.value = this.state.snapshot[key]
    input.className = 'toolbar-input'
    input.style.width = `${width}px`
    if (tooltip) input.title = tooltip
    input.addEventListener('change', () => {
      this.state.mutate(d => { (d[key] as string) = input.value })
    })
    this.state.onChange(() => {
      if (document.activeElement !== input) {
        input.value = this.state.snapshot[key]
      }
    })
    parent.appendChild(input)
  }

  private bindKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      // Don't intercept when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'b' || e.key === 'B') {
        this.state.mutate(d => {
          d.activeTool = 'brush'
          d.placingEntity = null
          if (d.activeLayer === 'entities') d.activeLayer = 'ground'
        })
      } else if (e.key === 'e' || e.key === 'E') {
        this.state.mutate(d => {
          d.activeTool = 'eraser'
          d.placingEntity = null
          if (d.activeLayer === 'entities') d.activeLayer = 'ground'
        })
      } else if (e.key === 'g' || e.key === 'G') {
        this.state.mutate(d => {
          d.activeLayer = 'ground'
          if (d.activeTool === 'entity') d.activeTool = 'brush'
        })
      } else if (e.key === 'w' || e.key === 'W') {
        this.state.mutate(d => {
          d.activeLayer = 'walls'
          if (d.activeTool === 'entity') d.activeTool = 'brush'
        })
      } else if (e.key === 'f' || e.key === 'F') {
        this.state.mutate(d => {
          d.activeLayer = 'effects'
          if (d.activeTool === 'entity') d.activeTool = 'brush'
        })
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault()
        this.undo.redo()
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        this.undo.undo()
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        this.undo.redo()
      } else if (e.key === 'Escape') {
        this.state.deselectEntity()
      }
    })
  }

  private updateStatus(): void {
    const d = this.state.snapshot
    const parts: string[] = []
    if (d.hoverTile) {
      parts.push(`Tile (${d.hoverTile.x}, ${d.hoverTile.y})`)
    }
    parts.push(`Layer: ${d.activeLayer}`)
    if (d.placingEntity) {
      parts.push(`Placing: ${d.placingEntity}`)
    } else {
      parts.push(`Tool: ${d.activeTool}`)
    }
    if (d.activeTool === 'brush') {
      parts.push(`Tile #${d.selectedTileId}`)
    }
    this.statusEl.textContent = parts.join('  |  ')
  }
}
