import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run } from '../solve.js';

const kit = resolve(process.argv[2]);
const draws = Number(process.argv[3] ?? 12);
const rounds = Number(process.argv[4] ?? 9);
assert.ok(Number.isInteger(draws) && draws > 0 && Number.isInteger(rounds) && rounds >= 5);
const root = fileURLToPath(new URL('..', import.meta.url));
const url = path => pathToFileURL(path).href;
const baseline = join(kit, 'baselines/csv-reader');
const { readCsv } = await import(url(join(baseline, 'vendor/csv-reader/index.js')));
const generator = join(kit, 'program/generator');
const { streamFor } = await import(url(join(generator, 'rng.ts')));
const { generate } = await import(url(join(generator, 'subject/csv-cases.mjs')));

function compare(text) {
  for (const header of [false, true]) {
    const input = { text, header };
    assert.equal(JSON.stringify(run(input)), JSON.stringify(readCsv(input)), JSON.stringify(input));
  }
}

const alphabet = ['a', ',', '"', '\r', '\n'];
function exhaust(text, remaining) {
  compare(text);
  if (remaining > 0) for (const char of alphabet) exhaust(text + char, remaining - 1);
}
exhaust('', 7);
exhaust('\uFEFF', 6);
for (const text of ['a,東京\r\n😀,\ud800', '"a"\rb\r,c', 'a,b,c\n1\n1,2,3,4']) compare(text);
console.log('234,380 exhaustive and targeted inputs matched byte for byte');

const temp = mkdtempSync(join(tmpdir(), 'csv-reader-verify-'));
try {
  const input = join(temp, 'input');
  const output = join(temp, 'output');
  mkdirSync(input);
  mkdirSync(output);
  const casesPath = join(input, 'cases.json');
  const answerPath = join(output, 'answers.json');

  function execute(directory) {
    const script = `await import(${JSON.stringify(url(join(directory, 'main.ts')))}); const {user, system} = process.cpuUsage(); console.log(user + system);`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env: { ...process.env, MAKEFUN_INPUT_DIR: input, MAKEFUN_OUTPUT_DIR: output },
    });
    assert.equal(child.status, 0, child.stderr);
    return { cpu: Number(child.stdout), answer: readFileSync(answerPath) };
  }
  const expected = JSON.parse(readFileSync(join(kit, 'practice/reference/expected.json'), 'utf8'));
  const practice = readFileSync(join(kit, 'practice/input/cases.json'));
  const means = values => values.reduce((a, b) => a + b, 0) / values.length;
  const trimmed = values => means(values.toSorted((a, b) => a - b).slice(2, -2));
  const summary = [];

  for (let set = 0; set <= draws; set++) {
    const name = set === 0 ? 'Practice' : `Draw ${set}`;
    const seed = createHash('sha256').update(`csv-reader-local-v1:${set}`).digest('hex');
    const cases = set === 0 ? practice : JSON.stringify(Array.from({ length: 6 }, (_, i) => ({
      id: `g-${i + 1}`, input: generate(streamFor(seed, 'case', i), i),
    })));
    writeFileSync(casesPath, cases);
    const oracle = execute(baseline).answer;
    if (set === 0) assert.ok(oracle.equals(Buffer.from(JSON.stringify(expected.cases.map(c => c.output)))));
    assert.ok(execute(root).answer.equals(oracle), `Warm-up mismatch on ${name}`);
    const samples = [[], []];
    for (let round = 0; round < rounds; round++) {
      for (const i of [round % 2, 1 - round % 2]) {
        const result = execute(i === 0 ? baseline : root);
        assert.ok(result.answer.equals(oracle), `Output mismatch on ${name}, round ${round}, program ${i}`);
        samples[i].push(result.cpu);
      }
    }
    const [house, entry] = samples.map(values => trimmed(values) / 1000);
    summary.push({ house, entry });
    console.log(`${name}: ${house.toFixed(1)} ms house, ${entry.toFixed(1)} ms entry, ${(house / entry).toFixed(2)}x`);
  }
  const [house, entry] = ['house', 'entry'].map(key => means(summary.map(row => row[key])));
  console.log(`Mean across sets: ${house.toFixed(1)} ms house, ${entry.toFixed(1)} ms entry, ${(house / entry).toFixed(2)}x`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
