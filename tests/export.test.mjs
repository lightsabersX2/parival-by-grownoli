// The Studio export's ground: one plain colour is handed over as the Studio's own background colour, with no picture
// layer for it, and a ground that is not one colour stays a locked flat picture. Read from the project file, not from
// the Studio.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pluginCopy } from './helpers.mjs'

const EXPORT = path.join(pluginCopy(), 'skills', 'studio-export', 'scripts', 'studio-export.mjs')
function project(css, size = '1080x1080', more = '') {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'parival-export-')), 'an ad')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'ad.html'), `<!doctype html><html><head><style>html,body{margin:0}${css}</style></head><body><div class="ground"></div><div class="shape"></div>${more}<h1 data-role="headline" style="position:absolute;left:100px;top:120px;margin:0;font:700 90px Helvetica;color:#fff">Bread at six</h1></body></html>`)
  const out = JSON.parse(execFileSync(process.execPath, [EXPORT, path.join(dir, 'ad.html'), path.join(dir, 'ad.zip'), '--size', size], { encoding: 'utf8' }))
  // the ZIP is stored without compression, so the project file is read straight out of it
  const zip = fs.readFileSync(out.file), nameLen = zip.readUInt16LE(26), extra = zip.readUInt16LE(28), size_ = zip.readUInt32LE(18)
  assert.equal(zip.subarray(30, 30 + nameLen).toString(), 'project-data.json')
  return { out, config: JSON.parse(zip.subarray(30 + nameLen + extra, 30 + nameLen + extra + size_).toString()).config }
}
const SHAPE = '.shape{position:absolute;left:700px;top:700px;width:200px;height:200px;border-radius:50%;background:#ffd23f}'

test('a ground set on the page becomes the background colour, and the shape on it stays movable', { timeout: 60000 }, () => {
  const { out, config } = project(`body{background:#1f4fa3}${SHAPE}`)
  assert.equal(out.background, '#1f4fa3')
  assert.equal(config.backgroundEffects.backgroundColor, '#1f4fa3')
  assert.equal(config.customImages.length, 1, 'only the shape is a picture')
  assert.ok(config.customImages[0].width < 300)
  assert.deepEqual(config.lockedLayers, [])
  assert.equal(config.messageShapes.filter((s) => s.visible).at(-1).text, 'Bread at six')
})

test('a ground drawn as a full-size box becomes the background colour, in a tall format too', { timeout: 60000 }, () => {
  const { config } = project('.ground{position:absolute;inset:0;background:rgb(18,58,107)}', '1080x1920')
  assert.equal(config.backgroundEffects.backgroundColor, '#123a6b')
  assert.equal(config.customImages.length, 0)
  assert.deepEqual(config.lockedLayers, [])
})

test('a ground that is not one colour stays a locked flat picture', { timeout: 60000 }, () => {
  const { config } = project('body{background:linear-gradient(#1f4fa3,#0b1d3a)}')
  assert.equal(config.backgroundEffects.backgroundColor, '#ffffff')
  assert.equal(config.customImages.length, 1)
  assert.deepEqual(config.lockedLayers, [config.customImages[0].id])
})

test('a photo inside a cropping box marked as the hero is its own picture layer, and is not locked', { timeout: 60000 }, () => {
  const photo = `<div data-role="hero" style="position:absolute;left:0;top:300px;width:1080px;height:780px;overflow:hidden"><img src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#c33"/><circle cx="600" cy="450" r="300" fill="#fc0"/></svg>')}" style="position:absolute;width:1200px;height:900px;left:-60px;top:-60px"></div>`
  const { config } = project('body{background:#f4f0e4}', '1080x1080', photo)
  assert.equal(config.backgroundEffects.backgroundColor, '#f4f0e4')
  const hero = config.customImages.find((i) => /hero/.test(i.id))
  assert.ok(hero && Math.round(hero.width) === 1080 && Math.round(hero.height) === 780, 'the photo arrives as it was cropped')
  assert.deepEqual(config.lockedLayers, [])
})
