// Samples GET /health?verbose every 2 s during a run, one JSON line per sample.
// Usage: node loadtest/monitor.mjs <target> <output.jsonl>
import { appendFileSync, writeFileSync } from 'node:fs';

const INTERVAL_MS = 2000;
const [target, output] = process.argv.slice(2);
if (!target || !output) {
	process.stderr.write('usage: monitor.mjs <target> <output.jsonl>\n');
	process.exit(1);
}
writeFileSync(output, '');

async function sample() {
	try {
		const res = await fetch(`${target}/api/v1/health?verbose=true`, {
			signal: AbortSignal.timeout(INTERVAL_MS),
		});
		const { metrics } = await res.json();
		appendFileSync(output, `${JSON.stringify({ at: Date.now(), ...metrics })}\n`);
	} catch {
		// A saturated API may not answer in time: the gap shows in the samples.
		appendFileSync(output, `${JSON.stringify({ at: Date.now(), missed: true })}\n`);
	}
}

setInterval(sample, INTERVAL_MS);
process.on('SIGTERM', () => process.exit(0));
