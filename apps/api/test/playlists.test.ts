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
let member: TestUser;
let stranger: TestUser;

beforeAll(async () => {
	t = await buildTestApp();
	[owner, member, stranger] = (await createUsers(t, 3)) as [TestUser, TestUser, TestUser];
});

afterAll(() => closeTestApp(t));

async function createPlaylist(body: object = {}) {
	const res = await call(t, 'POST', '/playlists', owner, { name: 'Mix', ...body });
	expect(res.statusCode).toBe(201);
	const id: string = res.json().id;
	await call(t, 'POST', `/playlists/${id}/members`, owner, { userId: member.id });
	return id;
}

const add = (user: TestUser, id: string) =>
	call(t, 'POST', `/playlists/${id}/entries`, user, {
		deezerId: 1000 + Math.floor(Math.random() * 1e5),
	});

describe('visibility × license × role', () => {
	const cases = [
		['PUBLIC', 'EVERYONE', 'stranger', 200, 200],
		['PUBLIC', 'INVITED', 'stranger', 200, 403],
		['PUBLIC', 'INVITED', 'member', 200, 200],
		['PRIVATE', 'EVERYONE', 'stranger', 404, 404],
		['PRIVATE', 'EVERYONE', 'member', 200, 200],
		['PRIVATE', 'INVITED', 'member', 200, 200],
		['PRIVATE', 'INVITED', 'owner', 200, 200],
	] as const;

	it.each(cases)(
		'%s / %s as %s: view %i, edit %i',
		async (visibility, editLicense, role, view, edit) => {
			const id = await createPlaylist({ visibility, editLicense });
			const user = { owner, member, stranger }[role];
			expect((await call(t, 'GET', `/playlists/${id}`, user)).statusCode).toBe(view);
			expect((await call(t, 'GET', `/playlists/${id}/entries`, user)).statusCode).toBe(view);
			expect((await add(user, id)).statusCode).toBe(edit);
		},
	);

	it('reports canEdit', async () => {
		const id = await createPlaylist({ editLicense: 'INVITED' });
		expect((await call(t, 'GET', `/playlists/${id}`, stranger)).json().canEdit).toBe(false);
		expect((await call(t, 'GET', `/playlists/${id}`, member)).json()).toMatchObject({
			canEdit: true,
			member: true,
		});
	});
});

describe('management', () => {
	it('only the owner changes settings, members and deletes', async () => {
		const id = await createPlaylist();
		expect((await call(t, 'PATCH', `/playlists/${id}`, member, { name: 'x' })).statusCode).toBe(
			403,
		);
		expect(
			(await call(t, 'POST', `/playlists/${id}/members`, member, { userId: stranger.id }))
				.statusCode,
		).toBe(403);
		const patched = await call(t, 'PATCH', `/playlists/${id}`, owner, {
			editLicense: 'INVITED',
		});
		expect(patched.json().editLicense).toBe('INVITED');
		expect((await call(t, 'GET', `/playlists/${id}/members`, owner)).json()).toEqual([
			{ id: member.id, displayName: 'Voter 1' },
		]);
		expect((await call(t, 'DELETE', `/playlists/${id}`, member)).statusCode).toBe(403);
		expect((await call(t, 'DELETE', `/playlists/${id}`, owner)).statusCode).toBe(204);
	});

	it('removing a member closes a private playlist to them', async () => {
		const id = await createPlaylist({ visibility: 'PRIVATE' });
		await call(t, 'DELETE', `/playlists/${id}/members/${member.id}`, owner);
		expect((await call(t, 'GET', `/playlists/${id}`, member)).statusCode).toBe(404);
	});

	it('lists by scope without leaking private playlists', async () => {
		const name = `Scope ${crypto.randomUUID().slice(0, 6)}`;
		const pub = await createPlaylist({ name });
		const priv = await createPlaylist({ name, visibility: 'PRIVATE' });
		const ids = async (user: TestUser, scope: string) =>
			(await call(t, 'GET', `/playlists?scope=${scope}&q=${encodeURIComponent(name)}`, user))
				.json()
				.items.map((p: { id: string }) => p.id);
		expect(await ids(stranger, 'all')).toEqual([pub]);
		expect((await ids(member, 'shared')).sort()).toEqual([pub, priv].sort());
		expect(await ids(owner, 'mine')).toHaveLength(2);
		expect(await ids(owner, 'public')).toEqual([]);
	});
});
