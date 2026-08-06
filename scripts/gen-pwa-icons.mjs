/**
 * Generates public/pwa-192.png and public/pwa-512.png —
 * Disc star on brand green (#1C7C2E).
 * Run: node scripts/gen-pwa-icons.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

function starSvg(size) {
  // Star path from Splash (viewBox 0 0 100 100), scaled into a padded square
  const pad = size * 0.22
  const star = size - pad * 2
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1C7C2E"/>
  <g transform="translate(${pad} ${pad}) scale(${star / 100})">
    <path
      d="M50 5 C47 32 32 47 5 50 C32 53 47 68 50 95 C53 68 68 53 95 50 C68 47 53 32 50 5Z"
      fill="#FFFFFF"
    />
  </g>
</svg>`
}

for (const size of [192, 512]) {
  const resvg = new Resvg(starSvg(size), {
    fitTo: { mode: 'width', value: size },
  })
  const png = resvg.render().asPng()
  const out = join(publicDir, `pwa-${size}.png`)
  writeFileSync(out, png)
  console.log('wrote', out)
}

// Apple touch icon (180×180) — same artwork
{
  const size = 180
  const resvg = new Resvg(starSvg(size), {
    fitTo: { mode: 'width', value: size },
  })
  const out = join(publicDir, 'apple-touch-icon.png')
  writeFileSync(out, resvg.render().asPng())
  console.log('wrote', out)
}
