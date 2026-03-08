const MAP_W = 20
const MAP_H = 15

/**
 * Build a Tiled-compatible JSON object from string tile-key layers.
 * Used by GameScene and TestMode to inject tilemaps into Phaser's cache at runtime.
 */
export function buildTiledMapJson(groundLayer: readonly string[], wallsLayer: readonly string[]): object {
  // Collect all unique tile keys across both layers
  const usedKeys = new Set<string>()
  for (const key of groundLayer) if (key !== '') usedKeys.add(key)
  for (const key of wallsLayer) if (key !== '') usedKeys.add(key)

  // Sort for deterministic GID assignment
  const sortedKeys = [...usedKeys].sort()

  // Assign GIDs: each tile key gets its own tileset entry
  const keyToGid = new Map<string, number>()
  const tilesets: object[] = []
  let nextGid = 1

  for (const key of sortedKeys) {
    keyToGid.set(key, nextGid)
    tilesets.push({
      columns: 1,
      firstgid: nextGid,
      image: `../../assets/tilesets/${key}.png`,
      imageheight: 32,
      imagewidth: 32,
      margin: 0,
      name: key,
      spacing: 0,
      tilecount: 1,
      tileheight: 32,
      tilewidth: 32,
    })
    nextGid++
  }

  const toGidLayer = (layer: readonly string[]): number[] =>
    layer.map(key => key === '' ? 0 : (keyToGid.get(key) ?? 0))

  return {
    compressionlevel: -1,
    height: MAP_H,
    width: MAP_W,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tilewidth: 32,
    tileheight: 32,
    tiledversion: '1.10.2',
    type: 'map',
    version: '1.10',
    nextlayerid: 3,
    nextobjectid: 1,
    layers: [
      {
        data: toGidLayer(groundLayer),
        height: MAP_H,
        width: MAP_W,
        id: 1,
        name: 'Ground',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        x: 0,
        y: 0,
      },
      {
        data: toGidLayer(wallsLayer),
        height: MAP_H,
        width: MAP_W,
        id: 2,
        name: 'Walls',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        x: 0,
        y: 0,
      },
    ],
    tilesets,
  }
}
