import {
	type Coords,
	EventErrorCode,
	type EventState,
	type EventStateForUser,
	PREVIEW_SEC,
} from '@music-room/shared';
import type { PrismaClient } from '../../db.js';
import { httpError } from '../../plugins/errors.js';
import { isUniqueViolation } from '../auth/service.js';
import type { CatalogService } from '../catalog/service.js';
import { toTrack } from '../catalog/service.js';
import type { Realtime } from '../realtime/server.js';
import { loadOwned, loadVisible, voteRefusal } from './access.js';

const BROADCAST_EVERY_MS = 200;
const summary = { select: { id: true, displayName: true } } as const;

type QueueDeps = {
	prisma: PrismaClient;
	catalog: CatalogService;
	realtime: Realtime;
	previewMs?: number;
};

export function createEventQueue({
	prisma,
	catalog,
	realtime,
	previewMs = PREVIEW_SEC * 1000,
}: QueueDeps) {
	const timers = new Map<string, NodeJS.Timeout>();
	const lastSent = new Map<string, number>();
	const pending = new Map<string, NodeJS.Timeout>();

	// Ranked queue, never stored: votes desc, then oldest suggestion first.
	async function state(eventId: string): Promise<EventState> {
		const [event, queue] = await prisma.$transaction(
			[
				prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
				prisma.eventTrack.findMany({
					where: { eventId, playedAt: null },
					include: {
						track: true,
						suggestedBy: summary,
						_count: { select: { votes: true } },
					},
					orderBy: [{ votes: { _count: 'desc' } }, { createdAt: 'asc' }, { id: 'asc' }],
				}),
			],
			{ isolationLevel: 'RepeatableRead' },
		);
		const current = event.currentEntryId
			? await prisma.eventTrack.findUnique({
					where: { id: event.currentEntryId },
					include: { track: true },
				})
			: null;
		return {
			eventId,
			version: event.version,
			current:
				current && event.currentStartedAt
					? {
							entryId: current.id,
							track: toTrack(current.track),
							startedAt: event.currentStartedAt.toISOString(),
						}
					: null,
			queue: queue.map((e) => ({
				id: e.id,
				track: toTrack(e.track),
				votes: e._count.votes,
				suggestedBy: e.suggestedBy,
			})),
		};
	}

	async function stateFor(userId: string, eventId: string): Promise<EventStateForUser> {
		const [shared, votes] = await Promise.all([
			state(eventId),
			prisma.vote.findMany({
				where: { userId, entry: { eventId, playedAt: null } },
				select: { eventTrackId: true },
			}),
		]);
		return { ...shared, myVotes: votes.map((v) => v.eventTrackId) };
	}

	// At most one broadcast per event every 200 ms; the last change is always sent.
	function broadcast(eventId: string): void {
		if (pending.has(eventId)) return;
		const wait = Math.max(0, (lastSent.get(eventId) ?? 0) + BROADCAST_EVERY_MS - Date.now());
		pending.set(
			eventId,
			setTimeout(async () => {
				pending.delete(eventId);
				lastSent.set(eventId, Date.now());
				try {
					realtime.emitTo(`event:${eventId}`, 'event:state', await state(eventId));
				} catch {
					// Event deleted meanwhile.
				}
			}, wait),
		);
	}

	const bump = (eventId: string) =>
		prisma.event.update({ where: { id: eventId }, data: { version: { increment: 1 } } });

	function schedule(eventId: string, entryId: string, startedAt: Date): void {
		clearTimeout(timers.get(eventId));
		const delay = Math.max(0, startedAt.getTime() + previewMs - Date.now());
		timers.set(
			eventId,
			setTimeout(() => {
				timers.delete(eventId);
				advance(eventId, entryId).catch(() => undefined);
			}, delay),
		);
	}

	// Moves to the top of the queue, only if `expected` is still playing (optimistic lock).
	async function advance(eventId: string, expected: string | null): Promise<boolean> {
		const now = new Date();
		const next = await prisma.$transaction(async (tx) => {
			const top = await tx.eventTrack.findFirst({
				where: { eventId, playedAt: null },
				orderBy: [{ votes: { _count: 'desc' } }, { createdAt: 'asc' }, { id: 'asc' }],
				select: { id: true },
			});
			const { count } = await tx.event.updateMany({
				where: { id: eventId, currentEntryId: expected },
				data: {
					currentEntryId: top?.id ?? null,
					currentStartedAt: top ? now : null,
					version: { increment: 1 },
				},
			});
			if (count === 0) return undefined;
			if (top) await tx.eventTrack.update({ where: { id: top.id }, data: { playedAt: now } });
			return top ?? null;
		});
		if (next === undefined) return false;
		if (next) schedule(eventId, next.id, now);
		else clearTimeout(timers.get(eventId));
		broadcast(eventId);
		return true;
	}

	async function assertCanVote(userId: string, eventId: string, coords?: Coords) {
		const event = await loadVisible(prisma, eventId, userId);
		const refusal = await voteRefusal(prisma, event, userId, coords);
		if (refusal) throw httpError(403, refusal.code, refusal.message);
		return event;
	}

	const addVote = async (entryId: string, userId: string) =>
		(
			await prisma.vote.createMany({
				data: [{ eventTrackId: entryId, userId }],
				skipDuplicates: true,
			})
		).count > 0;

	// A suggestion counts as the suggester's vote; an already queued track just gets the vote.
	async function suggest(userId: string, eventId: string, deezerId: number, coords?: Coords) {
		const event = await assertCanVote(userId, eventId, coords);
		const track = await catalog.getTrack(deezerId);
		if (!track.previewUrl) {
			throw httpError(422, EventErrorCode.NoPreview, 'This track has no preview to play');
		}
		let entry = null;
		for (let attempt = 0; !entry && attempt < 3; attempt++) {
			try {
				entry = await prisma.eventTrack.create({
					data: { eventId, trackId: track.id, suggestedById: userId },
				});
			} catch (err) {
				if (!isUniqueViolation(err)) throw err;
				entry = await prisma.eventTrack.findFirst({
					where: { eventId, trackId: track.id, playedAt: null },
				});
			}
		}
		if (!entry) throw httpError(409, EventErrorCode.Stale, 'Try again');
		await addVote(entry.id, userId);
		await bump(eventId);
		if (!event.currentEntryId) await advance(eventId, null);
		broadcast(eventId);
		return stateFor(userId, eventId);
	}

	async function liveEntry(eventId: string, entryId: string) {
		const entry = await prisma.eventTrack.findUnique({ where: { id: entryId } });
		if (!entry || entry.eventId !== eventId)
			throw httpError(404, 'NOT_FOUND', 'Track not in this event');
		if (entry.playedAt) throw httpError(409, EventErrorCode.Stale, 'This track already played');
		return entry;
	}

	// Idempotent: the primary key turns a double vote into a no-op.
	async function vote(userId: string, eventId: string, entryId: string, coords?: Coords) {
		await assertCanVote(userId, eventId, coords);
		await liveEntry(eventId, entryId);
		if (await addVote(entryId, userId)) {
			await bump(eventId);
			broadcast(eventId);
		}
		return stateFor(userId, eventId);
	}

	async function unvote(userId: string, eventId: string, entryId: string) {
		await loadVisible(prisma, eventId, userId);
		await liveEntry(eventId, entryId);
		const { count } = await prisma.vote.deleteMany({
			where: { eventTrackId: entryId, userId },
		});
		if (count > 0) {
			await bump(eventId);
			broadcast(eventId);
		}
		return stateFor(userId, eventId);
	}

	async function next(userId: string, eventId: string, currentEntryId: string | null) {
		await loadOwned(prisma, eventId, userId);
		if (!(await advance(eventId, currentEntryId))) {
			throw httpError(409, EventErrorCode.Stale, 'The track already changed');
		}
		return stateFor(userId, eventId);
	}

	// Restarts the playback clocks after a restart of the API.
	async function resume(): Promise<void> {
		const playing = await prisma.event.findMany({
			where: { currentEntryId: { not: null }, currentStartedAt: { not: null } },
			select: { id: true, currentEntryId: true, currentStartedAt: true },
		});
		for (const e of playing) schedule(e.id, e.currentEntryId!, e.currentStartedAt!);
	}

	function forget(eventId: string): void {
		clearTimeout(timers.get(eventId));
		clearTimeout(pending.get(eventId));
		timers.delete(eventId);
		pending.delete(eventId);
	}

	function stop(): void {
		for (const timer of [...timers.values(), ...pending.values()]) clearTimeout(timer);
		timers.clear();
		pending.clear();
	}

	return { state, stateFor, suggest, vote, unvote, next, advance, resume, forget, stop };
}

export type EventQueue = ReturnType<typeof createEventQueue>;
