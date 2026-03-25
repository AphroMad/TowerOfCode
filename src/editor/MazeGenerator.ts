import type { EditorState } from './EditorState'

const GROUND_TILE = 'ground/basic/2'
const WALL_TILE = 'objects/rock'

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Reusable: clear all editor data */
function clearState(d: Parameters<Parameters<EditorState['mutate']>[0]>[0], total: number) {
  d.groundLayer = new Array(total).fill('')
  d.wallsLayer = new Array(total).fill('')
  d.wallsCollision = new Array(total).fill(true)
  d.effectsLayer = new Array(total).fill(0)
  d.playerSpawn = null
  d.npcs = []
  d.stairs = []
  d.teleports = []
  d.blocks = []
  d.hearts = []
  d.selectedEntityType = null
  d.selectedEntityIndex = -1
  d.selectedWallTile = null
}

export interface GridResult {
  /** true = wall/blocked, false = open path */
  walls: boolean[][]
  spawn: { x: number; y: number } | null
  stair: { x: number; y: number } | null
}

/**
 * Pure maze grid generation — recursive backtracking with variable-width corridors.
 * Returns walls[][] where true = wall, false = path.
 */
export function generateMazeGrid(w: number, h: number): GridResult {
  const walls: boolean[][] = Array.from({ length: h }, () => new Array(w).fill(true))
  const inBounds = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h

  const cellsX = Math.ceil(w / 2)
  const cellsY = Math.ceil(h / 2)
  if (cellsX < 1 || cellsY < 1) return { walls, spawn: null, stair: null }

  const visited: boolean[][] = Array.from({ length: cellsY }, () => new Array(cellsX).fill(false))
  const toTileX = (cx: number) => cx * 2
  const toTileY = (cy: number) => cy * 2

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ]

  const stack: { x: number; y: number }[] = []
  visited[0][0] = true
  walls[toTileY(0)][toTileX(0)] = false
  stack.push({ x: 0, y: 0 })

  while (stack.length > 0) {
    const cur = stack[stack.length - 1]
    const neighbors = shuffle([...dirs])
      .map(d => ({ cx: cur.x + d.dx, cy: cur.y + d.dy, dx: d.dx, dy: d.dy }))
      .filter(n => n.cx >= 0 && n.cx < cellsX && n.cy >= 0 && n.cy < cellsY && !visited[n.cy][n.cx])

    if (neighbors.length === 0) {
      stack.pop()
      continue
    }

    const next = neighbors[0]
    visited[next.cy][next.cx] = true
    walls[toTileY(next.cy)][toTileX(next.cx)] = false
    const wallX = toTileX(cur.x) + next.dx
    const wallY = toTileY(cur.y) + next.dy
    if (inBounds(wallX, wallY)) walls[wallY][wallX] = false

    stack.push({ x: next.cx, y: next.cy })
  }

  // Widen ~30% of corridors
  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      if (Math.random() > 0.30) continue

      const tx = toTileX(cx)
      const ty = toTileY(cy)
      const extra = Math.random() < 0.35 ? 2 : 1

      const connDirs = dirs.filter(d => {
        const nx = tx + d.dx, ny = ty + d.dy
        return inBounds(nx, ny) && !walls[ny][nx]
      })
      if (connDirs.length === 0) continue

      const dir = connDirs[Math.floor(Math.random() * connDirs.length)]
      const perps = dir.dx === 0
        ? [{ x: 1, y: 0 }, { x: -1, y: 0 }]
        : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
      const side = perps[Math.floor(Math.random() * 2)]

      for (let e = 1; e <= extra; e++) {
        const px = tx + side.x * e, py = ty + side.y * e
        if (inBounds(px, py)) walls[py][px] = false
        const cx2 = tx + dir.dx + side.x * e, cy2 = ty + dir.dy + side.y * e
        if (inBounds(cx2, cy2)) walls[cy2][cx2] = false
      }
    }
  }

  // Collect all path tiles and pick two far-apart ones for spawn & stair
  const pathTiles: { x: number; y: number }[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!walls[y][x]) pathTiles.push({ x, y })
    }
  }
  shuffle(pathTiles)

  const spawn = pathTiles[0] ?? null
  let stair: { x: number; y: number } | null = null
  if (spawn && pathTiles.length > 1) {
    let bestDist = 0
    for (const t of pathTiles) {
      const dist = Math.abs(t.x - spawn.x) + Math.abs(t.y - spawn.y)
      if (dist > bestDist) { bestDist = dist; stair = t }
    }
  }

  return { walls, spawn, stair }
}

/**
 * Pure terrain grid generation — open ground with scattered rock clusters
 * and a clear path from spawn to stair.
 * Returns walls[][] where true = rock/blocked, false = open.
 */
export function generateTerrainGrid(w: number, h: number): GridResult {
  const walls: boolean[][] = Array.from({ length: h }, () => new Array(w).fill(false))

  // Random spawn & stair positions, at least half the map apart
  let spawnX: number, spawnY: number, stairX: number, stairY: number
  do {
    spawnX = Math.floor(Math.random() * w)
    spawnY = Math.floor(Math.random() * h)
    stairX = Math.floor(Math.random() * w)
    stairY = Math.floor(Math.random() * h)
  } while (
    Math.abs(spawnX - stairX) + Math.abs(spawnY - stairY) < Math.floor((w + h) / 3)
    || (spawnX === stairX && spawnY === stairY)
  )

  // Winding path from spawn to stair so there's always a route
  const pathTiles = new Set<string>()
  let px = spawnX, py = spawnY
  pathTiles.add(`${px},${py}`)

  while (px !== stairX || py !== stairY) {
    const choices: { x: number; y: number }[] = []
    if (py > stairY) choices.push({ x: 0, y: -1 }, { x: 0, y: -1 })
    if (py < stairY) choices.push({ x: 0, y: 1 }, { x: 0, y: 1 })
    if (px < stairX) choices.push({ x: 1, y: 0 })
    if (px > stairX) choices.push({ x: -1, y: 0 })
    // Random wander
    choices.push(
      { x: Math.random() < 0.5 ? -1 : 1, y: 0 },
      { x: 0, y: Math.random() < 0.5 ? -1 : 1 },
    )
    const move = choices[Math.floor(Math.random() * choices.length)]
    px = Math.max(0, Math.min(w - 1, px + move.x))
    py = Math.max(0, Math.min(h - 1, py + move.y))
    pathTiles.add(`${px},${py}`)
    if (px + 1 < w) pathTiles.add(`${px + 1},${py}`)
    if (px - 1 >= 0) pathTiles.add(`${px - 1},${py}`)
  }
  pathTiles.add(`${stairX},${stairY}`)

  // Scatter rock formations
  const area = w * h
  const targetRocks = Math.floor(area * (0.25 + Math.random() * 0.10))
  let rocksPlaced = 0

  while (rocksPlaced < targetRocks) {
    const cx = Math.floor(Math.random() * w)
    const cy = Math.floor(Math.random() * h)

    const maxCluster = Math.max(4, Math.floor(area * 0.06))
    const roll = Math.random()
    const size = roll < 0.25 ? 1 + Math.floor(Math.random() * Math.max(2, maxCluster * 0.05))
      : roll < 0.50 ? Math.floor(maxCluster * 0.05) + Math.floor(Math.random() * maxCluster * 0.15)
      : roll < 0.75 ? Math.floor(maxCluster * 0.15) + Math.floor(Math.random() * maxCluster * 0.3)
      : Math.floor(maxCluster * 0.3) + Math.floor(Math.random() * maxCluster * 0.7)

    // Grow organically from center using random walk
    const tiles = new Set<string>()
    tiles.add(`${cx},${cy}`)
    const frontier = [{ x: cx, y: cy }]

    while (tiles.size < size && frontier.length > 0) {
      const idx = Math.floor(Math.random() * frontier.length)
      const base = frontier[idx]

      const offsets = shuffle([{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }])
      let grew = false
      for (const off of offsets) {
        const nx = base.x + off.x, ny = base.y + off.y
        const key = `${nx},${ny}`
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        if (tiles.has(key)) continue
        tiles.add(key)
        frontier.push({ x: nx, y: ny })
        grew = true
        break
      }
      if (!grew) frontier.splice(idx, 1)
    }

    for (const key of tiles) {
      const [tx, ty] = key.split(',').map(Number)
      if (pathTiles.has(key)) continue
      if (tx === spawnX && ty === spawnY) continue
      if (tx === stairX && ty === stairY) continue
      if (!walls[ty][tx]) {
        walls[ty][tx] = true
        rocksPlaced++
      }
    }
  }

  return {
    walls,
    spawn: { x: spawnX, y: spawnY },
    stair: { x: stairX, y: stairY },
  }
}

/**
 * Maze template — applies generated maze to editor state.
 */
export function generateMaze(state: EditorState): void {
  const w = state.snapshot.mapWidth
  const h = state.snapshot.mapHeight
  if (w < 5 || h < 5) return

  const result = generateMazeGrid(w, h)

  state.mutate(d => {
    clearState(d, w * h)

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        d.groundLayer[idx] = GROUND_TILE
        if (result.walls[y][x]) d.wallsLayer[idx] = WALL_TILE
      }
    }

    if (result.spawn) d.playerSpawn = { tileX: result.spawn.x, tileY: result.spawn.y, facing: 'up' }
    if (result.stair) d.stairs = [{ tileX: result.stair.x, tileY: result.stair.y, targetMapId: null }]
  })
}

/**
 * Terrain template — applies generated terrain to editor state.
 */
export function generateTerrain(state: EditorState): void {
  const w = state.snapshot.mapWidth
  const h = state.snapshot.mapHeight
  if (w < 5 || h < 5) return

  const result = generateTerrainGrid(w, h)

  state.mutate(d => {
    clearState(d, w * h)

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        d.groundLayer[idx] = GROUND_TILE
        if (result.walls[y][x]) d.wallsLayer[idx] = WALL_TILE
      }
    }

    if (result.spawn) d.playerSpawn = { tileX: result.spawn.x, tileY: result.spawn.y, facing: 'up' }
    if (result.stair) d.stairs = [{ tileX: result.stair.x, tileY: result.stair.y, targetMapId: null }]
  })
}
