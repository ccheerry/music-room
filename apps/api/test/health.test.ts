import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createPrisma, type PrismaClient } from '../src/db.js';

describe('GET /api/v1/health', () => {
	let app: FastifyInstance;
	let prisma: PrismaClient;

	beforeAll(async () => {
		const env = loadEnv({ ...process.env, LOG_LEVEL: 'silent' });
		prisma = createPrisma(env.DATABASE_URL);
		app = await buildApp(env, prisma);
	});

	afterAll(async () => {
		await app.close();
		await prisma.$disconnect();
	});

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
});
