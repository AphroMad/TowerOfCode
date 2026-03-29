/**
 * Generate pixel art tile PNGs for teleporter, warp, and directional arrows.
 * Run with: node scripts/generate-tiles.mjs
 */
import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const SIZE = 32

function save(path, canvas) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, canvas.toBuffer('image/png'))
  console.log(`  ✓ ${path}`)
}

function pixel(ctx, x, y, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

function circle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        ctx.fillRect(cx + x, cy + y, 1, 1)
      }
    }
  }
}

function ring(ctx, cx, cy, rOuter, rInner, color) {
  ctx.fillStyle = color
  for (let y = -rOuter; y <= rOuter; y++) {
    for (let x = -rOuter; x <= rOuter; x++) {
      const d = x * x + y * y
      if (d <= rOuter * rOuter && d >= rInner * rInner) {
        ctx.fillRect(cx + x, cy + y, 1, 1)
      }
    }
  }
}

// ── Teleporters ──
function makeTeleporter(name, glowA, glowB, dark, mid, ring1, ring2, bright) {
  const c = createCanvas(SIZE, SIZE)
  const ctx = c.getContext('2d')
  circle(ctx, 16, 16, 14, glowA)
  circle(ctx, 16, 16, 12, glowB)
  circle(ctx, 16, 16, 10, dark)
  circle(ctx, 16, 16, 8, mid)
  ring(ctx, 16, 16, 7, 5, ring1)
  ring(ctx, 16, 16, 4, 2, ring2)
  circle(ctx, 16, 16, 2, bright)
  pixel(ctx, 16, 16, '#ffffff')
  pixel(ctx, 12, 10, bright)
  pixel(ctx, 20, 12, ring2)
  pixel(ctx, 14, 20, ring1)
  pixel(ctx, 19, 19, bright)
  save(`src/assets/tilesets/objects/portal/${name}.png`, c)
}

// ── Warp ──
// A blue/cyan swirling portal
function makeWarp() {
  const c = createCanvas(SIZE, SIZE)
  const ctx = c.getContext('2d')

  // Outer glow (transparent background)
  circle(ctx, 16, 16, 14, 'rgba(10, 26, 58, 0.5)')
  circle(ctx, 16, 16, 12, 'rgba(10, 42, 74, 0.6)')

  // Portal body
  circle(ctx, 16, 16, 10, '#1144aa')
  circle(ctx, 16, 16, 8, '#2266cc')

  // Swirl rings
  ring(ctx, 16, 16, 7, 5, '#3388dd')
  ring(ctx, 16, 16, 4, 2, '#55aaff')

  // Center bright
  circle(ctx, 16, 16, 2, '#88ccff')
  pixel(ctx, 16, 16, '#ffffff')

  // Sparkle accents
  pixel(ctx, 11, 11, '#88ccff')
  pixel(ctx, 21, 13, '#55aaff')
  pixel(ctx, 13, 21, '#88ccff')
  pixel(ctx, 20, 20, '#55aaff')
  pixel(ctx, 10, 16, '#aaddff')
  pixel(ctx, 22, 16, '#aaddff')

  save('src/assets/tilesets/objects/portal/warp.png', c)
}

// ── Arrow tiles ──
// Clean arrow on a subtle stone background
function makeArrow(direction, filename) {
  const c = createCanvas(SIZE, SIZE)
  const ctx = c.getContext('2d')

  // Stone background
  ctx.fillStyle = '#3a3a4a'
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Subtle border
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(0, 0, SIZE, 1)
  ctx.fillRect(0, 31, SIZE, 1)
  ctx.fillRect(0, 0, 1, SIZE)
  ctx.fillRect(31, 0, 1, SIZE)

  // Slight texture
  ctx.fillStyle = '#3e3e4e'
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(Math.random() * 30) + 1
    const y = Math.floor(Math.random() * 30) + 1
    ctx.fillRect(x, y, 1, 1)
  }

  // Arrow color
  const col = '#ee8833'
  const colBright = '#ffaa44'

  // Draw arrow based on direction
  const cx = 16, cy = 16

  if (direction === 'up') {
    // Upward chevron
    for (let i = 0; i < 7; i++) {
      pixel(ctx, cx - i, cy + i - 3, col)
      pixel(ctx, cx + i, cy + i - 3, col)
      pixel(ctx, cx - i, cy + i - 2, col)
      pixel(ctx, cx + i, cy + i - 2, col)
    }
    // Bright center line
    for (let i = 0; i < 5; i++) {
      pixel(ctx, cx - i, cy + i - 2, colBright)
      pixel(ctx, cx + i, cy + i - 2, colBright)
    }
    // Tip
    pixel(ctx, cx, cy - 4, colBright)
    pixel(ctx, cx, cy - 3, colBright)
  } else if (direction === 'down') {
    for (let i = 0; i < 7; i++) {
      pixel(ctx, cx - i, cy - i + 3, col)
      pixel(ctx, cx + i, cy - i + 3, col)
      pixel(ctx, cx - i, cy - i + 2, col)
      pixel(ctx, cx + i, cy - i + 2, col)
    }
    for (let i = 0; i < 5; i++) {
      pixel(ctx, cx - i, cy - i + 2, colBright)
      pixel(ctx, cx + i, cy - i + 2, colBright)
    }
    pixel(ctx, cx, cy + 4, colBright)
    pixel(ctx, cx, cy + 3, colBright)
  } else if (direction === 'left') {
    for (let i = 0; i < 7; i++) {
      pixel(ctx, cx + i - 3, cy - i, col)
      pixel(ctx, cx + i - 3, cy + i, col)
      pixel(ctx, cx + i - 2, cy - i, col)
      pixel(ctx, cx + i - 2, cy + i, col)
    }
    for (let i = 0; i < 5; i++) {
      pixel(ctx, cx + i - 2, cy - i, colBright)
      pixel(ctx, cx + i - 2, cy + i, colBright)
    }
    pixel(ctx, cx - 4, cy, colBright)
    pixel(ctx, cx - 3, cy, colBright)
  } else if (direction === 'right') {
    for (let i = 0; i < 7; i++) {
      pixel(ctx, cx - i + 3, cy - i, col)
      pixel(ctx, cx - i + 3, cy + i, col)
      pixel(ctx, cx - i + 2, cy - i, col)
      pixel(ctx, cx - i + 2, cy + i, col)
    }
    for (let i = 0; i < 5; i++) {
      pixel(ctx, cx - i + 2, cy - i, colBright)
      pixel(ctx, cx - i + 2, cy + i, colBright)
    }
    pixel(ctx, cx + 4, cy, colBright)
    pixel(ctx, cx + 3, cy, colBright)
  }

  save(`src/assets/tilesets/ground/arrows/${filename}.png`, c)
}

console.log('Generating tile sprites...')
// Purple (original)
makeTeleporter('teleporter_purple', 'rgba(42,26,58,0.5)', 'rgba(58,26,74,0.6)', '#5522aa', '#7733cc', '#9944ee', '#bb66ff', '#dd88ff')
// Red
makeTeleporter('teleporter_red', 'rgba(58,20,20,0.5)', 'rgba(74,26,26,0.6)', '#aa2222', '#cc3333', '#ee4444', '#ff6666', '#ff8888')
// Green
makeTeleporter('teleporter_green', 'rgba(20,58,26,0.5)', 'rgba(26,74,34,0.6)', '#22aa33', '#33cc44', '#44ee55', '#66ff77', '#88ff99')
// Gold
makeTeleporter('teleporter_gold', 'rgba(58,46,20,0.5)', 'rgba(74,58,26,0.6)', '#aa8822', '#cc9933', '#eeaa44', '#ffcc66', '#ffdd88')
makeWarp()
makeArrow('up', 'up')
makeArrow('down', 'down')
makeArrow('left', 'left')
makeArrow('right', 'right')
console.log('Done!')
