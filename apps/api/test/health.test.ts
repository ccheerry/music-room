import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../src/config/env.js';
import { buildTestApp, closeTestApp, type TestApp } from './helpers.js';

describe('GET /api/v1/health', () => {
	let t: TestApp;
	let app: FastifyInstance;

	beforeAll(async () => {
		t = await buildTestApp();
		app = t.app;
	});

	afterAll(() => closeTestApp(t));

	it('reports ok when the database answers', async () => {
		const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ status: 'ok', db: 'ok' });
	});

	it('answers unknown routes with the error envelope', async () => {
		const res = await app.inject({ method: 'GET', url: '/nope' });
		expect(res.statusCode).toBe(404);
		expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } });
	});
});

describe('loadEnv', () => {
	it('throws when DATABASE_URL is missing', () => {
		expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
	});

	it('throws when JWT_SECRET is missing or too short', () => {
		const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };
		expect(() => loadEnv(base)).toThrow(/JWT_SECRET/);
		expect(() => loadEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
	});

	it('accepts a scheme or Expo Go link base, nothing else', () => {
		const base = {
			DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
			JWT_SECRET: 'x'.repeat(32),
		};
		expect(loadEnv(base).APP_LINK_URL).toBe('musicroom://');
		expect(loadEnv({ ...base, APP_LINK_URL: 'exp://10.0.0.5:8081/--/' }).APP_LINK_URL).toBe(
			'exp://10.0.0.5:8081/--/',
		);
		expect(() => loadEnv({ ...base, APP_LINK_URL: 'exp://10.0.0.5:8081/--' })).toThrow(
			/APP_LINK_URL/,
		);
	});
});
