import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildTestApp,
	call,
	closeTestApp,
	connectSocket,
	createUser,
	createUsers,
	emitAck,
	listen,
	type ClientSocket,
	type TestApp,
	type TestUser,
} from './helpers.js';

const PREVIEW_MS = 400;
let t: TestApp;
let owner: TestUser;
let url: string;
const sockets: ClientSocket[] = [];
let nextTrack = 5000;

beforeAll(async () => {
	t = await buildTestApp({ previewMs: 60_000 });
	url = await listen(t);
	owner = await createUser(t, 'Owner');
});

afterAll(async () => {
	sockets.forEach((s) => s.close());
	await closeTestApp(t);
});

type State = {
	version: number;
	current: { entryId: string; track: { id: number } } | null;
	queue: { id: string; votes: number; track: { id: number } }[];
	myVotes: string[];
};

const newEvent = async () =>
	(await call(t, 'POST', '/events', owner, { name: 'Q' })).json().id as string;
const suggest = async (user: TestUser, id: string, deezerId = nextTrack++) =>
	(await call(t, 'POST', `/events/${id}/tracks`, user, { deezerId })).json() as State;
const vote = (user: TestUser, id: string, entryId: string) =>
	call(t, 'POST', `/events/${id}/tracks/${entryId}/vote`, user, {});
const getState = async (user: TestUser, id: string) =>
	(await call(t, 'GET', `/events/${id}/state`, user)).json() as State;

// First suggestion starts playing; the following ones fill the queue.
async function eventWithQueue(tracks: number) {
	const id = await newEvent();
	await suggest(owner, id);
	for (let i = 0; i < tracks; i++) await suggest(owner, id);
	return { id, queue: (await getState(owner, id)).queue };
}

describe('suggestions and ranking', () => {
	it('starts playing the first suggestion', async () => {
		const id = await newEvent();
		const state = await suggest(owner, id, 4242);
		expect(state.current?.track.id).toBe(4242);
		expect(state.queue).toEqual([]);
	});

	it('the same track suggested twice is one entry with two votes', async () => {
		const { id } = await eventWithQueue(0);
		const [voter] = await createUsers(t, 1);
		await suggest(owner, id, 777);
		const state = await suggest(voter!, id, 777);
		expect(state.queue).toHaveLength(1);
		expect(state.queue[0]).toMatchObject({ votes: 2, track: { id: 777 } });
		expect(state.myVotes).toEqual([state.queue[0]!.id]);
	});

	it('ranks by votes, then by age', async () => {
		const { id, queue } = await eventWithQueue(3);
		const [a, b] = (await createUsers(t, 2)) as [TestUser, TestUser];
		const [first, second, third] = queue as [
			State['queue'][0],
			State['queue'][0],
			State['queue'][0],
		];
		await vote(a, id, third.id);
		await vote(b, id, third.id);
		await vote(a, id, second.id);
		const ranked = (await getState(owner, id)).queue.map((e) => e.id);
		expect(ranked).toEqual([third.id, second.id, first.id]);
	});

	it('removing a vote lowers the count', async () => {
		const { id, queue } = await eventWithQueue(1);
		const res = await call(t, 'DELETE', `/events/${id}/tracks/${queue[0]!.id}/vote`, owner);
		expect(res.json().queue[0].votes).toBe(0);
	});

	it('refuses a track without preview', async () => {
		const id = await newEvent();
		await t.prisma.track.upsert({
			where: { deezerId: 31337 },
			create: { deezerId: 31337, title: 'x', artist: 'y', album: 'z', durationSec: 1 },
			update: { previewUrl: null },
		});
		const res = await call(t, 'POST', `/events/${id}/tracks`, owner, { deezerId: 31337 });
		expect(res.statusCode).toBe(422);
	});
});

describe('concurrency', () => {
	it('50 users voting at once on 5 tracks: every vote counted exactly once', async () => {
		const { id, queue } = await eventWithQueue(5);
		const voters = await createUsers(t, 50);
		const target = (i: number) => queue[i % 5]!.id;
		const results = await Promise.all(voters.map((v, i) => vote(v, id, target(i))));
		expect(results.every((r) => r.statusCode === 200)).toBe(true);
		const counts = (await getState(owner, id)).queue.map((e) => e.votes);
		// Each entry already had the owner's suggestion vote.
		expect(counts).toEqual([11, 11, 11, 11, 11]);
	});

	it('20 identical votes at once count as one', async () => {
		const { id, queue } = await eventWithQueue(1);
		const [voter] = (await createUsers(t, 1)) as [TestUser];
		const results = await Promise.all(
			Array.from({ length: 20 }, () => vote(voter, id, queue[0]!.id)),
		);
		expect(results.every((r) => r.statusCode === 200)).toBe(true);
		expect(await t.prisma.vote.count({ where: { eventTrackId: queue[0]!.id } })).toBe(2);
	});

	it('20 users suggesting the same track at once: one entry', async () => {
		const id = await newEvent();
		await suggest(owner, id);
		const users = await createUsers(t, 20);
		await Promise.all(users.map((u) => suggest(u, id, 8888)));
		const state = await getState(owner, id);
		expect(state.queue).toHaveLength(1);
		expect(state.queue[0]!.votes).toBe(20);
	});

	it('two "next" at once advance one track', async () => {
		const { id } = await eventWithQueue(3);
		const before = await getState(owner, id);
		const body = { currentEntryId: before.current!.entryId };
		const results = await Promise.all([
			call(t, 'POST', `/events/${id}/next`, owner, body),
			call(t, 'POST', `/events/${id}/next`, owner, body),
		]);
		expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
		expect((await getState(owner, id)).queue).toHaveLength(2);
	});
});

describe('playback', () => {
	let fast: TestApp;
	let host: TestUser;

	beforeAll(async () => {
		fast = await buildTestApp({ previewMs: PREVIEW_MS });
		host = await createUser(fast, 'Host');
	});

	afterAll(() => closeTestApp(fast));

	it('moves to the most voted track when the preview ends, then stops', async () => {
		const id = (await call(fast, 'POST', '/events', host, { name: 'P' })).json().id;
		await call(fast, 'POST', `/events/${id}/tracks`, host, { deezerId: 61 });
		const second = (
			await call(fast, 'POST', `/events/${id}/tracks`, host, { deezerId: 62 })
		).json();
		const state = async () =>
			(await call(fast, 'GET', `/events/${id}/state`, host)).json() as State;

		await new Promise((r) => setTimeout(r, PREVIEW_MS + 200));
		expect((await state()).current?.entryId).toBe(second.queue[0].id);
		await new Promise((r) => setTimeout(r, PREVIEW_MS + 200));
		expect((await state()).current).toBeNull();
	});

	it('only the owner skips', async () => {
		const { id } = await eventWithQueue(1);
		const [other] = (await createUsers(t, 1)) as [TestUser];
		const res = await call(t, 'POST', `/events/${id}/next`, other, { currentEntryId: null });
		expect(res.statusCode).toBe(403);
	});
});

describe('broadcast', () => {
	it('sends the new state to the room after a vote', async () => {
		const { id, queue } = await eventWithQueue(1);
		const [voter] = (await createUsers(t, 1)) as [TestUser];
		const s = await connectSocket(url, owner);
		sockets.push(s);
		expect(await emitAck(s, 'room:join', { kind: 'event', id })).toEqual({ ok: true });
		const before = (await getState(owner, id)).version;
		const received: State[] = [];
		s.on('event:state', (st: State) => received.push(st));
		await vote(voter, id, queue[0]!.id);
		await new Promise((r) => setTimeout(r, 300));
		expect(received.length).toBeGreaterThan(0);
		expect(received.at(-1)!.version).toBeGreaterThan(before);
		expect(received.at(-1)!.queue[0]!.votes).toBe(2);
	});

	it('coalesces a burst of votes into few broadcasts', async () => {
		const { id, queue } = await eventWithQueue(1);
		const s = await connectSocket(url, owner);
		sockets.push(s);
		await emitAck(s, 'room:join', { kind: 'event', id });
		let count = 0;
		s.on('event:state', () => count++);
		const voters = await createUsers(t, 30);
		await Promise.all(voters.map((v) => vote(v, id, queue[0]!.id)));
		await new Promise((r) => setTimeout(r, 300));
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThan(10);
	});

	it('strangers cannot join a private event room', async () => {
		const id = (
			await call(t, 'POST', '/events', owner, { name: 'P', visibility: 'PRIVATE' })
		).json().id;
		const [stranger] = (await createUsers(t, 1)) as [TestUser];
		const s = await connectSocket(url, stranger);
		sockets.push(s);
		expect(await emitAck(s, 'room:join', { kind: 'event', id })).toMatchObject({ ok: false });
	});
});
