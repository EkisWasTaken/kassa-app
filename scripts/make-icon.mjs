// Draws the Kassa icon (dark rounded square, white "k", blue dot) to build/icon.png.
// No image libraries: shapes are signed-distance functions, antialiased per pixel, written as a PNG with zlib.
// Run: npm run icon
import fs from 'node:fs'
import zlib from 'node:zlib'

const N = 1024
const INK = [22, 22, 26], WHITE = [255, 255, 255], BLUE = [51, 85, 255]

// Shapes in a 0..1 coordinate space (the same numbers drive the SVG logo in src/Logo.vue)
const roundedRect = (x, y, r) => { const qx = Math.abs(x - 0.5) - (0.5 - r), qy = Math.abs(y - 0.5) - (0.5 - r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r }
const capsule = (x, y, ax, ay, bx, by, r) => { const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay; const h = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy))); return Math.hypot(px - dx * h, py - dy * h) - r }
const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r

// Stem, arm, leg. The arm starts on the stem's axis and the leg on the arm's axis, so the round caps hide inside.
const K = [[0.33, 0.24, 0.33, 0.76], [0.33, 0.6, 0.6, 0.38], [0.47, 0.486, 0.62, 0.76]]
const layers = [
  [INK, (x, y) => roundedRect(x, y, 0.22)],
  [WHITE, (x, y) => Math.min(...K.map(([ax, ay, bx, by]) => capsule(x, y, ax, ay, bx, by, 0.058)))],
  [BLUE, (x, y) => circle(x, y, 0.75, 0.71, 0.068)],
]

const px = Buffer.alloc(N * N * 4)
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = (i + 0.5) / N, y = (j + 0.5) / N
  let r = 0, g = 0, b = 0, a = 0
  for (const [c, sdf] of layers) {
    const cov = Math.max(0, Math.min(1, 0.5 - sdf(x, y) * N)) // distance in pixels -> coverage
    if (!cov) continue
    r = c[0] * cov + r * (1 - cov); g = c[1] * cov + g * (1 - cov); b = c[2] * cov + b * (1 - cov); a = cov + a * (1 - cov)
  }
  const o = (j * N + i) * 4
  // un-premultiply so edges against transparency stay the right colour
  px[o] = a ? r / a : 0; px[o + 1] = a ? g / a : 0; px[o + 2] = a ? b / a : 0; px[o + 3] = Math.round(a * 255)
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }

const raw = Buffer.alloc(N * (N * 4 + 1))
for (let j = 0; j < N; j++) px.copy(raw, j * (N * 4 + 1) + 1, j * N * 4, (j + 1) * N * 4) // filter byte 0 per row
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])

fs.mkdirSync('build', { recursive: true })
fs.writeFileSync('build/icon.png', png)
console.log(`build/icon.png ${N}x${N}, ${(png.length / 1024).toFixed(0)} KB`)
