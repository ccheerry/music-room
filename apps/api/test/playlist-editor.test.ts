import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildTestApp,
	call,
	closeTestApp,
	connectSocket,
	createUsers,
	emitAck,
	listen,
	type ClientSocket,
	type TestApp,
	type TestUser,
} from './helpers.js';

type State = {
	version: number;
	entries: { id: string; position: string; track: { id: number } }[];
};

let t: TestApp;
let url: string;
let users: TestUser[];
const sockets: ClientSocket[] = [];

beforeAll(async () => {
	t = await buildTestApp();
	url = await listen(t);
	users = await createUsers(t, 10);
});

afterAll(async () => {
	sockets.forEach((s) => s.close());
	await closeTestApp(t);
});

const owner = () => users[0]!;
const anyone = (i: number) => users[i % users.length]!;

async function playlistWith(count: number) {
	const id: string = (await call(t, 'POST', '/playlists', owner(), { name: 'P' })).json().id;
	for (let i = 0; i < count; i++) {
		await call(t, 'POST', `/playlists/${id}/entries`, owner(), { deezerId: 100 + i });
	}
	return { id, state: await read(id) };
}

const read = async (id: string) =>
	(await call(t, 'GET', `/playlists/${id}/entries`, owner())).json() as State;
const move = (user: TestUser, id: string, entryId: string, afterEntryId: string | null) =>
	call(t, 'PATCH', `/playlists/${id}/entries/${entryId}`, user, { afterEntryId });
const order = (s: State) => s.entries.map((e) => e.track.id);

// Byte order, as stored with COLLATE "C".
const sortedUnique = (positions: string[]) =>
	positions.every(
		(p, i) => i === 0 || Buffer.compare(Buffer.from(positions[i - 1]!), Buffer.from(p)) < 0,
	);

describe('operations by id', () => {
	it('adds last by default, first with null, after a given entry otherwise', async () => {
		const { id, state } = await playlistWith(2);
		const [a, b] = state.entries as [State['entries'][0], State['entries'][0]];
		await call(t, 'POST', `/playlists/${id}/entries`, owner(), {
			deezerId: 900,
			afterEntryId: null,
		});
		await call(t, 'POST', `/playlists/${id}/entries`, owner(), {
			deezerId: 901,
			afterEntryId: a.id,
		});
		await call(t, 'POST', `/playlists/${id}/entries`, owner(), { deezerId: 902 });
		expect(order(await read(id))).toEqual([900, 100, 901, 101, 902]);
		void b;
	});

	it('moves to the top, after an entry, and keeps duplicates of a track apart', async () => {
		const { id, state } = await playlistWith(3);
		const [a, b, c] = state.entries as [
			State['entries'][0],
			State['entries'][0],
			State['entries'][0],
		];
		await move(owner(), id, c.id, null);
		expect(order(await read(id))).toEqual([102, 100, 101]);
		await move(owner(), id, c.id, b.id);
		expect(order(await read(id))).toEqual([100, 101, 102]);
		await call(t, 'POST', `/playlists/${id}/entries`, owner(), { deezerId: 100 });
		expect(order(await read(id))).toEqual([100, 101, 102, 100]);
		void a;
	});

	it('answers 409 STALE with the current state for a removed entry', async () => {
		const { id, state } = await playlistWith(2);
		const [a, b] = state.entries as [State['entries'][0], State['entries'][0]];
		expect(
			(await call(t, 'DELETE', `/playlists/${id}/entries/${a.id}`, owner())).statusCode,
		).toBe(200);
		const res = await move(owner(), id, a.id, null);
		expect(res.statusCode).toBe(409);
		expect(res.json().error.code).toBe('STALE');
		expect(res.json().state.entries.map((e: { id: string }) => e.id)).toEqual([b.id]);
		const anchor = await move(owner(), id, b.id, a.id);
		expect(anchor.statusCode).toBe(409);
	});

	it('bumps the version once per operation', async () => {
		const { id, state } = await playlistWith(2);
		await move(owner(), id, state.entries[1]!.id, null);
		expect((await read(id)).version).toBe(state.version + 1);
	});
});

describe('room access', () => {
	it('making a playlist private removes the strangers from its room', async () => {
		const { id } = await playlistWith(1);
		const [stranger, member] = [users[1]!, users[2]!];
		await call(t, 'POST', `/playlists/${id}/members`, owner(), { userId: member.id });
		const received = { stranger: 0, member: 0 };
		for (const [who, user] of [
			['stranger', stranger],
			['member', member],
		] as const) {
			const s = await connectSocket(url, user);
			sockets.push(s);
			expect(await emitAck(s, 'room:join', { kind: 'playlist', id })).toEqual({ ok: true });
			s.on('playlist:state', () => received[who]++);
		}
		const res = await call(t, 'PATCH', `/playlists/${id}`, owner(), {
			visibility: 'PRIVATE',
		});
		expect(res.statusCode).toBe(200);
		await call(t, 'POST', `/playlists/${id}/entries`, owner(), { deezerId: 190 });
		await new Promise((r) => setTimeout(r, 300));
		expect(received.member).toBeGreaterThan(0);
		expect(received.stranger).toBe(0);
	});
});

describe('concurrency', () => {
	it('60 parallel additions: every one is stored, none refused', async () => {
		const { id } = await playlistWith(0);
		const results = await Promise.all(
			Array.from({ length: 60 }, (_, i) =>
				call(t, 'POST', `/playlists/${id}/entries`, anyone(i), { deezerId: 300 + (i % 5) }),
			),
		);
		expect(results.map((r) => r.statusCode).filter((c) => c !== 200)).toEqual([]);
		const state = await read(id);
		expect(state.entries).toHaveLength(60);
		expect(state.version).toBe(60);
	});

	it('30 parallel moves of different entries: no lost update, unique positions', async () => {
		const { id, state } = await playlistWith(30);
		const ids = state.entries.map((e) => e.id);
		// Each entry goes to the top or right after a random entry that is not itself.
		const targets = ids.map((entryId, i) => {
			const other = ids[(i * 7 + 3) % ids.length]!;
			return other === entryId ? null : other;
		});
		const results = await Promise.all(
			ids.map((entryId, i) => move(anyone(i), id, entryId, targets[i]!)),
		);
		expect(results.map((r) => r.statusCode)).toEqual(ids.map(() => 200));
		const final = await read(id);
		expect(final.entries).toHaveLength(30);
		expect(new Set(final.entries.map((e) => e.id))).toEqual(new Set(ids));
		expect(sortedUnique(final.entries.map((e) => e.position))).toBe(true);
		expect(final.version).toBe(state.version + 30);
	});

	it('10 parallel moves of one entry: it ends at one of the targets and clients converge', async () => {
		const { id, state } = await playlistWith(11);
		const socket = await connectSocket(url, owner());
		sockets.push(socket);
		await emitAck(socket, 'room:join', { kind: 'playlist', id });
		let last: State | undefined;
		socket.on('playlist:state', (s: State) => {
			if (!last || s.version > last.version) last = s;
		});

		const moving = state.entries[0]!.id;
		const others = state.entries.slice(1).map((e) => e.id);
		await Promise.all(others.map((after, i) => move(anyone(i), id, moving, after)));
		const final = await read(id);
		await new Promise((r) => setTimeout(r, 200));

		const at = final.entries.findIndex((e) => e.id === moving);
		expect(others).toContain(final.entries[at - 1]!.id);
		// The other entries never moved relative to each other.
		expect(final.entries.filter((e) => e.id !== moving).map((e) => e.id)).toEqual(others);
		expect(last).toEqual(final);
	});

	it('move and delete of the same entry at once: never a 500, the entry is gone', async () => {
		const { id, state } = await playlistWith(3);
		const target = state.entries[0]!.id;
		const [moved, deleted] = await Promise.all([
			move(anyone(1), id, target, state.entries[2]!.id),
			call(t, 'DELETE', `/playlists/${id}/entries/${target}`, anyone(2)),
		]);
		expect(deleted.statusCode).toBe(200);
		expect([200, 409]).toContain(moved.statusCode);
		expect((await read(id)).entries.map((e) => e.id)).not.toContain(target);
	});
});

describe('property: random concurrent operations', () => {
	type Op = { kind: 'add' | 'move' | 'remove'; pick: number; after: number; user: number };
	const op = fc.record({
		kind: fc.constantFrom<'add' | 'move' | 'remove'>('add', 'move', 'move', 'remove'),
		pick: fc.nat(50),
		after: fc.integer({ min: -1, max: 50 }),
		user: fc.nat(9),
	});

	it('the stored order is always a valid permutation of the surviving entries', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.array(fc.array(op, { minLength: 1, maxLength: 6 }), {
					minLength: 1,
					maxLength: 4,
				}),
				async (batches) => {
					const { id, state } = await playlistWith(4);
					let known = state.entries.map((e) => e.id);
					let version = state.version;
					for (const batch of batches) {
						// Ids chosen from what the clients last saw: some will be stale.
						const results = await Promise.all(
							batch.map((o: Op) => {
								const entry = known[o.pick % Math.max(1, known.length)];
								const after =
									o.after < 0 || known.length === 0
										? null
										: known[o.after % known.length]!;
								const user = anyone(o.user);
								if (o.kind === 'add' || !entry) {
									return call(t, 'POST', `/playlists/${id}/entries`, user, {
										deezerId: 500 + o.pick,
										afterEntryId: after,
									});
								}
								if (o.kind === 'remove')
									return call(
										t,
										'DELETE',
										`/playlists/${id}/entries/${entry}`,
										user,
									);
								return move(user, id, entry, after === entry ? null : after);
							}),
						);
						expect(results.every((r) => [200, 409].includes(r.statusCode))).toBe(true);
						version += results.filter((r) => r.statusCode === 200).length;
						const now = await read(id);
						expect(now.version).toBe(version);
						expect(new Set(now.entries.map((e) => e.id)).size).toBe(now.entries.length);
						expect(sortedUnique(now.entries.map((e) => e.position))).toBe(true);
						known = now.entries.map((e) => e.id);
					}
				},
			),
			{ numRuns: 15 },
		);
	}, 60_000);
});
