// The local page in a real headless browser: it shows the run, the support address and the copyright notice, saves a
// note typed into it, and asks for nothing outside its own address. SHOTS=<folder> keeps screenshots to look at.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { browser, fakeRuns, pluginCopy } from './helpers.mjs'

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
      for (const line of [/version \d+\.\d+\.\d+/, /Copyright 2026 Adam Lithner/, /Open source under the Apache License 2\.0/, /runs on this computer only and sends nothing/]) assert.match(about, line)
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
