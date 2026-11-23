// The run script keeps the loops: critics and judges get only their own folder, a revision that does not win moves to
// rejected/, no format gets a fourth loop, and a locked format is left alone. Run from a folder with a space in its name.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { critique, fakeRuns, pluginCopy } from './helpers.mjs'

const RUN = path.join(pluginCopy(), 'skills', 'campaign-run', 'scripts', 'run.mjs')
const run = (...args) => JSON.parse(execFileSync(process.execPath, [RUN, ...args], { encoding: 'utf8' }))
const answer = (tasks, write) => { for (const t of tasks) write(t) }

test('new makes a dated set with an assets folder', () => {
  const { runs } = fakeRuns()
  const { set } = run('new', runs, 'Östra Bageriet', 'Autumn Bread')
  assert.match(set, /\/\d{4}-\d{2}-\d{2}-autumn-bread\/ostra-bageriet$/)
  assert.ok(fs.existsSync(path.join(set, 'assets')))
  assert.equal(JSON.parse(fs.readFileSync(path.join(set, '..', 'run.json'), 'utf8')).title, 'Autumn Bread', 'the title keeps its own letters beside an ASCII folder name')
})

test('three loops: blind staging, losers rejected, a locked format left alone, no fourth loop', () => {
  const { set } = fakeRuns()
  assert.equal(run('status', set).next, 'critique, then critique-apply')

  // loop 1: one folder per ad, holding only pictures, the brief and the critic's instructions
  const staged = run('critique', set).start_one_fresh_subagent_per_task
  assert.deepEqual(staged.map((t) => t.ad), ['bread', 'coffee'])
  for (const t of staged) {
    assert.deepEqual(fs.readdirSync(t.folder).filter((f) => !f.endsWith('.png')).sort(), ['brief.json', 'critic.md'])
    assert.equal(fs.readdirSync(t.folder).filter((f) => f.endsWith('.png')).length, 5)
    assert.match(fs.readFileSync(path.join(t.folder, 'critic.md'), 'utf8'), /Critic cases/)
    assert.ok(t.prompt.includes(t.folder) && !/notes|reason|loop/i.test(t.prompt.replace(t.folder, '')), 'the prompt carries nothing of the maker')
  }
  // a critic that leaves a file out is caught
  answer(staged, (t) => t.formats.slice(1).forEach((f) => fs.writeFileSync(path.join(t.folder, `${f}.json`), JSON.stringify(f === '3x4-bread' ? critique(5) : critique(3, ['headline too small'])))))
  assert.throws(() => run('critique-apply', set))
  answer(staged, (t) => fs.writeFileSync(path.join(t.folder, `${t.formats[0]}.json`), JSON.stringify(critique(3, ['logo touches the edge']))))
  const filed = run('critique-apply', set).filed
  assert.equal(filed['3x4-bread'].locked, true)
  assert.equal(JSON.parse(fs.readFileSync(path.join(set, '1x1-bread', 'loop-1', 'critique.json'), 'utf8')).defects[0], 'logo touches the edge')

  for (const loop of [2, 3]) {
    const revise = run('revise', set)
    assert.equal(Object.keys(revise.revise).length, 9, 'the locked format is not revised')
    assert.equal(revise.left_as_they_are['3x4-bread'], 'locked')
    for (const r of Object.values(revise.revise)) fs.copyFileSync(path.join(path.dirname(r.edit), '..', 'loop-1', 'ad.png'), path.join(path.dirname(r.edit), 'ad.png'))
    const pairs = run('judge', set).start_one_fresh_subagent_per_task
    for (const t of pairs) assert.deepEqual(fs.readdirSync(t.folder).filter((f) => !f.endsWith('.png')).sort(), ['brief.json', 'judge.md'], 'the judge gets no key')
    // the judge always answers A: with sides drawn by lot, some revisions win and some lose
    answer(pairs, (t) => fs.writeFileSync(path.join(t.folder, 'verdicts.json'), JSON.stringify(Object.fromEntries(t.formats.map((f) => [f, { winner: 'A', reason: 'clearer' }])))))
    const judged = run('judge-apply', set).judged
    for (const [f, j] of Object.entries(judged)) {
      const lost = fs.existsSync(path.join(set, f, 'rejected', `loop-${loop}`))
      assert.equal(lost, j.winner !== 'revision', `${f}: a revision that did not win sits in rejected/`)
      assert.equal(fs.existsSync(path.join(set, f, `loop-${loop}`)), !lost)
    }
    const again = run('status', set)
    if (again.next.startsWith('critique')) {
      answer(run('critique', set).start_one_fresh_subagent_per_task, (t) => t.formats.forEach((f) => fs.writeFileSync(path.join(t.folder, `${f}.json`), JSON.stringify(critique(3, ['still plain'])))))
      run('critique-apply', set)
    }
  }
  const end = run('status', set)
  assert.equal(end.done, true)
  for (const [f, row] of Object.entries(end.formats)) assert.equal(row.loops_used, f === '3x4-bread' ? 1 : 3, f)
  assert.deepEqual(run('revise', set).revise, {}, 'no fourth loop by itself')
  // a format the person names gets one more loop, numbered after every loop it has had
  assert.match(run('revise', set, '1x1-bread').revise['1x1-bread'].edit, /1x1-bread\/loop-4\/ad\.html$/)
  fs.writeFileSync(path.join(set, '1x1-bread', 'loop-4', 'ad.png'), 'x')
  assert.equal(run('status', set).formats['1x1-bread'].awaiting_judge, false, 'a loop the person asked for needs no judge')
})
