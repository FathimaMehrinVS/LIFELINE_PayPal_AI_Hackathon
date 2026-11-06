// Owner: Member 1. Runs every fixture against the real LLM and prints a score table.
// Not part of `npm test` (it uses the network and Groq credits). Run it by hand after changing the prompt:
//
//   npx tsx --env-file=.env tests/situation/evaluate.ts
//
// Then copy the summary into apps/api/src/modules/situation/README.md.

import { llm } from "../../apps/api/src/ai/llm-client";
import { analyzeSituation } from "../../apps/api/src/modules/situation/situation.service";
import { SITUATION_FIXTURES } from "./fixtures";
import { type FixtureScore, scoreResult } from "./score";

/** Pause between calls so the free Groq plan's tokens-per-minute limit isn't hit. */
const DELAY_MS = 8_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runOnce(fixture: (typeof SITUATION_FIXTURES)[number]) {
  try {
    return await analyzeSituation(fixture.input, llm);
  } catch {
    // Most likely a rate limit: wait for the minute to pass and try once more.
    await sleep(30_000);
    return analyzeSituation(fixture.input, llm);
  }
}

const scores: FixtureScore[] = [];
for (const [index, fixture] of SITUATION_FIXTURES.entries()) {
  if (index > 0) await sleep(DELAY_MS);
  const started = Date.now();
  const score = scoreResult(fixture, await runOnce(fixture));
  scores.push(score);
  const mark = score.failures.length === 0 ? "PASS" : "FAIL";
  console.log(`${mark} ${fixture.id.padEnd(24)} ${score.passed}/${score.total}  ${Date.now() - started} ms`);
  for (const failure of score.failures) console.log(`       ${failure}`);
}

const passed = scores.reduce((n, s) => n + s.passed, 0);
const total = scores.reduce((n, s) => n + s.total, 0);
const fullyCorrect = scores.filter((s) => s.failures.length === 0).length;
const hallucinated = scores.reduce((n, s) => n + s.hallucinated.length, 0);
const unknownChecks = SITUATION_FIXTURES.reduce((n, f) => n + 6 - Object.keys(f.expect.access).length, 0);

console.log(`\nModel: ${process.env.GROQ_MODEL ?? "(not set)"}`);
console.log(`Fixtures fully correct: ${fullyCorrect}/${scores.length}`);
console.log(`Field checks passed:    ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`);
console.log(`Hallucinated access:    ${hallucinated}/${unknownChecks} unmentioned factors set to a value`);
