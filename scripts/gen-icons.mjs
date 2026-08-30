// Generates the app icons as real PNGs with no image dependency.
// Draws a cold-blue progress arc: the app's whole idea in one mark.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const CRC_TABLE = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  // rows are filter-type 0 (None) prefixed, which compresses fine for flat art
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const o = y * (1 + width * 4)
    raw[o] = 0
    rgba.copy(raw, o + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [0x08, 0x09, 0x0b]
// ice-white -> sky -> deep cyan, walked along the sweep of the arc
const STOPS = [
  [0.0, [0xe0, 0xf7, 0xff]],
  [0.35, [0x7d, 0xd3, 0xfc]],
  [0.7, [0x38, 0xbd, 0xf8]],
  [1.0, [0x02, 0x84, 0xc7]],
]

function gradient(t) {
  t = Math.min(1, Math.max(0, t))
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1]
      const [t1, c1] = STOPS[i]
      const f = (t - t0) / (t1 - t0)
      return c0.map((c, j) => c + (c1[j] - c) * f)
    }
  }
  return STOPS.at(-1)[1]
}

const TAU = Math.PI * 2
// Start at the top and sweep clockwise, stopping short so the gap reads as "in progress".
const START = -Math.PI / 2 + 0.42
const SWEEP = TAU * 0.82

function drawIcon(size, ringScale) {
  const SS = 4 // supersample factor for antialiasing
  const px = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const rOuter = size * ringScale
  const thickness = size * ringScale * 0.315
  const rInner = rOuter - thickness
  const rMid = (rOuter + rInner) / 2
  const capR = thickness / 2

  // endpoints for the round caps
  const caps = [START, START + SWEEP].map((a) => [cx + Math.cos(a) * rMid, cy + Math.sin(a) * rMid])

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0
      let tAcc = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px_ = x + (sx + 0.5) / SS - cx
          const py_ = y + (sy + 0.5) / SS - cy
          const d = Math.hypot(px_, py_)
          let inside = false
          let t = 0
          if (d >= rInner && d <= rOuter) {
            let a = Math.atan2(py_, px_) - START
            a = ((a % TAU) + TAU) % TAU
            if (a <= SWEEP) {
              inside = true
              t = a / SWEEP
            }
          }
          if (!inside) {
            // round off the two ends of the stroke
            for (let i = 0; i < caps.length; i++) {
              if (Math.hypot(x + (sx + 0.5) / SS - caps[i][0], y + (sy + 0.5) / SS - caps[i][1]) <= capR) {
                inside = true
                t = i
                break
              }
            }
          }
          if (inside) {
            hit++
            tAcc += t
          }
        }
      }
      const o = (y * size + x) * 4
      const cov = hit / (SS * SS)
      const col = hit ? gradient(tAcc / hit) : BG
      for (let i = 0; i < 3; i++) px[o + i] = Math.round(BG[i] + (col[i] - BG[i]) * cov)
      px[o + 3] = 255
    }
  }
  return encodePNG(size, size, px)
}

const out = join(process.cwd(), 'public')
mkdirSync(out, { recursive: true })

// Standard icons use a generous ring; the maskable variant shrinks it into the 80% safe zone.
for (const [file, size, scale] of [
  ['icon-180.png', 180, 0.37],
  ['icon-192.png', 192, 0.37],
  ['icon-512.png', 512, 0.37],
  ['icon-maskable-512.png', 512, 0.29],
]) {
  writeFileSync(join(out, file), drawIcon(size, scale))
  console.log('wrote public/' + file)
}

const arcPath = (() => {
  const r = 34
  const [x0, y0] = [50 + Math.cos(START) * r, 50 + Math.sin(START) * r]
  const [x1, y1] = [50 + Math.cos(START + SWEEP) * r, 50 + Math.sin(START + SWEEP) * r]
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
})()

writeFileSync(
  join(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#E0F7FF"/><stop offset=".5" stop-color="#38BDF8"/><stop offset="1" stop-color="#0284C7"/>
  </linearGradient></defs>
  <rect width="100" height="100" rx="22" fill="#08090B"/>
  <path d="${arcPath}" fill="none" stroke="url(#g)" stroke-width="21" stroke-linecap="round"/>
</svg>\n`,
)
console.log('wrote public/favicon.svg')
