import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDeezerClient } from '../src/modules/catalog/deezer.js';
import { createLru } from '../src/lib/lru.js';
import { deezerTrack, fakeDeezerFetch } from './fixtures/deezer.js';
import {
	buildTestApp,
	call,
	closeTestApp,
	createUser,
	type TestApp,
	type TestUser,
} from './helpers.js';

let t: TestApp;
let user: TestUser;

beforeAll(async () => {
	t = await buildTestApp();
	user = await createUser(t);
});

afterAll(() => closeTestApp(t));

describe('GET /tracks/search', () => {
	it('returns normalised tracks', async () => {
		const res = await call(t, 'GET', '/tracks/search?q=daft%20punk', user);
		expect(res.statusCode).toBe(200);
		expect(res.json().items[0]).toEqual({
			id: 1,
			title: 'daft punk one',
			artist: 'Daft Punk',
			album: 'Discovery',
			coverUrl: 'https://cdn.deezer.test/cover/1.jpg',
			previewUrl: 'https://cdn.deezer.test/preview/1.mp3',
			durationSec: 215,
		});
	});

	it('needs a query and a token', async () => {
		expect((await call(t, 'GET', '/tracks/search?q=', user)).statusCode).toBe(400);
		expect((await call(t, 'GET', '/tracks/search?q=x')).statusCode).toBe(401);
	});
});

describe('GET /tracks/:deezerId', () => {
	it('stores a snapshot of the track', async () => {
		const id = 3000000 + Math.floor(Math.random() * 100000);
		const res = await call(t, 'GET', `/tracks/${id}`, user);
		expect(res.statusCode).toBe(200);
		expect(await t.prisma.track.findUnique({ where: { deezerId: id } })).toMatchObject({
			title: `Track ${id}`,
		});
	});

	it('answers 404 for a track Deezer does not know', async () => {
		const res = await call(t, 'GET', '/tracks/900000001', user);
		expect(res.statusCode).toBe(404);
		expect(res.json().error.code).toBe('TRACK_NOT_FOUND');
	});
});

describe('upstream errors', () => {
	it('reach the client with their own status and code, not as a 500', async () => {
		const down = await buildTestApp({
			deezerFetch: (async () => new Response('x', { status: 500 })) as typeof fetch,
		});
		const u = await createUser(down);
		const res = await call(down, 'GET', '/tracks/search?q=x', u);
		expect(res.statusCode).toBe(502);
		expect(res.json().error.code).toBe('CATALOG_UNAVAILABLE');
		await closeTestApp(down);
	});
});

describe('GET /genres', () => {
	it('drops the "All" pseudo-genre', async () => {
		const res = await call(t, 'GET', '/genres', user);
		expect(res.json()).toEqual([{ id: 132, name: 'Pop' }]);
	});
});

describe('Deezer client', () => {
	it('validates responses and maps a missing preview to null', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ ...deezerTrack(5), preview: '' })));
		const deezer = createDeezerClient({ fetch });
		expect((await deezer.track(5)).previewUrl).toBeNull();
	});

	it('accepts null covers and previews, as Deezer sends them', async () => {
		const body = {
			...deezerTrack(6),
			preview: null,
			album: { title: 'A', cover_medium: null },
		};
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
		expect(await createDeezerClient({ fetch }).track(6)).toMatchObject({
			coverUrl: null,
			previewUrl: null,
		});
	});

	it('answers 502 when Deezer sends something unexpected', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ nope: true })));
		await expect(createDeezerClient({ fetch }).track(5)).rejects.toMatchObject({
			statusCode: 502,
		});
		const down = vi.fn().mockRejectedValue(new Error('timeout'));
		await expect(createDeezerClient({ fetch: down }).search('x', 5)).rejects.toMatchObject({
			statusCode: 502,
		});
	});

	it('stops at the quota with 503 CATALOG_BUSY', async () => {
		const deezer = createDeezerClient({
			fetch: fakeDeezerFetch,
			quota: { max: 3, windowMs: 60000 },
		});
		for (let i = 0; i < 3; i++) await deezer.search(`q${i}`, 5);
		await expect(deezer.search('one more', 5)).rejects.toMatchObject({
			statusCode: 503,
			code: 'CATALOG_BUSY',
		});
	});
});

describe('search cache', () => {
	it('serves a repeated search without calling Deezer again', async () => {
		const fetch = vi.fn(fakeDeezerFetch);
		const { createCatalogService } = await import('../src/modules/catalog/service.js');
		const catalog = createCatalogService({
			prisma: t.prisma,
			deezer: createDeezerClient({ fetch }),
		});
		await catalog.search('Daft Punk', 10);
		await catalog.search('daft punk', 10);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('expires and evicts entries', () => {
		let now = 0;
		const lru = createLru<number>(2, 100, () => now);
		lru.set('a', 1);
		lru.set('b', 2);
		lru.get('a');
		lru.set('c', 3);
		expect(lru.get('b')).toBeUndefined();
		expect(lru.get('a')).toBe(1);
		now = 200;
		expect(lru.get('c')).toBeUndefined();
	});
});
