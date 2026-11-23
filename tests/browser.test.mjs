// The local page in a real headless browser: it shows the run, the support address and the copyright notice, saves a
// note typed into it, and asks for nothing outside its own address. SHOTS=<folder> keeps screenshots to look at.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { answeredHome, browser, fakeRuns, pluginCopy } from './helpers.mjs'

answeredHome()

const PAGE = path.join(pluginCopy(), 'skills', 'local-page', 'scripts', 'page.mjs')
const page = (...args) => JSON.parse(execFileSync(process.execPath, [PAGE, ...args], { encoding: 'utf8' }))
const runs = process.env.RUNS ?? fakeRuns({ loops: 2 }).runs
const { address } = page('start', runs, '--no-open', '--port', '5395')
test.after(() => { if (!process.env.RUNS) page('stop', runs) })
const shot = async (b, name) => { if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await b.screenshot(path.join(process.env.SHOTS, `${name}.png`)) } }
const click = (sel) => `(() => { const e = ${sel}; if (!e) return false; e.click(); return true })()`
const byLabel = (label) => `[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent).trim().startsWith(${JSON.stringify(label)}))`

for (const [name, opts] of [['light', {}], ['dark', { dark: true }], ['phone', { width: 390, height: 844 }]]) {
  test(`shows the run, the support address and the copyright notice (${name})`, async () => {
    const b = await browser(address, opts)
    try {
      // pictures below the fold load when scrolled to, so at phone width only the first ones are waited for
      await b.until(`document.querySelectorAll('figure img').length >= 10 && [...document.querySelectorAll('figure img')].${name === 'phone' ? 'some' : 'every'}((i) => i.naturalWidth > 0)`)
      assert.equal(await b.evaluate(`document.querySelectorAll('figure img').length % 5`), 0, 'every ad shows its five formats')
      await shot(b, `${name}-run`)
      assert.doesNotMatch(await b.evaluate(`document.body.innerText`), /Adam Lithner/, 'the copyright line lives in About, not on the page around it')
      if (name === 'phone') assert.ok(await b.evaluate(click(byLabel('About and Support'))))
      else await b.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', metaKey: true }))`)
      await b.until(`!!document.querySelector('[aria-labelledby=settings-title]')`)
      const settings = await b.evaluate(`document.querySelector('[aria-labelledby=settings-title]').innerText`)
      assert.match(settings, /hello@grownoli\.com/)
      assert.match(settings, /Copyright 2026 Adam Lithner/)
      const about = await b.evaluate(`[...document.querySelectorAll('[aria-labelledby=settings-title] h3')].find((h) => h.textContent.trim() === 'About').parentElement.innerText`)
      for (const line of [/version \d+\.\d+\.\d+/, /Copyright 2026 Adam Lithner/, /Open source under the Apache License 2\.0/, /Parival sends Grownoli the statistics below while they are on, and asks Grownoli which version is the latest\. Parival sends nothing else\./]) assert.match(about, line)
      assert.doesNotMatch(settings, /anonym|sends nothing anywhere/i)
      assert.match(settings, /Share statistics/)
      assert.match(settings, /such as runs, ads, formats and errors, with a random ID made on this computer\. The ID is not linked to your name, your email or your Claude account\. Turning statistics off deletes the ID\./)
      assert.match(settings, /Parival is free\. A contribution helps its development and unlocks nothing\./)
      assert.equal(await b.evaluate(`[...document.querySelectorAll('[aria-labelledby=settings-title] a')].find((a) => a.textContent.trim() === 'Contribute').href`), 'https://buymeacoffee.com/lightsabersx2')
      assert.match(await b.evaluate(`fetch([...document.querySelectorAll('[aria-labelledby=settings-title] a')].find((a) => a.textContent.trim() === 'Statistics Report').href).then((r) => r.text())`), /Statistics are off\. Parival sends no report\./)
      const links = await b.evaluate(`Promise.all([...document.querySelectorAll('[aria-labelledby=settings-title] a[href^="/about/"]')].map(async (a) => [a.textContent.trim(), (await (await fetch(a.href)).text()).slice(0, 4000)]))`)
      assert.deepEqual(links.map((l) => l[0]), ['Licence', 'Third-party notices'])
      assert.match(links[0][1], /Apache License/)
      assert.match(links[1][1], /Third-party notices/)
      assert.equal(await b.evaluate(`document.querySelector('[aria-labelledby=settings-title] a[href^=mailto]').href`), 'mailto:hello@grownoli.com')
      await shot(b, `${name}-settings`)
      const outside = b.requests.filter((u) => !u.startsWith(address) && !u.startsWith('data:') && u !== 'about:blank')
      assert.deepEqual(outside, [], 'the page asks for nothing outside its own address')
    } finally { b.close() }
  })
}

test('a note typed on the page reaches the comments command, and the versions open side by side', async () => {
  const b = await browser(address)
  try {
    await b.until(byLabel('Select 1:1'))
    assert.ok(await b.evaluate(click(byLabel('Select 1:1'))))
    await b.until(`!!document.querySelector('aside textarea')`)
    const words = `Typed in the browser ${Date.now()}`
    await b.evaluate(`(() => { const t = document.querySelector('aside textarea'); t.focus(); t.value = ${JSON.stringify(words)}; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('blur')) })()`)
    await b.until(`[...document.querySelectorAll('[role=status]')].some((e) => e.textContent.trim() === 'Saved')`)
    await shot(b, 'light-panel')
    const found = page('comments', runs).runs.flatMap((r) => r.ads.flatMap((a) => a.versions.map((v) => v.note)))
    assert.ok(found.includes(words), `the comments command printed ${JSON.stringify(found)}`)
    assert.ok(await b.evaluate(click(byLabel('Compare Versions'))))
    await b.until(`document.querySelectorAll('[role=dialog] figure').length >= 2 && [...document.querySelectorAll('[role=dialog] img')].every((i) => i.naturalWidth > 0)`)
    await shot(b, 'light-versions')
  } finally { b.close() }
})

// a second page with its own Parival folder, for what depends on a first visit and on finished runs
function freshPage(port, { loops = 3, count = 3, answered = false } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'parival-fresh-'))
  if (answered) answeredHome(false, home)
  const env = { ...process.env, PARIVAL_HOME: home }
  const { runs } = fakeRuns({ loops, count })
  const started = JSON.parse(execFileSync(process.execPath, [PAGE, 'start', runs, '--no-open', '--port', String(port)], { encoding: 'utf8', env }))
  const settings = () => { try { return JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8')) } catch { return {} } }
  return { address: started.address, settings, stop: () => execFileSync(process.execPath, [PAGE, 'stop', runs], { env }) }
}

test('the first visit shows the notice once, and Turn Off Statistics leaves no ID', async () => {
  const p = freshPage(5411)
  const b = await browser(p.address)
  try {
    await b.until(`!!document.querySelector('[role=alertdialog]')`)
    const notice = await b.evaluate(`document.querySelector('[role=alertdialog]').innerText`)
    assert.match(notice, /Parival sends Grownoli counts/)
    assert.match(notice, /The counts carry a random ID made on this computer\. The ID is not linked to your name, your email or your Claude account\./)
    assert.match(notice, /Parival never sends websites, brand names, ad copy, pictures, file names or comments\./)
    assert.doesNotMatch(notice, /anonym/i)
    assert.deepEqual(await b.evaluate(`[...document.querySelectorAll('[role=alertdialog] button')].map((x) => x.textContent.trim())`), ['Turn Off Statistics', 'OK'])
    assert.equal('noticeShown' in p.settings(), false, 'showing the notice is not an answer')
    await shot(b, 'light-notice')
    assert.ok(await b.evaluate(click(byLabel('Turn Off Statistics'))))
    await b.until(`!document.querySelector('[role=alertdialog]')`)
    for (const t = Date.now(); !p.settings().noticeShown && Date.now() - t < 3000;) await new Promise((r) => setTimeout(r, 50))
    assert.deepEqual([p.settings().statistics, 'installId' in p.settings()], [false, false])
    const again = await browser(p.address)
    try { await again.until(`document.querySelectorAll('figure img').length > 0`); assert.equal(await again.evaluate(`!!document.querySelector('[role=alertdialog]')`), false, 'the notice shows once') } finally { again.close() }
  } finally { b.close(); p.stop() }
})

test('the donation ask waits for an opened finished run and a closed panel, and Not Now closes it', async () => {
  const p = freshPage(5413, { answered: true })
  const b = await browser(p.address)
  const prompt = `[...document.querySelectorAll('[role=dialog]')].find((d) => /Parival is free/.test(d.innerText))`
  try {
    await b.until(byLabel('Select 1:1'))
    await new Promise((r) => setTimeout(r, 1200))
    assert.equal(await b.evaluate(`!!${prompt}`), false, 'never at start')
    assert.ok(await b.evaluate(click(byLabel('Select 1:1'))))
    await b.until(`!!document.querySelector('aside textarea')`)
    await new Promise((r) => setTimeout(r, 800))
    assert.equal(await b.evaluate(`!!${prompt}`), false, 'never while an ad is open for a note or a comment')
    assert.ok(await b.evaluate(click(byLabel('Close'))))
    await b.until(`!!${prompt}`)
    assert.match(await b.evaluate(`${prompt}.innerText`), /A contribution helps its development and unlocks nothing\./)
    assert.deepEqual(await b.evaluate(`[...${prompt}.querySelectorAll('a, button')].map((x) => x.textContent.trim())`), ['Contribute', 'Not Now', 'Already Supported'])
    assert.equal(await b.evaluate(`${prompt}.querySelector('a').href`), 'https://buymeacoffee.com/lightsabersx2')
    await shot(b, 'light-support')
    assert.ok(await b.evaluate(click(byLabel('Not Now'))))
    await b.until(`!${prompt}`)
    assert.equal(p.settings().support.asks, 1)
    assert.deepEqual(b.requests.filter((u) => !u.startsWith(p.address) && !u.startsWith('data:') && u !== 'about:blank'), [], 'the page itself still asks for nothing outside its own address')
  } finally { b.close(); p.stop() }
})
