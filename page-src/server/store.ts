// Everything the page writes: feedback.json in a set's folder, and nowhere else. A set id is
// "<run>/<company>"; one that names anything but an existing folder two levels inside the runs folder is refused.
import { applyVersion } from './feedback.ts'
import { readFile, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import type { Feedback, Pin, Rating } from './types.ts'

const notSet = (id: string) => new Error(`not a set: ${id}`)

/** The set's folder, after checking that it is one, inside the runs folder (symlinks followed). */
export async function setDir(outDir: string, id: string): Promise<string> {
  const parts = id.split('/')
  if (parts.length !== 2 || parts.some((p) => !p || p === '.' || p === '..' || p.includes('\\'))) throw notSet(id)
  try {
    const root = await realpath(outDir)
    const dir = await realpath(join(root, ...parts))
    const rel = relative(root, dir)
    if (rel.split(sep).length !== 2 || rel.startsWith('..') || !(await stat(dir)).isDirectory()) throw notSet(id)
    return dir
  } catch {
    throw notSet(id)
  }
}

/** A file inside the runs folder to serve read-only, or null. */
export async function fileInOut(outDir: string, rel: string): Promise<string | null> {
  try {
    const root = await realpath(outDir)
    const file = await realpath(join(root, rel))
    return file.startsWith(root + sep) && (await stat(file)).isFile() ? file : null
  } catch {
    return null
  }
}

/** "Show in Finder": the disk paths of these files or folders, or null if any is missing or lies outside the runs folder. */
export async function revealPaths(outDir: string, rels: string[]): Promise<string[] | null> {
  if (!rels.length) return null
  const found: string[] = []
  for (const rel of rels) {
    try {
      const root = await realpath(outDir)
      const file = await realpath(join(root, rel))
      if (!rel || !file.startsWith(root + sep)) return null
      found.push(file)
    } catch {
      return null
    }
  }
  return found
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}
async function writeJson(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n')
  await rename(tmp, file)
}

export interface FeedbackPatch {
  format?: string
  rating?: Rating
  note?: string
  /** the version the rating or note is about, and the set's latest version (where an old undated note belongs) */
  round?: number
  latest?: number
  pins?: Pin[]
  setNote?: string
  setRating?: Rating
}

export async function saveFeedback(outDir: string, id: string, patch: FeedbackPatch): Promise<Feedback> {
  const file = join(await setDir(outDir, id), 'feedback.json')
  const fb = await readJson<Feedback>(file, { ads: {} })
  fb.ads ??= {}
  if (patch.format) {
    const latest = patch.latest ?? patch.round ?? 1
    fb.ads[patch.format] = applyVersion(fb.ads[patch.format], latest, patch.round ?? latest, { rating: patch.rating, note: patch.note, pins: patch.pins })
  }
  if (patch.setNote !== undefined) fb.set_note = patch.setNote
  if (patch.setRating !== undefined) fb.set_rating = patch.setRating
  fb.updated = new Date().toISOString()
  await writeJson(file, fb)
  return fb
}

