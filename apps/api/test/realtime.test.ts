import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
	buildTestApp,
	closeTestApp,
	connectSocket,
	createUser,
	emitAck,
	listen,
	nextEvent,
	type ClientSocket,
	type TestApp,
	type TestUser,
} from './helpers.js';

let t: TestApp;
let url: string;
let user: TestUser;
let other: TestUser;
const allowed = randomUUID();
const sockets: ClientSocket[] = [];

const open = async (u: TestUser | null, extra?: object) => {
	const s = await connectSocket(url, u, extra);
	sockets.push(s);
	return s;
};

beforeAll(async () => {
	t = await buildTestApp();
	// Test room kind: only `allowed` may be joined.
	t.app.realtime.registerRoom('event', async (_userId, id) => id === allowed);
	url = await listen(t);
	user = await createUser(t, 'Socket');
	other = await createUser(t, 'Other', 'Pixel 8');
});

afterAll(async () => {
	sockets.forEach((s) => s.close());
	await closeTestApp(t);
});

describe('handshake', () => {
	it('accepts a valid access token', async () => {
		const s = await open(user);
		expect(s.connected).toBe(true);
	});

	it('refuses a missing or forged token', async () => {
		await expect(open(null)).rejects.toThrow('UNAUTHORIZED');
	});

	it('puts the socket in its user and device rooms', async () => {
		const s = await open(user);
		const got = nextEvent(s, 'ping:test');
		t.app.realtime.emitTo(`device:${await deviceOf(user)}`, 'ping:test', 1);
		expect(await got).toBe(1);
	});
});

const deviceOf = async (u: TestUser) =>
	(await t.prisma.device.findFirstOrThrow({ where: { userId: u.id } })).id;

describe('rooms', () => {
	it('joins an authorised room and receives its broadcasts', async () => {
		const [a, b] = [await open(user), await open(other)];
		expect(await emitAck(a, 'room:join', { kind: 'event', id: allowed })).toEqual({ ok: true });
		expect(await emitAck(b, 'room:join', { kind: 'event', id: allowed })).toEqual({ ok: true });
		const got = Promise.all([nextEvent(a, 'test:state'), nextEvent(b, 'test:state')]);
		t.app.realtime.emitTo(`event:${allowed}`, 'test:state', { version: 1 });
		expect(await got).toEqual([{ version: 1 }, { version: 1 }]);
	});

	it('sends the room size on join and leave', async () => {
		const a = await open(user);
		await emitAck(a, 'room:join', { kind: 'event', id: allowed });
		const b = await open(other);
		const presence = nextEvent<{ count: number }>(a, 'room:presence');
		await emitAck(b, 'room:join', { kind: 'event', id: allowed });
		const { count } = await presence;
		expect(count).toBe(t.app.realtime.roomSize(`event:${allowed}`));
		const after = nextEvent<{ count: number }>(a, 'room:presence');
		await emitAck(b, 'room:leave', { kind: 'event', id: allowed });
		expect((await after).count).toBe(count - 1);
	});

	it('refuses a room the module does not allow', async () => {
		const s = await open(user);
		const res = await emitAck(s, 'room:join', { kind: 'event', id: randomUUID() });
		expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
	});

	it('validates the payload', async () => {
		const s = await open(user);
		const err = nextEvent<{ code: string }>(s, 'error');
		const res = await emitAck(s, 'room:join', { kind: 'nope', id: 1 });
		expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
		expect((await err).code).toBe('VALIDATION_ERROR');
	});

	it('kick removes a user from a room', async () => {
		const s = await open(other);
		await emitAck(s, 'room:join', { kind: 'event', id: allowed });
		await t.app.realtime.kick(other.id, `event:${allowed}`);
		let received = false;
		s.once('test:kicked', () => (received = true));
		t.app.realtime.emitTo(`event:${allowed}`, 'test:kicked', {});
		await new Promise((r) => setTimeout(r, 200));
		expect(received).toBe(false);
	});
});

describe('abuse', () => {
	it('drops a socket that floods events', async () => {
		const s = await open(user);
		const closed = nextEvent(s, 'disconnect');
		for (let i = 0; i < 40; i++) s.emit('room:leave', { kind: 'event', id: allowed });
		await closed;
		expect(s.connected).toBe(false);
	});
});

describe('action log', () => {
	it('stores socket actions with the client info', async () => {
		const s = await open(other);
		await emitAck(s, 'room:join', { kind: 'event', id: randomUUID() });
		// Rows are stored in batches, a moment after the action.
		await vi.waitFor(async () => {
			const row = await t.prisma.actionLog.findFirst({
				where: { userId: other.id, action: 'SOCKET room:join' },
				orderBy: { createdAt: 'desc' },
			});
			expect(row).toMatchObject({ status: 403, platform: 'ios', device: 'iPhone 15' });
		});
	});
});
