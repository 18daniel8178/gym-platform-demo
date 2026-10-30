// Convierte los JPEG del proyecto a WebP comprimido (ejecutar una vez tras añadir imágenes nuevas).
// Uso: node scripts/optimize-images.mjs
import sharp from 'sharp'
import { readdir, stat } from 'node:fs/promises'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIRS = [join(root, 'public', 'img'), join(root, 'src', 'assets')]
const MAX_WIDTH = 1200
const QUALITY = 72

let totalJpg = 0
let totalWebp = 0

for (const dir of DIRS) {
  let files
  try {
    files = await readdir(dir)
  } catch {
    continue
  }
  for (const file of files) {
    if (!/\.jpe?g$/i.test(file)) continue
    const src = join(dir, file)
    const out = join(dir, file.replace(extname(file), '.webp'))
    const before = (await stat(src)).size
    await sharp(src)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(out)
    const after = (await stat(out)).size
    totalJpg += before
    totalWebp += after
    const pct = Math.round((1 - after / before) * 100)
    console.log(`${file.padEnd(28)} ${(before / 1024).toFixed(0).padStart(5)} KB -> ${(after / 1024).toFixed(0).padStart(5)} KB  (-${pct}%)`)
  }
}

console.log(
  `\nTotal: ${(totalJpg / 1024 / 1024).toFixed(2)} MB -> ${(totalWebp / 1024 / 1024).toFixed(2)} MB  (-${Math.round((1 - totalWebp / totalJpg) * 100)}%)`
)
