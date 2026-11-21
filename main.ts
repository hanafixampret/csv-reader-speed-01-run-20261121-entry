// The harness runs `node /bot/main.ts` (node22). It reads every case from
// /input/cases.json (a JSON array of {id, input}), answers each one alone with run()
// from solve.js, and writes /output/answers.json: a JSON array of the answers, one per
// case and in the cases' order. Outside a container MAKEFUN_INPUT_DIR and
// MAKEFUN_OUTPUT_DIR stand in for /input and /output.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all of its work runs
// under it (the rules: the house baseline runs with --no-incremental-marking, and an
// entry may tune V8's flags too).
setFlagsFromString('--no-incremental-marking');

/** solve.js, imported by its URL (a .js module carries no types) and typed by its contract. */
const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as { run: (input: unknown) => unknown };

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Warm the reader once on a small input that exercises both paths (plain records,
// a quoted field, a doubled quote with junk after it, a stray CR, a quoted line
// break and an unterminated quote), so the real cases run on compiled code: each
// timed execution is a fresh process, and the first case would otherwise pay the
// compile cost. The warm-up answers are discarded; no case's answer changes.
run({ text: 'a,b,"c,d",e\r\n"x""y"junk,f\r\n"g\nh",i\n"unterminated', header: true });
run({ text: 'a,b,"c,d",e\r\n"x""y"junk,f\r\n"g\nh",i\n"unterminated', header: true });
run({ text: 'a,b,"c,d",e\r\n"x""y"junk,f\r\n"g\nh",i\n"unterminated', header: true });

const cases = JSON.parse(readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8')) as { id: string; input: unknown }[];
const answers: unknown[] = [];
for (const c of cases) answers.push(run(c.input));
writeFileSync(join(OUTPUT_DIR, 'answers.json'), JSON.stringify(answers));
