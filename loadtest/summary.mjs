// One markdown row per scenario from the Artillery reports and the health samples.
// Usage: node loadtest/summary.mjs [reports dir]
import { existsSync, readFileSync } from 'node:fs';

const dir = process.argv[2] ?? 'loadtest/reports';
const SCENARIOS = ['vote', 'playlist', 'delegation', 'mixed'];
const max = (values) => (values.length ? Math.max(...values) : '-');
const round = (n) => (typeof n === 'number' ? Math.round(n) : '-');

function healthOf(name) {
	const path = `${dir}/${name}.health.jsonl`;
	if (!existsSync(path)) return { loop: '-', rss: '-', db: '-', missed: '-' };
	const samples = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
	const ok = samples.filter((s) => !s.missed);
	return {
		loop: max(ok.map((s) => s.eventLoopDelayMs.p99)),
		rss: max(ok.map((s) => s.rssMb)),
		db: max(ok.map((s) => s.dbConnections ?? 0)),
		missed: samples.length - ok.length,
	};
}

const rows = [
	'| Scenario | Requests / s | p50 | p95 | p99 | Failed users | Event loop p99 (max, ms) | RSS (max, MB) | DB connections (max) | Health samples missed |',
	'|---|---|---|---|---|---|---|---|---|---|',
];
for (const name of SCENARIOS) {
	const path = `${dir}/${name}.json`;
	if (!existsSync(path)) continue;
	const { counters, rates, summaries } = JSON.parse(readFileSync(path, 'utf8')).aggregate;
	const times = summaries['http.response_time'] ?? summaries['socketio.response_time'] ?? {};
	const created = counters['vusers.created'] ?? 0;
	const failed = counters['vusers.failed'] ?? 0;
	const failedPct = created ? `${((failed / created) * 100).toFixed(1)} %` : '-';
	const h = healthOf(name);
	rows.push(
		`| ${name} | ${round(rates['http.request_rate'])} | ${round(times.p50)} | ${round(times.p95)} | ${round(times.p99)} | ${failedPct} | ${h.loop} | ${h.rss} | ${h.db} | ${h.missed} |`,
	);
}
process.stdout.write(`${rows.join('\n')}\n`);
