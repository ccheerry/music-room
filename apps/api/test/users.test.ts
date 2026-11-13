import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildTestApp,
	call,
	closeTestApp,
	createUser,
	type TestApp,
	type TestUser,
} from './helpers.js';

let t: TestApp;
let owner: TestUser;
let friend: TestUser;
let pending: TestUser;
let stranger: TestUser;

const tiers = {
	publicInfo: { city: 'PUBLIC_CITY' },
	friendsInfo: { bio: 'FRIENDS_BIO' },
	privateInfo: { phone: 'PRIVATE_PHONE' },
	musicPrefs: ['jazz'],
};

beforeAll(async () => {
	t = await buildTestApp();
	owner = await createUser(t, 'Owner');
	friend = await createUser(t, 'Friend');
	pending = await createUser(t, 'Pending');
	stranger = await createUser(t, 'Stranger');
	await call(t, 'PATCH', '/me', owner, tiers);
	await call(t, 'POST', '/friends/requests', friend, { userId: owner.id });
	await call(t, 'POST', `/friends/requests/${friend.id}/accept`, owner);
	await call(t, 'POST', '/friends/requests', pending, { userId: owner.id });
});

afterAll(() => closeTestApp(t));

const view = (viewer: TestUser) => call(t, 'GET', `/users/${owner.id}`, viewer);

describe('profile visibility', () => {
	it.each([
		['stranger', () => stranger, 'none'],
		['pending requester', () => pending, 'requested'],
	])('a %s sees only public fields', async (_label, viewer, relation) => {
		const res = await view(viewer());
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			relation,
			publicInfo: tiers.publicInfo,
			musicPrefs: ['jazz'],
		});
		expect(res.body).not.toContain('FRIENDS_BIO');
		expect(res.body).not.toContain('PRIVATE_PHONE');
		expect(res.body).not.toContain(owner.email);
	});

	it('a friend also sees friends-only fields, never private ones', async () => {
		const res = await view(friend);
		expect(res.json()).toMatchObject({ relation: 'friend', friendsInfo: tiers.friendsInfo });
		expect(res.body).not.toContain('PRIVATE_PHONE');
		expect(res.body).not.toContain(owner.email);
	});

	it('the owner sees everything', async () => {
		const res = await view(owner);
		expect(res.json()).toMatchObject({ relation: 'self', ...tiers, email: owner.email });
	});

	it('the owner sees an incoming request as such', async () => {
		const res = await call(t, 'GET', `/users/${pending.id}`, owner);
		expect(res.json().relation).toBe('incoming');
	});

	it('answers 404 for an unknown user and 401 without a token', async () => {
		expect((await call(t, 'GET', `/users/${crypto.randomUUID()}`, owner)).statusCode).toBe(404);
		expect((await call(t, 'GET', `/users/${owner.id}`)).statusCode).toBe(401);
	});
});

describe('PATCH /me', () => {
	it('replaces a tier, drops empty values and keeps the others', async () => {
		const user = await createUser(t);
		await call(t, 'PATCH', '/me', user, tiers);
		const res = await call(t, 'PATCH', '/me', user, {
			displayName: 'Renamed',
			publicInfo: { city: '', bio: 'hello' },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			displayName: 'Renamed',
			publicInfo: { bio: 'hello' },
			friendsInfo: tiers.friendsInfo,
		});
		expect(res.json().publicInfo).not.toHaveProperty('city');
	});

	it('rejects unknown fields', async () => {
		const res = await call(t, 'PATCH', '/me', owner, { publicInfo: { ssn: '1' } });
		expect(res.statusCode).toBe(400);
	});
});

describe('GET /users?q=', () => {
	it('finds by case-insensitive prefix, public fields only', async () => {
		const name = `Zed${crypto.randomUUID().slice(0, 8)}`;
		const user = await createUser(t, name);
		await call(t, 'PATCH', '/me', user, tiers);
		const res = await call(t, 'GET', `/users?q=${name.toLowerCase()}`, owner);
		expect(res.json()).toEqual({ items: [{ id: user.id, displayName: name }], hasMore: false });
	});

	it('paginates', async () => {
		const prefix = `Pg${crypto.randomUUID().slice(0, 8)}`;
		await Promise.all([1, 2, 3].map((i) => createUser(t, `${prefix}${i}`)));
		const first = await call(t, 'GET', `/users?q=${prefix}&limit=2`, owner);
		expect(first.json().items).toHaveLength(2);
		expect(first.json().hasMore).toBe(true);
		const rest = await call(t, 'GET', `/users?q=${prefix}&limit=2&offset=2`, owner);
		expect(rest.json()).toMatchObject({ hasMore: false });
		expect(rest.json().items).toHaveLength(1);
	});
});
