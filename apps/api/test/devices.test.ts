import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	buildTestApp,
	call,
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
let owner: TestUser;
let friend: TestUser;
let stranger: TestUser;
let deviceId: string;
let speaker: ClientSocket;
const sockets: ClientSocket[] = [];

const open = async (u: TestUser) => {
	const s = await connectSocket(url, u);
	sockets.push(s);
	return s;
};

async function befriend(a: TestUser, b: TestUser) {
	await call(t, 'POST', '/friends/requests', a, { userId: b.id });
	await call(t, 'POST', `/friends/requests/${a.id}/accept`, b);
}

const grant = (to: TestUser, body: object = {}) =>
	call(t, 'PUT', `/devices/${deviceId}/grants/${to.id}`, owner, body);
const command = (s: ClientSocket, extra: object = {}) =>
	emitAck(s, 'device:command', { deviceId, action: 'pause', trackId: 1, ...extra });
const STATUS = () => ({
	deviceId,
	playing: true,
	track: null,
	positionMs: 1200,
	volume: 0.8,
});

beforeAll(async () => {
	t = await buildTestApp();
	url = await listen(t);
	owner = await createUser(t, 'Owner', 'Living room speaker');
	friend = await createUser(t, 'Friend', 'Pixel 8');
	stranger = await createUser(t, 'Stranger', 'Pixel 7');
	deviceId = (await t.prisma.device.findFirstOrThrow({ where: { userId: owner.id } })).id;
	await befriend(owner, friend);
	// The owner's phone, logged in on that device, plays the music.
	speaker = await open(owner);
});

afterAll(async () => {
	sockets.forEach((s) => s.close());
	await closeTestApp(t);
});

beforeEach(async () => {
	await t.prisma.controlGrant.deleteMany({ where: { deviceId } });
});

describe('devices', () => {
	it('lists my devices, marks this one and shows it online', async () => {
		const res = await call(t, 'GET', '/devices', owner);
		expect(res.json()).toEqual([
			expect.objectContaining({
				id: deviceId,
				name: 'Living room speaker',
				current: true,
				online: true,
			}),
		]);
	});

	it('renames only my own devices', async () => {
		expect(
			(await call(t, 'PATCH', `/devices/${deviceId}`, owner, { name: 'Kitchen' })).statusCode,
		).toBe(204);
		expect(
			(await call(t, 'PATCH', `/devices/${deviceId}`, friend, { name: 'Mine' })).statusCode,
		).toBe(404);
		expect((await call(t, 'GET', '/devices', owner)).json()[0].name).toBe('Kitchen');
	});

	it('removing a device logs it out', async () => {
		const other = await createUser(t, 'Two devices', 'Old tablet');
		const old = (await t.prisma.device.findFirstOrThrow({ where: { userId: other.id } })).id;
		expect((await call(t, 'DELETE', `/devices/${old}`, other)).statusCode).toBe(204);
		const refresh = await call(t, 'POST', '/auth/refresh', null, {
			refreshToken: other.tokens.refreshToken,
		});
		expect(refresh.statusCode).toBe(401);
	});
});

describe('grants', () => {
	it('only friends can be granted, only by the owner', async () => {
		expect((await grant(stranger)).statusCode).toBe(403);
		expect((await grant(friend)).statusCode).toBe(204);
		const asFriend = await call(
			t,
			'PUT',
			`/devices/${deviceId}/grants/${stranger.id}`,
			friend,
			{},
		);
		expect(asFriend.statusCode).toBe(404);
	});

	it('a granted friend sees the device as controllable, with its owner and state', async () => {
		await grant(friend);
		const list = (await call(t, 'GET', '/devices/controllable', friend)).json();
		expect(list).toContainEqual(
			expect.objectContaining({
				id: deviceId,
				owner: { id: owner.id, displayName: 'Owner' },
				online: true,
			}),
		);
		expect((await call(t, 'GET', '/devices', owner)).json()[0].grants).toEqual([
			{ user: { id: friend.id, displayName: 'Friend' }, expiresAt: null },
		]);
	});

	it('an expired grant gives nothing', async () => {
		await grant(friend, { expiresAt: new Date(Date.now() - 1000).toISOString() });
		const list = (await call(t, 'GET', '/devices/controllable', friend)).json();
		expect(list.map((d: { id: string }) => d.id)).not.toContain(deviceId);
		const s = await open(friend);
		expect(await command(s)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
	});
});

describe('command relay', () => {
	it('relays a granted friend command to the device, quickly', async () => {
		await grant(friend);
		const remote = await open(friend);
		const got = nextEvent<{ action: string; from: string; trackId: number }>(
			speaker,
			'device:command',
		);
		const sent = Date.now();
		expect(await command(remote, { action: 'next', trackId: 42 })).toEqual({ ok: true });
		const relayed = await got;
		expect(relayed).toMatchObject({ action: 'next', trackId: 42, from: friend.id });
		expect(Date.now() - sent).toBeLessThan(200);
	});

	it('refuses commands from a stranger and invalid payloads', async () => {
		const s = await open(stranger);
		expect(await command(s)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
		const owned = await open(owner);
		expect(await command(owned, { action: 'volume' })).toMatchObject({
			ok: false,
			error: { code: 'VALIDATION_ERROR' },
		});
	});

	it('relays the device status to its controllers only', async () => {
		await grant(friend);
		const remote = await open(friend);
		expect(await emitAck(remote, 'room:join', { kind: 'remote', id: deviceId })).toEqual({
			ok: true,
		});
		const outsider = await open(stranger);
		expect(
			await emitAck(outsider, 'room:join', { kind: 'remote', id: deviceId }),
		).toMatchObject({ ok: false });

		const got = nextEvent(remote, 'device:status');
		expect(await emitAck(speaker, 'device:status', STATUS())).toEqual({ ok: true });
		expect(await got).toEqual(STATUS());
	});

	it('a device cannot report for another one', async () => {
		await grant(friend);
		const remote = await open(friend);
		expect(await emitAck(remote, 'device:status', STATUS())).toMatchObject({ ok: false });
	});
});

describe('revocation', () => {
	it('taking control back works at once during a session', async () => {
		await grant(friend);
		const remote = await open(friend);
		await emitAck(remote, 'room:join', { kind: 'remote', id: deviceId });
		expect(await command(remote)).toEqual({ ok: true });

		const notified = nextEvent(remote, 'device:revoked');
		expect(
			(await call(t, 'DELETE', `/devices/${deviceId}/grants/${friend.id}`, owner)).statusCode,
		).toBe(204);
		expect(await notified).toEqual({ deviceId });
		expect(await command(remote)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

		let received = false;
		remote.once('device:status', () => (received = true));
		await emitAck(speaker, 'device:status', STATUS());
		await new Promise((r) => setTimeout(r, 150));
		expect(received).toBe(false);
	});

	it('ending the friendship revokes control', async () => {
		const pal = await createUser(t, 'Pal');
		await befriend(owner, pal);
		await grant(pal);
		const remote = await open(pal);
		expect(await command(remote)).toEqual({ ok: true });
		await call(t, 'DELETE', `/friends/${pal.id}`, owner);
		expect(await command(remote)).toMatchObject({ ok: false });
		expect(await t.prisma.controlGrant.count({ where: { granteeId: pal.id } })).toBe(0);
	});
});
