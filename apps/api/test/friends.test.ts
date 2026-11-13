import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, call, closeTestApp, createUser, type TestApp } from './helpers.js';

let t: TestApp;

beforeAll(async () => {
	t = await buildTestApp();
});

afterAll(() => closeTestApp(t));

const two = () => Promise.all([createUser(t, 'Ana'), createUser(t, 'Bob')]);

describe('friend requests', () => {
	it('request → accept → both list each other', async () => {
		const [a, b] = await two();
		const sent = await call(t, 'POST', '/friends/requests', a, { userId: b.id });
		expect(sent.json()).toEqual({ status: 'requested' });
		expect((await call(t, 'GET', '/friends/requests', b)).json().incoming).toEqual([
			{ id: a.id, displayName: 'Ana' },
		]);
		expect((await call(t, 'GET', '/friends/requests', a)).json().outgoing).toHaveLength(1);

		expect((await call(t, 'POST', `/friends/requests/${a.id}/accept`, b)).statusCode).toBe(204);
		expect((await call(t, 'GET', '/friends', a)).json()).toEqual([
			{ id: b.id, displayName: 'Bob' },
		]);
		expect((await call(t, 'GET', '/friends', b)).json()).toEqual([
			{ id: a.id, displayName: 'Ana' },
		]);
	});

	it('never duplicates a pair, in either direction', async () => {
		const [a, b] = await two();
		await call(t, 'POST', '/friends/requests', a, { userId: b.id });
		const again = await call(t, 'POST', '/friends/requests', a, { userId: b.id });
		expect(again.json()).toEqual({ status: 'requested' });
		// The reverse request accepts the pending one.
		const reverse = await call(t, 'POST', '/friends/requests', b, { userId: a.id });
		expect(reverse.json()).toEqual({ status: 'friends' });
		expect(
			await t.prisma.friendship.count({
				where: { OR: [{ userAId: a.id }, { userBId: a.id }] },
			}),
		).toBe(1);
	});

	it('survives two crossed requests at the same time', async () => {
		const [a, b] = await two();
		await Promise.all([
			call(t, 'POST', '/friends/requests', a, { userId: b.id }),
			call(t, 'POST', '/friends/requests', b, { userId: a.id }),
		]);
		expect(
			await t.prisma.friendship.count({
				where: { OR: [{ userAId: a.id }, { userBId: a.id }] },
			}),
		).toBe(1);
	});

	it('only the addressee can accept', async () => {
		const [a, b] = await two();
		await call(t, 'POST', '/friends/requests', a, { userId: b.id });
		expect((await call(t, 'POST', `/friends/requests/${b.id}/accept`, a)).statusCode).toBe(404);
	});

	it('decline and cancel remove the request', async () => {
		const [a, b] = await two();
		await call(t, 'POST', '/friends/requests', a, { userId: b.id });
		expect((await call(t, 'DELETE', `/friends/requests/${a.id}`, b)).statusCode).toBe(204);
		await call(t, 'POST', '/friends/requests', a, { userId: b.id });
		expect((await call(t, 'DELETE', `/friends/requests/${b.id}`, a)).statusCode).toBe(204);
		expect((await call(t, 'GET', '/friends/requests', b)).json().incoming).toEqual([]);
	});

	it('refuses yourself and unknown users', async () => {
		const [a] = await two();
		expect((await call(t, 'POST', '/friends/requests', a, { userId: a.id })).statusCode).toBe(
			400,
		);
		const unknown = await call(t, 'POST', '/friends/requests', a, {
			userId: crypto.randomUUID(),
		});
		expect(unknown.statusCode).toBe(404);
	});
});

describe('removing a friend', () => {
	it('ends the friendship for both', async () => {
		const [a, b] = await two();
		await call(t, 'POST', '/friends/requests', a, { userId: b.id });
		await call(t, 'POST', `/friends/requests/${a.id}/accept`, b);
		expect((await call(t, 'DELETE', `/friends/${a.id}`, b)).statusCode).toBe(204);
		expect((await call(t, 'GET', '/friends', a)).json()).toEqual([]);
		expect((await call(t, 'DELETE', `/friends/${a.id}`, b)).statusCode).toBe(404);
	});
});
