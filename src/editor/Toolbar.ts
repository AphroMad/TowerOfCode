import type { EditorState } from './EditorState'
import type { UndoManager } from './UndoManager'
import type { ImportExport } from './ImportExport'
import type { TestMode } from './TestMode'
import { TemplateDialog } from './TemplateDialog'

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
    // Help toggle
    const helpGroup = this.makeGroup(el)
    const helpBtn = document.createElement('button')
    helpBtn.textContent = '? Help'
    helpBtn.className = 'editor-btn editor-btn-sm'
    helpBtn.title = 'Toggle help panel'
    const helpPanel = document.getElementById('help-panel')
    if (helpPanel) {
      let helpVisible = false
      helpPanel.style.display = 'none'
      helpBtn.addEventListener('click', () => {
        helpVisible = !helpVisible
        helpPanel.style.display = helpVisible ? '' : 'none'
        helpBtn.classList.toggle('active', helpVisible)
      })
    }
    helpGroup.appendChild(helpBtn)

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

    const impBtn = document.createElement('button')
    impBtn.textContent = 'Import'
    impBtn.className = 'editor-btn editor-btn-sm'
    impBtn.title = 'Load a map .ts file (tiles, NPCs, stairs, spawn)'
    impBtn.addEventListener('click', () => this.io.promptImport())
    ioGroup.appendChild(impBtn)

    const expBtn = document.createElement('button')
    expBtn.textContent = 'Export'
    expBtn.className = 'editor-btn'
    expBtn.style.background = '#335533'
    expBtn.title = 'Download map .ts file for src/data/maps/'
    expBtn.addEventListener('click', () => this.io.downloadMap())
    ioGroup.appendChild(expBtn)

    this.makeSep(el)

    // Map metadata
    const metaGroup = this.makeGroup(el)
    this.makeTextInput(metaGroup, 'ID:', 'mapId', 90, 'Unique map identifier (e.g. map-02)')
    this.makeTextInput(metaGroup, 'Name:', 'mapName', 120, 'Display name shown in-game')

    this.makeSep(el)

    // Map size
    const sizeGroup = this.makeGroup(el)
    this.makeSizeInput(sizeGroup, 'W:', 'mapWidth', 'Map width in tiles')
    this.makeSizeInput(sizeGroup, 'H:', 'mapHeight', 'Map height in tiles')

    // HP input
    const hpLbl = document.createElement('span')
    hpLbl.textContent = 'HP:'
    hpLbl.style.color = '#888'
    hpLbl.style.fontSize = '12px'
    hpLbl.title = 'Starting hearts (0 = infinite)'
    hpLbl.style.marginLeft = '8px'
    sizeGroup.appendChild(hpLbl)

    const hpInput = document.createElement('input')
    hpInput.type = 'number'
    hpInput.min = '0'
    hpInput.max = '20'
    hpInput.value = String(this.state.snapshot.startingHp)
    hpInput.className = 'toolbar-input'
    hpInput.style.width = '42px'
    hpInput.title = 'Starting hearts (0 = infinite)'
    hpInput.addEventListener('change', () => {
      const val = parseInt(hpInput.value)
      if (isNaN(val) || val < 0 || val > 20) {
        hpInput.value = String(this.state.snapshot.startingHp)
        return
      }
      this.state.mutate(d => { d.startingHp = val })
    })
    this.state.onChange(() => {
      if (document.activeElement !== hpInput) {
        hpInput.value = String(this.state.snapshot.startingHp)
      }
    })
    sizeGroup.appendChild(hpInput)

    this.makeSep(el)

    // New map / Clear
    const actionGroup = this.makeGroup(el)
    const templateDialog = new TemplateDialog(this.state, this.undo)

    const newBtn = document.createElement('button')
    newBtn.textContent = 'New'
    newBtn.className = 'editor-btn editor-btn-sm'
    newBtn.title = 'Create a new map (empty, maze, or terrain)'
    newBtn.addEventListener('click', () => templateDialog.open())
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


  private makeTextInput(parent: HTMLElement, label: string, key: 'mapId' | 'mapName', width: number, tooltip?: string): void {
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

  private makeSizeInput(parent: HTMLElement, label: string, key: 'mapWidth' | 'mapHeight', tooltip: string): void {
    const lbl = document.createElement('span')
    lbl.textContent = label
    lbl.style.color = '#888'
    lbl.style.fontSize = '12px'
    lbl.title = tooltip
    parent.appendChild(lbl)

    const input = document.createElement('input')
    input.type = 'number'
    input.min = '1'
    input.max = '1024'
    input.value = String(this.state.snapshot[key])
    input.className = 'toolbar-input'
    input.style.width = '48px'
    input.title = tooltip
    input.addEventListener('change', () => {
      const val = parseInt(input.value)
      if (isNaN(val) || val < 1 || val > 1024) {
        input.value = String(this.state.snapshot[key])
        return
      }
      const newW = key === 'mapWidth' ? val : this.state.snapshot.mapWidth
      const newH = key === 'mapHeight' ? val : this.state.snapshot.mapHeight
      if (this.state.wouldResizeLoseData(newW, newH)) {
        if (!confirm('Shrinking will delete tiles and/or entities outside the new bounds. Continue?')) {
          input.value = String(this.state.snapshot[key])
          return
        }
      }
      this.undo.save()
      this.state.resize(newW, newH)
      this.undo.save()
    })
    this.state.onChange(() => {
      if (document.activeElement !== input) {
        input.value = String(this.state.snapshot[key])
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
      } else if (e.key === 'm' || e.key === 'M') {
        this.state.mutate(d => {
          d.activeTool = 'mover'
          d.placingEntity = null
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
    parts.push(`${d.mapWidth}x${d.mapHeight}`)
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
      if (d.activeLayer === 'effects') {
        parts.push(`Effect: ${d.selectedEffectId}`)
      } else {
        parts.push(`Tile: ${d.selectedTileKey || '(empty)'}`)
      }
    }
    this.statusEl.textContent = parts.join('  |  ')
  }
}
