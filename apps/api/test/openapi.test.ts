import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildTestApp, closeTestApp, type TestApp } from './helpers.js';

let t: TestApp;

beforeAll(async () => {
	t = await buildTestApp();
	await t.app.ready();
});

afterAll(() => closeTestApp(t));

type Content = { content?: Record<string, { schema?: { example?: unknown } }> };
type Operation = {
	summary?: string;
	description?: string;
	tags?: string[];
	requestBody?: Content;
	responses: Record<string, Content>;
};
const operations = () =>
	Object.entries(
		(t.app.swagger() as unknown as { paths: Record<string, Record<string, Operation>> }).paths,
	)
		.filter(([path]) => path.startsWith('/api/'))
		.flatMap(([path, methods]) =>
			Object.entries(methods).map(([method, op]) => ({ key: `${method} ${path}`, op })),
		);

it('describes every route: summary, description, tags and its error answers', () => {
	for (const { key, op } of operations()) {
		expect(op.summary, key).toBeTruthy();
		expect(op.description, key).toBeTruthy();
		expect(op.tags?.length, key).toBeGreaterThan(0);
		expect(Object.keys(op.responses), key).toContain('429');
	}
});

it('gives an example of every request body and of every successful answer', () => {
	const example = (c: Content) => Object.values(c.content ?? {})[0]?.schema?.example;
	for (const { key, op } of operations()) {
		if (op.requestBody) expect(example(op.requestBody), `${key} body`).toBeDefined();
		for (const [status, response] of Object.entries(op.responses)) {
			// 204 answers have no body.
			if (!status.startsWith('2') || status === '204' || !response.content) continue;
			expect(example(response), `${key} ${status}`).toBeDefined();
		}
	}
});

it('docs/openapi.json is the current contract (run `make docs` after changing a route)', async () => {
	const file = new URL('../../../docs/openapi.json', import.meta.url);
	const stored: unknown = JSON.parse(await readFile(file, 'utf8'));
	expect(stored).toEqual(JSON.parse(JSON.stringify(t.app.swagger())));
});
