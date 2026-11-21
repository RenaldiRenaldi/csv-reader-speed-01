// Fresh-process, paired LOCAL comparison with a committed version of this entry.
// All temporary files stay inside the repository and are removed afterwards.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const kit = resolve(process.argv[2]);
const revision = process.argv[3] ?? '558ecf5';
const rounds = Number(process.argv[4] ?? 11);
assert.ok(Number.isInteger(rounds) && rounds >= 5);
const temp = mkdtempSync(join(root, '.bench-'));
const practice = join(kit, 'practice/input');
const expected = Buffer.from(JSON.stringify(JSON.parse(readFileSync(join(kit, 'practice/reference/expected.json'))).cases.map(c => c.output)));
try {
  const old = spawnSync('git', ['show', `${revision}:solve.js`], { cwd: root, encoding: 'utf8' });
  assert.equal(old.status, 0, old.stderr);
  writeFileSync(join(temp, 'solve.js'), old.stdout);
  const driver = spawnSync('git', ['show', `${revision}:main.ts`], { cwd: root, encoding: 'utf8' });
  assert.equal(driver.status, 0, driver.stderr);
  // Optional ablation isolates parser changes with the current driver on both.
  writeFileSync(join(temp, 'main.ts'), process.argv[5] === '--same-driver'
    ? readFileSync(join(root, 'main.ts')) : driver.stdout);
  const samples = [[], []];
  for (let round = -1; round < rounds; round++) {
    for (const i of [Math.abs(round) % 2, 1 - Math.abs(round) % 2]) {
      const main = join(i === 0 ? temp : root, 'main.ts');
      const code = `await import(${JSON.stringify(main)});const c=process.cpuUsage();console.log(c.user+c.system)`;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
        encoding: 'utf8',
        env: { ...process.env, MAKEFUN_INPUT_DIR: practice, MAKEFUN_OUTPUT_DIR: temp },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(readFileSync(join(temp, 'answers.json')).equals(expected), `Output mismatch: program ${i}, round ${round}`);
      if (round >= 0) samples[i].push(Number(result.stdout));
    }
  }
  const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
  const [before, after] = samples.map(median);
  console.log(JSON.stringify({ label: 'LOCAL fresh-process CPU, microseconds', node: process.version, revision, sameDriver: process.argv[5] === '--same-driver', rounds, before, after, saved: before - after, percent: 100 * (before - after) / before, samples }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
