import type { EditorState, LayerName } from './EditorState'

const TILE_SIZE = 32
const DISPLAY_SIZE = 48

interface TileEntry {
  id: number
  label: string
  folder: string
}

const GROUND_TILES: TileEntry[] = [
  { id: 0, label: 'Empty', folder: 'Tools' },
  { id: 1, label: 'Ground 1', folder: 'Basic' },
  { id: 2, label: 'Ground 2', folder: 'Basic' },
  { id: 3, label: 'Ground 3', folder: 'Basic' },
  { id: 4, label: 'Ground 4', folder: 'Basic' },
  { id: 5, label: 'Ground 5', folder: 'Basic' },
  { id: 6, label: 'Ground 6', folder: 'Basic' },
  { id: 7, label: 'Ground 7', folder: 'Basic' },
  { id: 8, label: 'Ground 8', folder: 'Basic' },
  { id: 9, label: 'Ground 9', folder: 'Basic' },
]

const OBJECT_TILES: TileEntry[] = [
  { id: 0, label: 'Empty', folder: 'Tools' },
  { id: 10, label: 'Rock', folder: 'Obstacles' },
  { id: 11, label: 'Invisible Wall', folder: 'Collision' },
]

interface EffectEntry {
  id: number
  label: string
  color: string
  arrow?: string
  folder: string
}

const EFFECTS: EffectEntry[] = [
  { id: 0, label: 'Empty', color: '#222', folder: 'Tools' },
  { id: 1, label: 'Ice', color: '#4488cc', folder: 'Sliding' },
  { id: 2, label: 'Redirect \u2193', color: '#cc8844', arrow: '\u2193', folder: 'Redirect' },
  { id: 3, label: 'Redirect \u2191', color: '#cc8844', arrow: '\u2191', folder: 'Redirect' },
  { id: 4, label: 'Redirect \u2190', color: '#cc8844', arrow: '\u2190', folder: 'Redirect' },
  { id: 5, label: 'Redirect \u2192', color: '#cc8844', arrow: '\u2192', folder: 'Redirect' },
]

interface CellData {
  wrapper: HTMLElement
  label: string
}

interface FolderGroup {
  container: HTMLElement
  cells: CellData[]
}

export class TilePalette {
  private container: HTMLElement
  private state: EditorState
  private tilesetImg: HTMLImageElement
  private rockImg: HTMLImageElement

  private groundSection: HTMLElement | null = null
  private objectSection: HTMLElement | null = null
  private effectSection: HTMLElement | null = null

  private groundFolders: FolderGroup[] = []
  private objectFolders: FolderGroup[] = []
  private effectFolders: FolderGroup[] = []

  private groundCells: { canvas: HTMLCanvasElement; tileId: number }[] = []
  private objectCells: { canvas: HTMLCanvasElement; tileId: number }[] = []
  private effectCells: { canvas: HTMLCanvasElement; effectId: number }[] = []

  private searchInput: HTMLInputElement | null = null

  constructor(container: HTMLElement, state: EditorState) {
    this.container = container
    this.state = state

    this.tilesetImg = new Image()
    this.rockImg = new Image()

    this.buildLayerButtons(container)
    this.buildSearchBar(container)

    this.loadImages()
      .then(() => this.buildAllPalettes())
      .catch(err => console.error('TilePalette: failed to load images', err))

    state.onChange(() => this.updateView())
  }

  private async loadImages(): Promise<void> {
    const load = (img: HTMLImageElement, src: string) =>
      new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error(`Failed to load image: ${src}`))
        img.src = src
      })
    await Promise.all([
      load(this.tilesetImg, 'assets/tilesets/tileset.png'),
      load(this.rockImg, 'assets/tilesets/rock.png'),
    ])
  }

  private buildLayerButtons(container: HTMLElement): void {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.gap = '4px'
    row.style.marginBottom = '8px'
    row.style.flexWrap = 'wrap'

    const layers: { label: string; key: LayerName }[] = [
      { label: 'Ground (G)', key: 'ground' },
      { label: 'Objects (W)', key: 'walls' },
      { label: 'Effects (F)', key: 'effects' },
      { label: 'Entities', key: 'entities' },
    ]
    for (const layer of layers) {
      const btn = document.createElement('button')
      btn.textContent = layer.label
      btn.className = 'editor-btn editor-btn-sm'
      btn.addEventListener('click', () => {
        this.state.mutate(d => {
          d.activeLayer = layer.key
          if (layer.key === 'entities') {
            d.activeTool = 'entity'
          } else {
            if (d.activeTool === 'entity') d.activeTool = 'brush'
          }
        })
      })
      this.state.onChange(() => {
        btn.classList.toggle('active', this.state.snapshot.activeLayer === layer.key)
      })
      row.appendChild(btn)
    }

    container.appendChild(row)
    this.addSeparator(container)
  }

  private buildSearchBar(container: HTMLElement): void {
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Search tiles...'
    input.className = 'tile-search-input'
    input.addEventListener('input', () => this.applySearch())
    this.searchInput = input
    container.appendChild(input)
  }

  private buildAllPalettes(): void {
    // Ground palette
    this.groundSection = document.createElement('div')
    this.groundFolders = this.buildTileSection(this.groundSection, GROUND_TILES, 'ground')
    this.container.appendChild(this.groundSection)

    // Object palette
    this.objectSection = document.createElement('div')
    this.objectFolders = this.buildTileSection(this.objectSection, OBJECT_TILES, 'walls')
    this.container.appendChild(this.objectSection)

    // Effects palette
    this.effectSection = document.createElement('div')
    this.effectFolders = this.buildEffectSection(this.effectSection)
    this.container.appendChild(this.effectSection)

    this.addSeparator(this.container)
    this.updateView()
  }

  private buildTileSection(parent: HTMLElement, tiles: TileEntry[], targetLayer: LayerName): FolderGroup[] {
    const folders: FolderGroup[] = []
    const grouped = this.groupByFolder(tiles)

    for (const [folderName, folderTiles] of grouped) {
      const folderContainer = document.createElement('div')
      folderContainer.className = 'tile-folder'

      const header = document.createElement('div')
      header.className = 'tile-folder-header'
      header.textContent = folderName
      folderContainer.appendChild(header)

      const grid = document.createElement('div')
      grid.className = 'tile-grid'

      const cells: CellData[] = []

      for (const tile of folderTiles) {
        const wrapper = document.createElement('div')
        wrapper.className = 'tile-cell-wrapper'

        const cell = document.createElement('canvas')
        cell.width = DISPLAY_SIZE
        cell.height = DISPLAY_SIZE
        cell.style.cursor = 'pointer'
        cell.style.border = '2px solid transparent'
        cell.style.borderRadius = '3px'
        cell.title = tile.label

        this.drawTileOnCanvas(cell, tile.id)

        cell.addEventListener('click', () => {
          this.state.mutate(d => {
            d.selectedTileId = tile.id
            d.activeTool = tile.id === 0 ? 'eraser' : 'brush'
            d.activeLayer = targetLayer
            d.placingEntity = null
          })
        })

        wrapper.appendChild(cell)

        const label = document.createElement('span')
        label.className = 'tile-cell-label'
        label.textContent = tile.label
        wrapper.appendChild(label)

        grid.appendChild(wrapper)
        cells.push({ wrapper, label: tile.label })

        if (targetLayer === 'ground') {
          this.groundCells.push({ canvas: cell, tileId: tile.id })
        } else {
          this.objectCells.push({ canvas: cell, tileId: tile.id })
        }
      }

      folderContainer.appendChild(grid)
      parent.appendChild(folderContainer)
      folders.push({ container: folderContainer, cells })
    }

    return folders
  }

  private buildEffectSection(parent: HTMLElement): FolderGroup[] {
    const folders: FolderGroup[] = []
    const grouped = this.groupByFolder(EFFECTS)

    for (const [folderName, folderEffects] of grouped) {
      const folderContainer = document.createElement('div')
      folderContainer.className = 'tile-folder'

      const header = document.createElement('div')
      header.className = 'tile-folder-header'
      header.textContent = folderName
      folderContainer.appendChild(header)

      const grid = document.createElement('div')
      grid.className = 'tile-grid'

      const cells: CellData[] = []

      for (const eff of folderEffects) {
        const wrapper = document.createElement('div')
        wrapper.className = 'tile-cell-wrapper'

        const cell = document.createElement('canvas')
        cell.width = DISPLAY_SIZE
        cell.height = DISPLAY_SIZE
        cell.style.cursor = 'pointer'
        cell.style.border = '2px solid transparent'
        cell.style.borderRadius = '3px'
        cell.title = eff.label

        this.drawEffectOnCanvas(cell, eff)

        cell.addEventListener('click', () => {
          this.state.mutate(d => {
            d.selectedTileId = eff.id
            d.activeTool = eff.id === 0 ? 'eraser' : 'brush'
            d.activeLayer = 'effects'
            d.placingEntity = null
          })
        })

        wrapper.appendChild(cell)

        const label = document.createElement('span')
        label.className = 'tile-cell-label'
        label.textContent = eff.label
        wrapper.appendChild(label)

        grid.appendChild(wrapper)
        cells.push({ wrapper, label: eff.label })
        this.effectCells.push({ canvas: cell, effectId: eff.id })
      }

      folderContainer.appendChild(grid)
      parent.appendChild(folderContainer)
      folders.push({ container: folderContainer, cells })
    }

    return folders
  }

  private drawTileOnCanvas(cell: HTMLCanvasElement, tileId: number): void {
    const ctx = cell.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    if (tileId === 0) {
      ctx.fillStyle = '#222'
      ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
      ctx.strokeStyle = '#555'
      ctx.lineWidth = 1
      for (let i = -DISPLAY_SIZE; i < DISPLAY_SIZE * 2; i += 8) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i + DISPLAY_SIZE, DISPLAY_SIZE)
        ctx.stroke()
      }
      ctx.fillStyle = '#888'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('\u2205', DISPLAY_SIZE / 2, DISPLAY_SIZE / 2)
    } else if (tileId >= 1 && tileId <= 9) {
      const sx = (tileId - 1) * TILE_SIZE
      ctx.drawImage(this.tilesetImg, sx, 0, TILE_SIZE, TILE_SIZE, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
    } else if (tileId === 10) {
      ctx.drawImage(this.rockImg, 0, 0, TILE_SIZE, TILE_SIZE, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
    } else if (tileId === 11) {
      ctx.fillStyle = '#221111'
      ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
      ctx.strokeStyle = 'rgba(255, 60, 60, 0.5)'
      ctx.lineWidth = 2
      for (let i = -DISPLAY_SIZE; i < DISPLAY_SIZE * 2; i += 10) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i + DISPLAY_SIZE, DISPLAY_SIZE)
        ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(255, 60, 60, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(8, 8)
      ctx.lineTo(DISPLAY_SIZE - 8, DISPLAY_SIZE - 8)
      ctx.moveTo(DISPLAY_SIZE - 8, 8)
      ctx.lineTo(8, DISPLAY_SIZE - 8)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255, 100, 100, 0.9)'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('INV', DISPLAY_SIZE / 2, DISPLAY_SIZE / 2)
    }
  }

  private drawEffectOnCanvas(cell: HTMLCanvasElement, eff: EffectEntry): void {
    const ctx = cell.getContext('2d')!
    if (eff.id === 0) {
      ctx.fillStyle = '#222'
      ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
      ctx.strokeStyle = '#555'
      ctx.lineWidth = 1
      for (let i = -DISPLAY_SIZE; i < DISPLAY_SIZE * 2; i += 8) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i + DISPLAY_SIZE, DISPLAY_SIZE)
        ctx.stroke()
      }
      ctx.fillStyle = '#888'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('\u2205', DISPLAY_SIZE / 2, DISPLAY_SIZE / 2)
    } else {
      ctx.fillStyle = eff.color
      ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${eff.arrow ? '22' : '11'}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(eff.arrow || 'ICE', DISPLAY_SIZE / 2, DISPLAY_SIZE / 2)
    }
  }

  private groupByFolder<T extends { folder: string }>(items: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>()
    for (const item of items) {
      if (!map.has(item.folder)) map.set(item.folder, [])
      map.get(item.folder)!.push(item)
    }
    return map
  }

  private addSeparator(container: HTMLElement): void {
    const sep = document.createElement('div')
    sep.style.height = '1px'
    sep.style.background = '#333'
    sep.style.margin = '8px 0'
    container.appendChild(sep)
  }

  private applySearch(): void {
    const term = this.searchInput?.value.toLowerCase().trim() || ''
    const activeFolders = this.getActiveFolders()

    for (const folder of activeFolders) {
      let anyVisible = false
      for (const cell of folder.cells) {
        const match = !term || cell.label.toLowerCase().includes(term)
        cell.wrapper.style.display = match ? '' : 'none'
        if (match) anyVisible = true
      }
      folder.container.style.display = anyVisible ? '' : 'none'
    }
  }

  private getActiveFolders(): FolderGroup[] {
    const layer = this.state.snapshot.activeLayer
    if (layer === 'ground') return this.groundFolders
    if (layer === 'walls') return this.objectFolders
    if (layer === 'effects') return this.effectFolders
    return []
  }

  private updateView(): void {
    const layer = this.state.snapshot.activeLayer

    // Show/hide sections
    if (this.groundSection) this.groundSection.style.display = layer === 'ground' ? '' : 'none'
    if (this.objectSection) this.objectSection.style.display = layer === 'walls' ? '' : 'none'
    if (this.effectSection) this.effectSection.style.display = layer === 'effects' ? '' : 'none'

    // Show/hide search bar (not useful for entities layer)
    if (this.searchInput) {
      this.searchInput.style.display = layer === 'entities' ? 'none' : ''
    }

    // Apply search filter
    this.applySearch()

    // Update selection highlighting
    this.updateHighlight()
  }

  private updateHighlight(): void {
    const d = this.state.snapshot
    const isActive = d.activeTool === 'brush' || d.activeTool === 'eraser'

    for (const { canvas, tileId } of this.groundCells) {
      const selected = isActive && d.activeLayer === 'ground' && d.selectedTileId === tileId
      canvas.style.border = selected ? '2px solid #ffdd44' : '2px solid transparent'
    }

    for (const { canvas, tileId } of this.objectCells) {
      const selected = isActive && d.activeLayer === 'walls' && d.selectedTileId === tileId
      canvas.style.border = selected ? '2px solid #ffdd44' : '2px solid transparent'
    }

    for (const { canvas, effectId } of this.effectCells) {
      const selected = isActive && d.activeLayer === 'effects' && d.selectedTileId === effectId
      canvas.style.border = selected ? '2px solid #ffdd44' : '2px solid transparent'
    }
  }
}
