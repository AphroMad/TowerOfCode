import { EditorState } from './EditorState'
import { EditorCanvas } from './EditorCanvas'
import { TilePalette } from './TilePalette'
import { EntityPanel } from './EntityPanel'
import { Toolbar } from './Toolbar'
import { UndoManager } from './UndoManager'
import { ImportExport } from './ImportExport'
import { TestMode } from './TestMode'

// State
const state = new EditorState()
const undo = new UndoManager(state)
const io = new ImportExport(state)
const testMode = new TestMode(state)

// DOM refs
const toolbarEl = document.getElementById('toolbar')!
const statusEl = document.getElementById('status-bar')!
const sidebarEl = document.getElementById('sidebar')!
const canvasContainer = document.getElementById('canvas-container')!

// Build UI
const canvas = new EditorCanvas(canvasContainer, state, undo)
new TilePalette(sidebarEl, state)
new EntityPanel(sidebarEl, state)
new Toolbar(toolbarEl, statusEl, state, undo, io, testMode)

// Zoom resize
document.addEventListener('editor-zoom', () => canvas.updateSize())

// Zoom slider overlay on canvas
const zoomOverlay = document.createElement('div')
zoomOverlay.id = 'zoom-overlay'

const zoomLabel = document.createElement('span')
zoomLabel.id = 'zoom-label'
zoomLabel.textContent = `${state.snapshot.zoom}x`
zoomOverlay.appendChild(zoomLabel)

const zoomSlider = document.createElement('input')
zoomSlider.type = 'range'
zoomSlider.id = 'zoom-slider'
zoomSlider.min = '0.5'
zoomSlider.max = '3'
zoomSlider.step = '0.25'
zoomSlider.value = String(state.snapshot.zoom)
zoomSlider.addEventListener('input', () => {
  const z = parseFloat(zoomSlider.value)
  state.mutate(d => { d.zoom = z })
  zoomLabel.textContent = `${z}x`
  document.dispatchEvent(new CustomEvent('editor-zoom'))
})
zoomOverlay.appendChild(zoomSlider)

state.onChange(() => {
  const z = state.snapshot.zoom
  zoomSlider.value = String(z)
  zoomLabel.textContent = `${z}x`
})
canvasContainer.appendChild(zoomOverlay)

// Visibility toggles overlay (below zoom)
const visOverlay = document.createElement('div')
visOverlay.id = 'visibility-overlay'

const toggles: { label: string; key: 'groundVisible' | 'wallsVisible' | 'effectsVisible' | 'entitiesVisible' }[] = [
  { label: 'Gnd', key: 'groundVisible' },
  { label: 'Obj', key: 'wallsVisible' },
  { label: 'Eff', key: 'effectsVisible' },
  { label: 'Ent', key: 'entitiesVisible' },
]

for (const toggle of toggles) {
  const btn = document.createElement('button')
  btn.className = 'editor-btn editor-btn-sm'
  const update = () => {
    const visible = state.snapshot[toggle.key]
    btn.textContent = `${visible ? '✓' : '✕'} ${toggle.label}`
    btn.style.opacity = visible ? '1' : '0.45'
  }
  btn.addEventListener('click', () => {
    state.mutate(d => { (d[toggle.key] as boolean) = !d[toggle.key] })
  })
  state.onChange(update)
  update()
  visOverlay.appendChild(btn)
}

canvasContainer.appendChild(visOverlay)

// Try to restore autosaved state
io.loadAutosave()
