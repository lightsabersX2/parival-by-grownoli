// A small JPEG of an ad for the rows, made with macOS's own sips and kept until the PNG changes.
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** The path of a JPEG of `file` whose longest side is at most `size`, made on first ask; null where sips is missing. */
export async function thumbnail(file: string, size: number, cacheDir: string): Promise<string | null> {
  const src = await stat(file)
  const out = join(cacheDir, `${createHash('sha1').update(`${file}:${src.mtimeMs}:${size}`).digest('hex')}.jpg`)
  try { await stat(out); return out } catch { /* not made yet */ }
  await mkdir(cacheDir, { recursive: true })
  try { await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', String(size), file, '--out', out]); return out } catch { return null }
}
