// LOCAL parse/serialization breakdown and V8 line samples, without disk profiles.
import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { resolve } from 'node:path';
import { setFlagsFromString } from 'node:v8';
setFlagsFromString('--no-incremental-marking');
const { run } = await import('../solve.js');
const kit = resolve(process.argv[2]);
const cases = JSON.parse(readFileSync(kit + '/practice/input/cases.json', 'utf8'));
const cpu = () => { const c = process.cpuUsage(); return c.user + c.system; };
const session = new Session();
session.connect();
const post = (method, args = {}) => new Promise((resolve, reject) => session.post(method, args, (err, result) => err ? reject(err) : resolve(result)));
await post('Profiler.enable');
await post('Profiler.start');
for (let n = 0; n < 10; n++) {
  const start = cpu();
  const answers = cases.map(c => run(c.input));
  const parsed = cpu();
  JSON.stringify(answers);
  console.log({ iteration: n, parse_us: parsed - start, stringify_us: cpu() - parsed });
}
const { profile } = await post('Profiler.stop');
const lines = [];
for (const node of profile.nodes) {
  if (node.callFrame.url.endsWith('/solve.js')) {
    for (const tick of node.positionTicks ?? []) lines.push({ line: tick.line, ticks: tick.ticks });
  } else if (node.hitCount) lines.push({ function: node.callFrame.functionName, ticks: node.hitCount });
}
console.log(lines.sort((a, b) => b.ticks - a.ticks).slice(0, 25));
session.disconnect();

// Count fast/fallback records and field visits separately from the timed run.
let source = readFileSync(new URL('../solve.js', import.meta.url), 'utf8');
source = 'export const counts = { fast: 0, fallback: 0, fastFields: 0, fallbackFields: 0 };\n' + source
  .replace('rows.push(row);', 'counts.fast++; counts.fastFields += row.length; rows.push(row);')
  .replace('const recordLine = line;', 'counts.fallback++; const recordLine = line;')
  .replace('fields[count++] = value;', 'counts.fallbackFields++; fields[count++] = value;');
const instrumented = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
for (const c of cases) instrumented.run(c.input);
console.log(instrumented.counts);
