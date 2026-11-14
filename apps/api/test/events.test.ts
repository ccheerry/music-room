import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildTestApp,
	call,
	closeTestApp,
	createUsers,
	type TestApp,
	type TestUser,
} from './helpers.js';

let t: TestApp;
let owner: TestUser;
let invited: TestUser;
let stranger: TestUser;

beforeAll(async () => {
	t = await buildTestApp();
	[owner, invited, stranger] = (await createUsers(t, 3)) as [TestUser, TestUser, TestUser];
});

afterAll(() => closeTestApp(t));

const MADRID = { lat: 40.4168, lng: -3.7038 };
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const zone = (startH = -1, endH = 2) => ({
	...MADRID,
	radiusM: 500,
	startsAt: hoursFromNow(startH),
	endsAt: hoursFromNow(endH),
});

async function createEvent(body: object) {
	const res = await call(t, 'POST', '/events', owner, { name: 'Party', ...body });
	expect(res.statusCode).toBe(201);
	const id: string = res.json().id;
	await call(t, 'POST', `/events/${id}/invites`, owner, { userId: invited.id });
	return id;
}

const suggest = (user: TestUser, id: string, extra: object = {}) =>
	call(t, 'POST', `/events/${id}/tracks`, user, {
		deezerId: 100 + Math.floor(Math.random() * 1e6),
		...extra,
	});

describe('visibility × license × role', () => {
	const cases = [
		// visibility, license, role, can view, can vote
		['PUBLIC', 'EVERYONE', 'stranger', 200, 200],
		['PUBLIC', 'INVITED', 'stranger', 200, 403],
		['PUBLIC', 'INVITED', 'invited', 200, 200],
		['PRIVATE', 'EVERYONE', 'stranger', 404, 404],
		['PRIVATE', 'EVERYONE', 'invited', 200, 200],
		['PRIVATE', 'INVITED', 'invited', 200, 200],
		['PRIVATE', 'INVITED', 'owner', 200, 200],
	] as const;

	it.each(cases)(
		'%s / %s as %s: view %i, vote %i',
		async (visibility, voteLicense, role, view, vote) => {
			const id = await createEvent({ visibility, voteLicense });
			const user = { owner, invited, stranger }[role];
			expect((await call(t, 'GET', `/events/${id}`, user)).statusCode).toBe(view);
			expect((await call(t, 'GET', `/events/${id}/state`, user)).statusCode).toBe(view);
			expect((await suggest(user, id)).statusCode).toBe(vote);
		},
	);

	it('reports canVote per user', async () => {
		const id = await createEvent({ voteLicense: 'INVITED' });
		expect((await call(t, 'GET', `/events/${id}`, stranger)).json().canVote).toBe(false);
		expect((await call(t, 'GET', `/events/${id}`, invited)).json()).toMatchObject({
			canVote: true,
			invited: true,
		});
	});
});

describe('LOCATION license', () => {
	it('accepts a vote inside the zone during the window', async () => {
		const id = await createEvent({ voteLicense: 'LOCATION', zone: zone() });
		const near = { lat: 40.417, lng: -3.704 };
		expect((await suggest(stranger, id, { coords: near })).statusCode).toBe(200);
	});

	it('asks for coordinates, refuses outside the radius and outside the window', async () => {
		const id = await createEvent({ voteLicense: 'LOCATION', zone: zone() });
		expect((await suggest(stranger, id)).json().error.code).toBe('LOCATION_REQUIRED');
		const far = { lat: 40.43, lng: -3.7038 }; // about 1.5 km north
		expect((await suggest(stranger, id, { coords: far })).json().error.code).toBe(
			'OUTSIDE_ZONE',
		);

		const closed = await createEvent({ voteLicense: 'LOCATION', zone: zone(1, 2) });
		const res = await suggest(stranger, closed, { coords: MADRID });
		expect(res.json().error.code).toBe('OUTSIDE_WINDOW');
	});

	it('treats the radius edge as inside', async () => {
		const id = await createEvent({
			voteLicense: 'LOCATION',
			zone: { ...zone(), radiusM: 100 },
		});
		// 0.0008° of latitude ≈ 89 m.
		const edge = { lat: MADRID.lat + 0.0008, lng: MADRID.lng };
		expect((await suggest(stranger, id, { coords: edge })).statusCode).toBe(200);
	});

	it('lets the owner vote from anywhere', async () => {
		const id = await createEvent({ voteLicense: 'LOCATION', zone: zone(1, 2) });
		expect((await suggest(owner, id)).statusCode).toBe(200);
	});

	it('refuses a LOCATION license without a zone', async () => {
		const res = await call(t, 'POST', '/events', owner, { name: 'x', voteLicense: 'LOCATION' });
		expect(res.statusCode).toBe(400);
		const id = await createEvent({});
		const patch = await call(t, 'PATCH', `/events/${id}`, owner, { voteLicense: 'LOCATION' });
		expect(patch.statusCode).toBe(400);
	});
});

describe('management', () => {
	it('only the owner edits, invites and deletes', async () => {
		const id = await createEvent({});
		expect((await call(t, 'PATCH', `/events/${id}`, invited, { name: 'x' })).statusCode).toBe(
			403,
		);
		expect(
			(await call(t, 'POST', `/events/${id}/invites`, invited, { userId: stranger.id }))
				.statusCode,
		).toBe(403);
		expect((await call(t, 'DELETE', `/events/${id}`, stranger)).statusCode).toBe(403);
		expect(
			(await call(t, 'PATCH', `/events/${id}`, owner, { name: 'Renamed' })).json().name,
		).toBe('Renamed');
		expect((await call(t, 'GET', `/events/${id}/invites`, owner)).json()).toEqual([
			{ id: invited.id, displayName: 'Voter 1' },
		]);
		expect((await call(t, 'DELETE', `/events/${id}`, owner)).statusCode).toBe(204);
		expect((await call(t, 'GET', `/events/${id}`, owner)).statusCode).toBe(404);
	});

	it('withdrawing an invitation hides a private event', async () => {
		const id = await createEvent({ visibility: 'PRIVATE' });
		await call(t, 'DELETE', `/events/${id}/invites/${invited.id}`, owner);
		expect((await call(t, 'GET', `/events/${id}`, invited)).statusCode).toBe(404);
	});
});

describe('GET /events', () => {
	it('lists by scope and never leaks private events', async () => {
		const name = `Scope ${crypto.randomUUID().slice(0, 6)}`;
		const pub = await createEvent({ name });
		const priv = await createEvent({ name, visibility: 'PRIVATE' });
		const ids = async (user: TestUser, scope: string) =>
			(await call(t, 'GET', `/events?scope=${scope}&q=${encodeURIComponent(name)}`, user))
				.json()
				.items.map((e: { id: string }) => e.id);

		expect(await ids(stranger, 'all')).toEqual([pub]);
		expect((await ids(invited, 'all')).sort()).toEqual([pub, priv].sort());
		expect(await ids(invited, 'invited')).toHaveLength(2);
		expect(await ids(owner, 'discover')).toEqual([]);
		expect(await ids(owner, 'mine')).toHaveLength(2);
	});
});
